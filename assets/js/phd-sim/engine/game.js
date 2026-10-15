// The turn engine. step() advances until the player must decide something and returns
// that prompt; answer() applies the decision. Everything lives in a serializable state.
import { Rng } from "./rng.js";
import { clamp, parseValue } from "./util.js";
import { TURNS, yearOf, tOf, semesterOf, semesterKey, ACTIVITY_BY_ID, ACTIVITIES } from "./state.js";
import { hasStatus, hasTrait, totalCitations } from "./derived.js";
import { check } from "./conditions.js";
import { addStat, addStatus, removeStatus } from "./effects.js";
import { drawHook, fireHook, presentEvent, resolveEvent, flavorLine } from "./events.js";
import { activeProjects, workDay, tickProjects, autoTarget, setTarget, currentStage, withdrawRevision, rollMissedDeadlines } from "./projects.js";
import { accrueCitations } from "./citations.js";
import { yearlyLabmates } from "./people.js";
import { tickWorld } from "./world.js";
import { checkAchievements } from "./achievements.js";
import { finalize } from "./endings.js";
import { resolveRebuttal } from "./reviews.js";
import {
  buildSys, handleSys, answerMatching, answerQa, answerNewProject, newProjectPrompt, leavePrompt,
  queueMilestones, queuePapers, finishSubmissions, createProject
} from "./milestones.js";

const COURSES = ["Machine Learning", "Natural Language Processing", "HCI Research Methods", "Statistics for Experiments",
  "Deep Learning", "Qualitative Methods", "Algorithms", "Information Retrieval", "Ethics of AI"];
const TA_COURSES = ["Intro to Programming", "Data Structures", "Intro to AI", "Machine Learning", "HCI Foundations", "NLP"];

export class Game {
  constructor(D, meta, state) {
    this.D = D;
    this.meta = meta || {};
    this.state = state;
    this.rng = Rng.fromState(state.rng);
    // Repair saves damaged by older versions: every stat must be a finite number.
    Object.keys(state.stats).forEach(function (k) { if (!isFinite(state.stats[k])) state.stats[k] = 50; });
    if (!state.initialized) this.init();
  }

  init() {
    const s = this.state;
    s.initialized = true;
    this.meta.runs = (this.meta.runs || 0) + 1;
    s.runIndex = this.meta.runs;
    const bg = this.D.backgroundById[s.player.background];
    if (bg && bg.starting_project) {
      const t = this.rng.pick(s.world.topics);
      const p = createProject(this, this.rng.chance(0.5) ? "empirical" : "study", t.id, { stageIdx: 1, seedQuality: 48, source: "masters" });
      p.progress = 40;
      autoTarget(this, p);
      this.log("You bring a half-finished project from your Master's: “" + p.title + "”.");
    }
    this.save();
  }

  save() { this.state.rng = this.rng.state(); }

  log(text, kind, extra) {
    const e = { turn: this.state.turn, kind: kind || "line", text: text };
    if (extra) for (const k in extra) e[k] = extra[k];
    this.state.log.push(e);
    if (this.state.log.length > 400) this.state.log.splice(0, this.state.log.length - 400);
  }

  roll(v) {
    const p = parseValue(v);
    return p ? this.rng.triangular(p.center, p.spread) : 0;
  }

  // ---- Public API ----------------------------------------------------------

  step() {
    const s = this.state;
    for (let guard = 0; guard < 500; guard++) {
      if (s.prompt) return s.prompt;
      if (s.phase === "ended") return { type: "ended", ending: s.ending };
      if (s.pendingEnding) {
        finalize(this, s.pendingEnding);
        s.pendingEnding = null;
        this.save();
        continue;
      }
      if (s.stage === "turn_start") { this.startTurn(); s.stage = "items"; continue; }
      if (s.stage === "items") {
        if (s.turnItems.length) {
          const item = s.turnItems.shift();
          const p = item.kind === "event" ? presentEvent(this, item) : buildSys(this, item);
          if (p) { s.prompt = p; this.save(); return p; }
          continue;
        }
        s.stage = "resolve";
        continue;
      }
      if (s.stage === "resolve") {
        const summary = this.resolveTurn();
        s.stage = "turn_start";
        this.save();
        if (s.pendingEnding) continue;
        return { type: "turn_end", summary: summary };
      }
    }
    return { type: "error" };
  }

  answer(resp) {
    const s = this.state;
    const p = s.prompt;
    if (!p) return null;
    s.prompt = null;
    resp = resp || {};
    let res = null;
    if (p.type === "event") {
      const ctx = s.current ? s.current.ctx : {};
      res = resolveEvent(this, resp.choice || 0);
      this.afterEvent(ctx);
    } else if (p.type === "sys") {
      res = handleSys(this, p, resp.choice || 0);
    } else if (p.type === "matching") {
      res = answerMatching(this, resp);
      if (res && res.again) s.turnItems.unshift({ kind: "sys", sys: "matching" });
    } else if (p.type === "rebuttal") {
      const pp = s.papers.find(function (x) { return x.id === p.paperId; });
      if (pp) res = resolveRebuttal(this, pp, resp);
      if (res) res.kind = "rebuttal";
    } else if (p.type === "qa") {
      res = answerQa(this, resp);
      if (res) res.kind = "qa";
    } else if (p.type === "new_project") {
      res = answerNewProject(this, resp);
    }
    if (res && res.tip && this.D.phd101[res.tip]) res.tipLink = this.D.phd101[res.tip];
    this.save();
    return res;
  }

  afterEvent(ctx) {
    const s = this.state;
    if (s.flags.chose_quality_over_deadline) {
      delete s.flags.chose_quality_over_deadline;
      s.counters.waited_for_quality = (s.counters.waited_for_quality || 0) + 1;
      const p = ctx && ctx.projectId && s.projects.find(function (x) { return x.id === ctx.projectId; });
      if (p) {
        p.submitting = false;
        removeStatus(this, "deadline_mode");
        if (p.target && !p.target.rrPaper && !p.target.journalPaper) { p.target = null; autoTarget(this, p, { minLead: 2 }); }
      }
    }
  }

  requestNewProject() {
    const s = this.state;
    if (s.prompt || s.phase === "ended") return null;
    if (activeProjects(this).length >= (this.D.config.progress.max_active_projects || 4)) return null;
    s.prompt = newProjectPrompt(this, {});
    s.prompt.ui = true;
    return s.prompt;
  }

  requestLeave() {
    const s = this.state;
    if (s.prompt || s.phase === "ended") return null;
    s.prompt = leavePrompt(this);
    s.prompt.ui = true;
    return s.prompt;
  }

  setRoutine(routine) {
    const s = this.state;
    const days = {};
    Object.keys(routine.days || {}).forEach(function (k) {
      const n = Math.max(0, Math.min(10, parseInt(routine.days[k], 10) || 0));
      if (n > 0) days[k] = n;
    });
    s.routine = { days: days, overtime: clamp(parseInt(routine.overtime, 10) || 0, 0, 4), overtimeTarget: routine.overtimeTarget || "read" };
    this.save();
  }

  setTarget(projectId, venueId) {
    const p = this.state.projects.find(function (x) { return x.id === projectId; });
    if (p && p.status === "active" && !(p.target && (p.target.rrPaper || p.target.journalPaper))) setTarget(this, p, venueId);
    this.save();
  }

  shelveProject(projectId) {
    const p = this.state.projects.find(function (x) { return x.id === projectId; });
    if (p && p.status === "active") { withdrawRevision(this, p); p.status = "shelved"; this.log("You shelve “" + p.short + "”."); }
    this.save();
  }

  // ---- Days ----------------------------------------------------------------

  fixedDays() {
    const s = this.state;
    const cfg = this.D.config.fixed_days;
    const t = tOf(s.turn);
    const f = { courses: 0, ta: 0, meetings: 0, defense: 0, family: 0, internship: 0 };
    if (hasStatus(this, "on_internship")) f.internship = 10;
    else if (!hasStatus(this, "on_leave")) {
      if (hasStatus(this, "coursework")) f.courses = yearOf(s.turn) === 1 ? cfg.courses_y1 : cfg.courses_y2;
      if (hasStatus(this, "ta")) f.ta = (t === 8 || t === 18) ? cfg.ta_peak : cfg.ta;
      if (s.advisor) f.meetings = s.advisor.archetype === "micromanager" ? 2 : cfg.meetings;
      if (hasStatus(this, "defense_prep")) f.defense = cfg.defense_prep;
      if (hasTrait(this, "parent")) f.family = 2;
    }
    let total = f.courses + f.ta + f.meetings + f.defense + f.family + f.internship;
    const adj = s.stage === "turn_start" ? s.dayAdjNext : s.dayAdj;
    let free = Math.max(0, 10 - total + adj);
    const sick = hasStatus(this, "sick");
    if (sick) free = Math.max(0, free - 5);
    const burnout = hasStatus(this, "burnout");
    if (burnout) free = Math.floor(free / 2);
    if (hasStatus(this, "on_leave") || hasStatus(this, "on_internship")) free = 0;
    return {
      parts: f, total: total, adj: adj, sick: sick, burnout: burnout, free: free,
      overtimeAllowed: !burnout && !hasStatus(this, "on_leave") && !hasStatus(this, "on_internship")
    };
  }

  validKey(k) {
    if (k.indexOf("p:") === 0) {
      const id = k.slice(2);
      return this.state.projects.some(function (p) { return p.id === id && p.status === "active"; });
    }
    return !!ACTIVITY_BY_ID[k];
  }

  cleanRoutine() {
    const s = this.state;
    const r = s.routine.days;
    const self = this;
    let moved = 0;
    Object.keys(r).forEach(function (k) {
      if (!self.validKey(k)) { moved += r[k]; delete r[k]; }
    });
    if (moved) {
      const ap = activeProjects(this).filter(function (p) { return p.firstAuthor !== false; });
      const target = ap.length ? "p:" + ap[0].id : "read";
      r[target] = (r[target] || 0) + moved;
      this.log("Routine: " + moved + " days move to " + (ap.length ? ap[0].short : "reading") + ".");
    }
    if (!this.validKey(s.routine.overtimeTarget || "read")) {
      const ap = activeProjects(this);
      s.routine.overtimeTarget = ap.length ? "p:" + ap[0].id : "read";
    }
  }

  allocate(free) {
    const r = this.state.routine.days;
    const keys = Object.keys(r).filter(function (k) { return r[k] > 0; });
    const total = keys.reduce(function (a, k) { return a + r[k]; }, 0);
    const out = {};
    if (total <= free) {
      keys.forEach(function (k) { out[k] = r[k]; });
      if (free > total) out.rest = (out.rest || 0) + (free - total);
      return { alloc: out, squeezed: 0, unplanned: free - total };
    }
    let used = 0;
    const fr = [];
    keys.forEach(function (k) {
      const exact = r[k] * free / total;
      out[k] = Math.floor(exact);
      used += out[k];
      fr.push({ k: k, f: exact - out[k] });
    });
    fr.sort(function (a, b) { return b.f - a.f; });
    for (let i = 0; used < free && i < fr.length; i++) { out[fr[i].k]++; used++; }
    return { alloc: out, squeezed: total - free, unplanned: 0 };
  }

  applyDay(key, eff, overtime, tally) {
    const s = this.state;
    const cfg = this.D.config;
    const st = s.stats;
    const isProject = key.indexOf("p:") === 0;
    const act = ACTIVITY_BY_ID[key];
    const work = isProject || (act && act.kind === "work");
    const g = cfg.skills.growth;
    if (work) {
      let e = overtime ? (hasTrait(this, "night_owl") ? this.roll("-3±1") : this.roll(cfg.energy.overtime)) : this.roll(cfg.energy.workday);
      if (key === "network" && hasTrait(this, "introvert")) e -= 1;
      addStat(this, "energy", e);
      if (overtime) { addStat(this, "sanity", cfg.sanity.overtime_day); addStat(this, "health", cfg.health.overtime_day); tally.overtime++; }
      tally.work++;
    }
    if (isProject) {
      const p = s.projects.find(function (x) { return x.id === key.slice(2); });
      if (p && p.status === "active") {
        const self = this;
        workDay(this, p, eff, function (line) { self.log(line); });
        tally.projects[p.id] = true;
        if (hasStatus(this, "proposal_prep")) s.readiness += 0.4;
      }
      return;
    }
    switch (key) {
      case "read":
        st.knowledge = clamp(st.knowledge + g * (1 - st.knowledge / 100), 0, 100);
        st.taste = clamp(st.taste + 0.5 * g * (1 - st.taste / 100), 0, 100);
        s.telemetry.reading_days++;
        if (hasStatus(this, "quals_prep")) s.readiness += 0.6;
        if (this.rng.chance(0.04 + st.taste / 1500)) { s.telemetry.ideas++; this.log("While reading, you have an idea worth keeping."); }
        break;
      case "network": {
        let n = this.roll("+1±1") * (hasTrait(this, "social_butterfly") ? 1.5 : 1);
        addStat(this, "network", Math.max(0.5, n));
        if (this.rng.chance(hasTrait(this, "extremely_online") ? 0.25 : 0.12)) s.bonusCitations++;
        break;
      }
      case "help":
        addStat(this, "labmates_rel", 1.5);
        this.maybeCoauthor(hasTrait(this, "overcommitter") ? 0.04 : 0.02);
        break;
      case "mentor":
        addStat(this, "labmates_rel", 1);
        addStat(this, "presenting", 0.3);
        s.telemetry.mentor_days++;
        if (!s.mentee) this.maybeCoauthor(0.01);
        break;
      case "career":
        s.careerPrep += 1;
        addStat(this, "presenting", 0.2);
        break;
      case "rest":
        addStat(this, "energy", this.roll(cfg.energy.rest));
        s.telemetry.rest_days++;
        tally.self++;
        break;
      case "exercise":
        addStat(this, "energy", this.roll(cfg.energy.light));
        addStat(this, "health", cfg.health.exercise_day * (hasTrait(this, "gym_rat") ? 2 : 1));
        addStat(this, "sanity", 1);
        s.telemetry.exercise_days++;
        tally.self++; tally.exercise++;
        break;
      case "social":
        addStat(this, "energy", this.roll(cfg.energy.light) - 2);
        addStat(this, "sanity", this.roll(cfg.sanity.self_day) * (hasTrait(this, "social_butterfly") ? 1.5 : 1));
        addStat(this, "friends_rel", 2);
        s.telemetry.social_days++;
        tally.self++; tally.social++;
        break;
      case "hobby":
        addStat(this, "energy", this.roll(cfg.energy.light));
        addStat(this, "sanity", this.roll(cfg.sanity.self_day) * (hasTrait(this, "musician") ? 1.5 : 1));
        tally.self++;
        break;
      case "family":
        addStat(this, "energy", this.roll(cfg.energy.light));
        addStat(this, "sanity", this.roll("+2±1") * (hasTrait(this, "homebody") ? 1.5 : 1));
        addStat(this, "family_rel", 2);
        tally.self++; tally.social++;
        break;
    }
  }

  maybeCoauthor(p) {
    const s = this.state;
    const y = yearOf(s.turn);
    s.coauthorYears = s.coauthorYears || {};
    if ((s.coauthorYears[y] || 0) >= 2 || !s.advisor || !this.rng.chance(p)) return;
    s.coauthorYears[y] = (s.coauthorYears[y] || 0) + 1;
    const lm = s.labmates.filter(function (l) { return l.present !== false; });
    const who = lm.length ? this.rng.pick(lm).name : "A labmate";
    const venues = this.D.venues.filter(function (v) { return !v.journal; });
    const v = this.rng.pick(venues);
    const topic = this.rng.pick(s.world.topics);
    const titles = (this.D.topicById[topic.id] || {}).titles || [];
    const title = titles.length ? this.rng.pick(titles) : "A Paper You Helped With";
    s.papers.push({
      id: "x" + s.nextId++, projectId: null, title: title, short: title.split(":")[0], type: "empirical", topic: topic.id,
      venueId: v.id, venueName: v.cycles[0].name, tier: v.tier, journal: false, cycle: 0,
      submittedTurn: s.turn, reviewsTurn: s.turn + 5, decisionTurn: s.turn + this.rng.int(5, 9), conferenceTurn: null,
      rebuttal: false, rr: false, round: 1, comps: { N: 60, S: 60, C: 60 },
      Q: 58 + this.rng.normal(0, 8), status: "under_review", reviews: null, preprint: false, firstAuthor: false,
      submissions: 1, citations: 0, citeMean: 0, pubTurn: null, breakout: 1, bonusCites: 0, scoreBonus: 0, promises: 0, coauthor: who
    });
    this.log(who + " adds you as a co-author on their submission. You helped more than you realized.");
  }

  // ---- Turn phases -----------------------------------------------------------

  updateCalendarStatuses() {
    const s = this.state;
    const t = tOf(s.turn);
    const y = yearOf(s.turn);
    const sem = semesterOf(t);
    const inSemester = sem === "fall" || sem === "spring";
    const course = inSemester && (y === 1 || (y === 2 && sem === "fall"));
    if (course) addStatus(this, "coursework", 1); else removeStatus(this, "coursework");
    if (course && (t === 1 || t === 10)) {
      this.log("This semester: " + this.rng.shuffle(COURSES).slice(0, y === 1 ? 2 : 1).join(" and ") + ".");
    }
    if (s.fellowshipYear === y) addStatus(this, "fellowship", 1); else removeStatus(this, "fellowship");
    const key = semesterKey(s.turn);
    if ((t === 1 || t === 10) && s.ta[key] === undefined) {
      let ta = false;
      if (s.advisor && !(y === 1 && t === 1) && s.fellowshipYear !== y && !s.milestones.graduated) {
        const fund = s.advisor.params.fund;
        ta = this.rng.chance(this.D.config.ta_chance_by_funding[fund - 1]);
      }
      s.ta[key] = ta;
      if (ta) {
        s.telemetry.ta_semesters++;
        s.taCourse = this.rng.pick(TA_COURSES);
        this.log("You're a TA for " + s.taCourse + " this semester. Two days a turn go to teaching.");
      }
    }
    if (inSemester && s.ta[key]) addStatus(this, "ta", 1); else removeStatus(this, "ta");
  }

  startTurn() {
    const s = this.state;
    const self = this;
    s.dayAdj = s.dayAdjNext;
    s.dayAdjNext = 0;
    s.turnLogStart = s.log.length;
    s.newAchievements = [];
    s.turnItems = [];
    const managed = ["coursework", "ta", "fellowship"];
    s.statuses.forEach(function (st) { if (managed.indexOf(st.id) < 0) st.turns--; });
    const expired = s.statuses.filter(function (st) { return st.turns <= 0 && managed.indexOf(st.id) < 0; });
    s.statuses = s.statuses.filter(function (st) { return !(st.turns <= 0 && managed.indexOf(st.id) < 0); });
    expired.forEach(function (st) {
      if (st.id === "burnout" && s.player.traits.indexOf("burnout_survivor") < 0) {
        s.player.traits.push("burnout_survivor");
        self.log("You come back from burnout knowing your limits a little better. New trait: Burnout Survivor.");
      }
      if (st.id === "at_conference" || st.id === "on_internship") self.cleanRoutine();
    });
    this.updateCalendarStatuses();

    let items = [];
    tickWorld(this, function (l) { self.log(l); }).forEach(function (h) {
      fireHook(self, h.hook, h.ctx).forEach(function (it) { items.push(it); });
    });
    (s.pendingNotices || []).forEach(function (n) { items.push({ kind: "sys", sys: "notice", data: n }); });
    s.pendingNotices = [];
    items = items.concat(queueMilestones(this));
    items = items.concat(queuePapers(this));
    s.pendingHooks.forEach(function (h) { fireHook(self, h.hook, h.ctx).forEach(function (it) { items.push(it); }); });
    s.pendingHooks = [];
    const due = s.queue.filter(function (q) { return q.turn <= s.turn; });
    s.queue = s.queue.filter(function (q) { return q.turn > s.turn; });
    due.forEach(function (q) { items.push({ kind: "event", id: q.event, ctx: q.ctx || {}, scheduled: true }); });
    if (hasStatus(this, "on_internship") && s.internship && s.internship.accepted) {
      fireHook(this, "internship", { company: s.internship.accepted.company }).forEach(function (it) { items.push(it); });
    }
    if (hasStatus(this, "defense_prep")) fireHook(this, "defense_prep", {}).forEach(function (it) { items.push(it); });
    if (hasStatus(this, "job_market")) fireHook(this, "job_market", {}).forEach(function (it) { items.push(it); });

    const contentCount = items.filter(function (it) { return it.kind === "event"; }).length;
    const probs = this.D.config.events.random_count;
    const r = this.rng.next();
    let n = r < probs[0] ? 0 : r < probs[0] + probs[1] ? 1 : 2;
    n = Math.max(0, n - contentCount);
    items = items.concat(drawHook(this, "turn", {}, n));
    if (s.milestones.graduated && !s.pendingEnding && !s.turnItems.concat(items).some(function (it) { return it.sys === "final_offers"; })) {
      items.push({ kind: "sys", sys: "final_offers" });
    }
    s.turnItems = s.turnItems.concat(items);
    s.fixedDaysEstimate = this.fixedDays().total;
  }

  resolveTurn() {
    const s = this.state;
    const cfg = this.D.config;
    const self = this;
    const before = { energy: s.stats.energy, sanity: s.stats.sanity, cites: totalCitations(this) };
    this.cleanRoutine();
    const fx = this.fixedDays();
    const tally = { work: 0, self: 0, social: 0, exercise: 0, overtime: 0, projects: {} };

    let eff = clamp(cfg.energy.efficiency_floor + cfg.energy.efficiency_slope * s.stats.energy, cfg.energy.efficiency_floor, 1);
    if (s.stats.sanity < cfg.sanity.low) eff *= cfg.sanity.low_efficiency;
    if (hasStatus(this, "jet_lagged")) eff *= 0.8;
    if (hasStatus(this, "post_rejection_blues")) eff *= 0.9;
    if (hasStatus(this, "deadline_mode")) eff *= hasTrait(this, "deadline_junkie") ? 1.25 : 1.15;
    if (hasStatus(this, "in_the_zone")) eff *= 1.2;
    if (hasStatus(this, "in_love")) eff *= 0.9;
    if (hasTrait(this, "early_bird")) eff *= 1.05;
    if (hasTrait(this, "parent")) eff *= 1.1;

    let free = fx.free;
    if (hasTrait(this, "caffeine_powered") && s.stats.energy < 40 && fx.overtimeAllowed) { free += 1; addStat(this, "health", -1); }

    if (hasStatus(this, "on_internship")) {
      for (let i = 0; i < 10; i++) addStat(this, "energy", this.roll(cfg.energy.workday));
      addStat(this, "coding", 1.5);
      addStat(this, "network", 1.2);
      addStat(this, "presenting", 0.3);
      addStat(this, "sanity", 2);
      tally.work += 10;
      for (let i = 0; i < 4; i++) {
        addStat(this, "energy", this.roll(cfg.energy.weekend_off));
        addStat(this, "sanity", cfg.sanity.weekend_off);
        tally.self++; tally.social++;
      }
    } else if (hasStatus(this, "on_leave")) {
      for (let i = 0; i < 10; i++) this.applyDay("rest", eff, false, tally);
      addStat(this, "sanity", 4);
    } else {
      // Fixed commitments still cost Energy like work days.
      const fixedWork = fx.parts.courses + fx.parts.ta + fx.parts.meetings + fx.parts.defense;
      for (let i = 0; i < fixedWork; i++) addStat(this, "energy", this.roll(cfg.energy.workday));
      for (let i = 0; i < fx.parts.family; i++) this.applyDay("family", eff, false, tally);
      if (fx.parts.courses) addStat(this, "knowledge", 0.3 * fx.parts.courses);
      if (fx.parts.defense) {
        s.readiness += 0.5 * fx.parts.defense;
        addStat(this, "writing", 0.2 * fx.parts.defense);
        addStat(this, "presenting", 0.2 * fx.parts.defense);
      }
      const a = this.allocate(free);
      const planKey = JSON.stringify(s.routine.days) + ":" + free;
      if (a.squeezed > 0 && s.squeezeKey !== planKey) this.log("Your plan didn't fit: " + a.squeezed + " planned days got squeezed out. Adjust your routine to choose what gives.");
      s.squeezeKey = a.squeezed > 0 ? planKey : null;
      const nProj = Object.keys(a.alloc).filter(function (k) { return k.indexOf("p:") === 0 && a.alloc[k] > 0; }).length;
      const effP = nProj > 2 ? eff * (1 - cfg.progress.switch_penalty * (nProj - 2)) : eff;
      Object.keys(a.alloc).forEach(function (k) {
        for (let i = 0; i < a.alloc[k]; i++) self.applyDay(k, k.indexOf("p:") === 0 ? effP : eff, false, tally);
      });
      const ot = fx.overtimeAllowed ? Math.min(4, s.routine.overtime || 0) : 0;
      for (let i = 0; i < ot; i++) this.applyDay(s.routine.overtimeTarget || "read", eff, true, tally);
      for (let i = 0; i < 4 - ot; i++) {
        addStat(this, "energy", this.roll(cfg.energy.weekend_off));
        addStat(this, "sanity", cfg.sanity.weekend_off);
        addStat(this, "friends_rel", 0.5);
        tally.self++; tally.social++;
      }
    }
    addStat(this, "energy", cfg.energy.baseline);
    addStat(this, "sanity", -(cfg.sanity.pressure || 0));

    // Passive effects.
    const tl = s.telemetry;
    tl.overtime_days += tally.overtime;
    tl.overtime_streak = tally.overtime >= 2 ? tl.overtime_streak + 1 : 0;
    tl.days_off_streak = tally.self === 0 ? tl.days_off_streak + 1 : 0;
    s.isolation = tally.social === 0 ? (s.isolation || 0) + 1 : 0;
    if (s.isolation >= cfg.sanity.isolation_turns) addStat(this, "sanity", this.roll(cfg.sanity.isolation_hit) * (hasTrait(this, "social_butterfly") ? 1.3 : 1));
    s.noExercise = tally.exercise === 0 ? (s.noExercise || 0) + 1 : 0;
    if (hasTrait(this, "gym_rat") && s.noExercise >= 3) addStat(this, "sanity", -2);
    const inPerson = s.advisor && !hasStatus(this, "at_conference") && !hasStatus(this, "on_internship") && !hasStatus(this, "sick") && !hasStatus(this, "on_leave");
    if (inPerson && s.advisor.archetype === "kind_funded") {
      addStat(this, "sanity", this.roll("+2±1"));
      addStat(this, "labmates_rel", 0.3);
      tl.lab_meetings_in_person++;
    }
    if (s.advisor) {
      if (s.advisor.archetype === "micromanager") addStat(this, "sanity", -1);
      if (s.advisor.archetype === "famous_absent") addStat(this, "network", 0.4);
      const projDays = Object.keys(tally.projects).length;
      if (activeProjects(this).length && !projDays && !hasStatus(this, "on_internship")) addStat(this, "advisor_rel", -0.6);
      else if (projDays) addStat(this, "advisor_rel", 0.2);
    }
    if (hasTrait(this, "cat_person")) addStat(this, "sanity", 1);
    if (hasTrait(this, "optimist")) addStat(this, "sanity", 1);
    if (hasTrait(this, "burnout_survivor")) addStat(this, "sanity", 0.5);
    if (hasStatus(this, "post_rejection_blues")) addStat(this, "sanity", -2);
    if (hasStatus(this, "deadline_mode")) addStat(this, "sanity", hasTrait(this, "deadline_junkie") ? -3 : -2);
    if (hasStatus(this, "in_love")) addStat(this, "sanity", 2);
    if (tally.overtime === 0) addStat(this, "health", cfg.health.calm_turn);

    // Health and burnout.
    const t = tOf(s.turn);
    let sickP = cfg.health.sick_base + cfg.health.sick_per_point * (100 - s.stats.health);
    if (t >= cfg.health.flu_season[0] && t <= cfg.health.flu_season[1]) sickP *= 2;
    if (!hasStatus(this, "sick") && this.rng.chance(sickP)) {
      addStatus(this, "sick", 2);
      addStat(this, "energy", -20);
      this.log("You catch something nasty. Next turn will be slow.");
    }
    if (s.stats.sanity <= 0 && !hasStatus(this, "burnout")) {
      addStatus(this, "burnout", cfg.sanity.burnout_turns + 1);
      tl.burnouts++;
      s.stats.sanity = 15;
      s.pendingNotices = (s.pendingNotices || []).concat([{ title: "Burnout", text: "You hit empty. For the next few turns you'll work half as much, and overtime is off the table. Rest. This happens to more people than will ever say so." }]);
    }
    if (s.stats.energy < 20 && !s.warnedEnergy) {
      s.warnedEnergy = true;
      s.pendingNotices = (s.pendingNotices || []).concat([{ title: "Running on fumes", text: "Energy is very low, so every day gets less done. Rest days and weekends off refill it." }]);
    } else if (s.stats.energy > 50) s.warnedEnergy = false;
    if (s.stats.sanity < 25 && !s.warnedSanity && !hasStatus(this, "burnout")) {
      s.warnedSanity = true;
      s.pendingNotices = (s.pendingNotices || []).concat([{ title: "Sanity is low", text: "Friends, hobbies and family days restore Sanity. At zero you burn out." }]);
    } else if (s.stats.sanity > 45) s.warnedSanity = false;

    tickProjects(this, function (l) { self.log(l); });
    finishSubmissions(this);
    rollMissedDeadlines(this);
    s.projects.forEach(function (p) { p.days = 0; });
    accrueCitations(this);
    if (t === 26) yearlyLabmates(this, function (l) { self.log(l); });
    this.maybeTip();
    tl.turns++;
    checkAchievements(this);

    const lines = s.log.slice(s.turnLogStart || 0);
    if (!lines.length || this.rng.chance(0.25)) {
      const f = flavorLine(this);
      if (f) this.log(f, "flavor");
    }
    const summary = {
      turn: s.turn,
      energy: [Math.round(before.energy), Math.round(s.stats.energy)],
      sanity: [Math.round(before.sanity), Math.round(s.stats.sanity)],
      citations: [before.cites, totalCitations(this)],
      lines: s.log.slice(s.turnLogStart || 0)
    };
    s.turn++;
    s.stage = "turn_start";
    if (s.turn >= (cfg.max_year || 8) * TURNS && !s.milestones.graduated && !s.milestones.graduateAt && !s.pendingEnding) {
      s.pendingEnding = "eternal_student";
    }
    return summary;
  }

  maybeTip() {
    const s = this.state;
    if (s.turn - s.lastTipTurn < (this.D.config.tip_spacing || 6)) return;
    const self = this;
    const tips = this.D.tips.filter(function (tp) { return !s.tipsShown[tp.id] && self.D.phd101[tp.topic] && (!tp.when || check(tp.when, self, {})); });
    if (!tips.length) return;
    const tip = this.rng.pick(tips);
    s.tipsShown[tip.id] = true;
    s.lastTipTurn = s.turn;
    const ep = this.D.phd101[tip.topic];
    const senior = s.labmates.filter(function (l) { return l.present !== false; }).sort(function (a, b) { return b.year - a.year; })[0];
    this.log((senior ? senior.name : "A senior student") + ": “" + tip.text + "”", "tip", { title: ep.title, url: ep.url, topic: tip.topic });
  }
}
