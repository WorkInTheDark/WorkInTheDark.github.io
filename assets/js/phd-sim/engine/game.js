// The turn engine. Each turn: start-of-turn happenings (reviews, milestones, matching), then
// the player's plan for the two weeks, then the turn plays out, maybe an event, and a report.
// step() advances to the next thing that needs the player; everything lives in serializable state.
import { Rng } from "./rng.js";
import { clamp, parseValue } from "./util.js";
import { TURNS, yearOf, tOf, semesterOf, semesterKey, ACTIVITY_BY_ID, ACTIVITIES, STAT_LABELS } from "./state.js";
import { hasStatus, hasTrait, totalCitations, firstAuthorPubs } from "./derived.js";
import { check } from "./conditions.js";
import { addStat, addStatus, removeStatus } from "./effects.js";
import { drawHook, fireHook, presentEvent, resolveEvent, flavorLine } from "./events.js";
import { activeProjects, workDay, tickProjects, autoTarget, setTarget, currentStage, stageNeed, withdrawRevision, rollMissedDeadlines, STAGE_LABELS } from "./projects.js";
import { accrueCitations } from "./citations.js";
import { yearlyLabmates } from "./people.js";
import { tickWorld } from "./world.js";
import { checkAchievements } from "./achievements.js";
import { finalize } from "./endings.js";
import { resolveRebuttal } from "./reviews.js";
import {
  buildSys, handleSys, answerMatching, answerQa, answerNewProject, newProjectPrompt, leavePrompt,
  queueMilestones, queuePapers, finishSubmissions, createProject, planExtras, applyPlanExtra
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
    if (s.player.traits.indexOf("head_start") >= 0) {
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
      if (s.stage === "turn_start") { this.startTurn(); s.stage = "start_items"; continue; }
      if (s.stage === "start_items" || s.stage === "end_items") {
        const queue = s.stage === "start_items" ? s.turnItems : s.endItems;
        if (queue.length) {
          const item = queue.shift();
          const p = item.kind === "event" ? presentEvent(this, item) : buildSys(this, item);
          if (p) { s.prompt = p; this.save(); return p; }
          continue;
        }
        if (s.stage === "start_items") { s.stage = "plan"; this.save(); continue; }
        const report = this.finishTurn();
        s.stage = "turn_start";
        this.save();
        if (s.pendingEnding) continue;
        return { type: "turn_end", report: report };
      }
      if (s.stage === "plan") return this.planPrompt();
      if (s.stage === "resolve") { this.resolveTurn(); s.stage = "end_items"; continue; }
      s.stage = "turn_start";
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
    if (s.prompt || s.phase === "ended" || s.stage !== "plan" || !s.advisor) return null;
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

  setTarget(projectId, venueId) {
    const p = this.state.projects.find(function (x) { return x.id === projectId; });
    if (p && p.status === "active" && !(p.target && (p.target.rrPaper || p.target.journalPaper))) setTarget(this, p, venueId);
    this.save();
  }

  shelveProject(projectId) {
    const p = this.state.projects.find(function (x) { return x.id === projectId; });
    if (p && p.status === "active") { withdrawRevision(this, p); p.status = "shelved"; this.log("You shelve \u201c" + p.short + "\u201d."); }
    this.save();
  }

  // ---- Planning ------------------------------------------------------------

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
    const total = f.courses + f.ta + f.meetings + f.defense + f.family + f.internship;
    const adj = s.stage === "turn_start" ? s.dayAdjNext : s.dayAdj;
    let free = Math.max(0, 10 - total + adj);
    const sick = hasStatus(this, "sick");
    if (sick) free = Math.max(0, free - 5);
    const burnout = hasStatus(this, "burnout");
    if (burnout) free = Math.floor(free / 2);
    if (hasStatus(this, "on_internship")) free = 0;
    const per = (this.D.config.turn && this.D.config.turn.days_per_choice) || 2;
    return {
      parts: f, total: total, adj: adj, sick: sick, burnout: burnout, free: free,
      slots: Math.floor(free / per), perChoice: per,
      weekendAllowed: !burnout && !hasStatus(this, "on_leave")
    };
  }

  actionList() {
    const s = this.state;
    const self = this;
    const out = [];
    const onLeave = hasStatus(this, "on_leave");
    if (!onLeave) {
      activeProjects(this).forEach(function (p) {
        const st = currentStage(self, p);
        const pct = st.kind === "wait" ? null : Math.min(100, Math.round(p.progress / stageNeed(self, p) * 100));
        out.push({
          id: "p:" + p.id, kind: "project", label: "Work on \u201c" + p.short + "\u201d",
          desc: STAGE_LABELS[st.id] + (st.kind === "wait" ? ": waiting (about " + Math.max(1, p.wait) + " more turns). Working on it now does little." : " " + pct + "%"),
          arrows: st.kind === "wait" ? [{ stat: "energy", dir: "down", strength: 1 }] :
            [{ stat: "energy", dir: "down", strength: 1 }, { stat: "progress", dir: "up", strength: 1 }, { stat: st.skill, dir: "up", strength: 1 }],
          max: 5
        });
      });
    }
    ACTIVITIES.forEach(function (a) {
      if (onLeave && a.kind === "work") return;
      if (a.id === "mentor" && !s.mentee && !s.flags.has_undergrad_mentee) return;
      out.push({ id: a.id, kind: a.kind, label: a.label, desc: a.desc, arrows: a.arrows, max: 5 });
    });
    planExtras(this).forEach(function (x) {
      if (x.slot) out.push({ id: x.id, kind: "apply", label: x.label, desc: x.desc, arrows: x.arrows || [], max: 1 });
    });
    return out;
  }

  planPrompt() {
    const s = this.state;
    const fx = this.fixedDays();
    const actions = this.actionList();
    const extras = planExtras(this).filter(function (x) { return !x.slot; });
    const valid = {};
    actions.forEach(function (a) { valid[a.id] = a.max; });
    let last = null;
    if (s.lastPlan && s.lastPlan.picks) {
      last = {};
      let left = fx.slots;
      Object.keys(s.lastPlan.picks).forEach(function (k) {
        if (!valid[k] || left <= 0 || k.indexOf("apply_") === 0) return;
        const n = Math.min(s.lastPlan.picks[k], valid[k], left);
        if (n > 0) { last[k] = n; left -= n; }
      });
      if (!Object.keys(last).length) last = null;
    }
    const workTargets = actions.filter(function (a) { return a.kind === "project" || a.id === "read" || a.id === "career"; })
      .map(function (a) { return { id: a.id, label: a.label }; });
    return {
      type: "plan",
      turn: s.turn,
      slots: fx.slots,
      days: fx,
      actions: actions,
      extras: extras,
      weekend: { allowed: fx.weekendAllowed && workTargets.length > 0, targets: workTargets },
      last: last,
      internship: hasStatus(this, "on_internship"),
      onLeave: hasStatus(this, "on_leave"),
      canStartProject: !!s.advisor && !s.milestones.graduated && activeProjects(this).length < (this.D.config.progress.max_active_projects || 4)
    };
  }

  // plan: { picks: { actionId: count }, weekend: actionId | "off", extras: { extraId: { preprint } } }
  submitPlan(plan) {
    const s = this.state;
    if (s.stage !== "plan" || s.prompt) return false;
    const opts = this.planPrompt();
    const valid = {};
    opts.actions.forEach(function (a) { valid[a.id] = a.max; });
    const picks = {};
    let left = opts.slots;
    Object.keys((plan && plan.picks) || {}).forEach(function (k) {
      const n = Math.min(parseInt(plan.picks[k], 10) || 0, valid[k] || 0, left);
      if (n > 0) { picks[k] = n; left -= n; }
    });
    const extras = {};
    const extraIds = opts.extras.map(function (x) { return x.id; });
    Object.keys((plan && plan.extras) || {}).forEach(function (k) {
      if (extraIds.indexOf(k) >= 0 && plan.extras[k]) extras[k] = plan.extras[k] === true ? {} : plan.extras[k];
    });
    const weekend = opts.weekend.allowed && plan && plan.weekend && opts.weekend.targets.some(function (t) { return t.id === plan.weekend; }) ? plan.weekend : "off";
    s.plan = { picks: picks, weekend: weekend, extras: extras };
    s.lastPlan = { picks: picks, weekend: weekend };
    s.stage = "resolve";
    this.save();
    return true;
  }

  // ---- Turn phases ---------------------------------------------------------

  snapshot() {
    const s = this.state;
    const self = this;
    const projects = {};
    s.projects.forEach(function (p) {
      const st = currentStage(self, p);
      projects[p.id] = { status: p.status, stage: st.id, pct: st.kind === "wait" ? null : Math.min(100, Math.round(p.progress / stageNeed(self, p) * 100)) };
    });
    return {
      stats: { energy: s.stats.energy, sanity: s.stats.sanity, taste: s.stats.taste, coding: s.stats.coding, writing: s.stats.writing, presenting: s.stats.presenting, knowledge: s.stats.knowledge },
      citations: totalCitations(this),
      pubs: firstAuthorPubs(this),
      projects: projects
    };
  }

  startTurn() {
    const s = this.state;
    const self = this;
    s.dayAdj = s.dayAdjNext;
    s.dayAdjNext = 0;
    s.turnLogStart = s.log.length;
    s.newAchievements = [];
    s.turnItems = [];
    s.endItems = [];
    s.plan = null;
    s.before = this.snapshot();
    const managed = ["coursework", "ta", "fellowship"];
    s.statuses.forEach(function (st) { if (managed.indexOf(st.id) < 0) st.turns--; });
    const expired = s.statuses.filter(function (st) { return st.turns <= 0 && managed.indexOf(st.id) < 0; });
    s.statuses = s.statuses.filter(function (st) { return !(st.turns <= 0 && managed.indexOf(st.id) < 0); });
    expired.forEach(function (st) {
      if (st.id === "burnout" && s.player.traits.indexOf("burnout_survivor") < 0) {
        s.player.traits.push("burnout_survivor");
        self.log("You come back from burnout knowing your limits a little better. New trait: Burnout Survivor.", "news");
      }
    });
    this.updateCalendarStatuses();

    // Things that need you before you plan: matching, milestones, reviews, offers.
    let items = [];
    items = items.concat(queueMilestones(this));
    items = items.concat(queuePapers(this));
    if (s.milestones.graduated && !s.pendingEnding && !items.some(function (it) { return it.sys === "final_offers"; })) {
      items.push({ kind: "sys", sys: "final_offers" });
    }
    s.turnItems = s.turnItems.concat(items);

    // Things that happen during the two weeks, after you plan.
    tickWorld(this, function (l) { self.log(l, "news"); }).forEach(function (h) {
      fireHook(self, h.hook, h.ctx).forEach(function (it) { s.endItems.push(it); });
    });
    s.pendingHooks.forEach(function (h) { fireHook(self, h.hook, h.ctx).forEach(function (it) { s.endItems.push(it); }); });
    s.pendingHooks = [];
    const due = s.queue.filter(function (q) { return q.turn <= s.turn; });
    s.queue = s.queue.filter(function (q) { return q.turn > s.turn; });
    due.forEach(function (q) { s.endItems.push({ kind: "event", id: q.event, ctx: q.ctx || {}, scheduled: true }); });
    if (hasStatus(this, "on_internship") && s.internship && s.internship.accepted) {
      fireHook(this, "internship", { company: s.internship.accepted.company }).forEach(function (it) { s.endItems.push(it); });
    }
    if (hasStatus(this, "defense_prep")) fireHook(this, "defense_prep", {}).forEach(function (it) { s.endItems.push(it); });
    if (hasStatus(this, "job_market")) fireHook(this, "job_market", {}).forEach(function (it) { s.endItems.push(it); });
  }

  resolveTurn() {
    const s = this.state;
    const cfg = this.D.config;
    const self = this;
    const plan = s.plan || { picks: {}, weekend: "off", extras: {} };
    const tally = { work: 0, self: 0, social: 0, exercise: 0, overtime: 0, projects: {} };

    // Milestone choices and submissions first (deadline mode changes how the turn goes).
    Object.keys(plan.extras || {}).forEach(function (id) { applyPlanExtra(self, id, plan.extras[id]); });
    Object.keys(plan.picks || {}).forEach(function (id) { if (id.indexOf("apply_") === 0) applyPlanExtra(self, id, {}); });

    const fx = this.fixedDays();
    let eff = clamp(cfg.energy.efficiency_floor + cfg.energy.efficiency_slope * s.stats.energy, cfg.energy.efficiency_floor, 1);
    if (s.stats.sanity < cfg.sanity.low) eff *= cfg.sanity.low_efficiency;
    if (hasStatus(this, "jet_lagged")) eff *= 0.8;
    if (hasStatus(this, "post_rejection_blues")) eff *= 0.9;
    if (hasStatus(this, "deadline_mode")) eff *= hasTrait(this, "deadline_junkie") ? 1.25 : 1.15;
    if (hasStatus(this, "in_the_zone")) eff *= 1.2;
    if (hasStatus(this, "in_love")) eff *= 0.9;
    if (hasTrait(this, "early_bird")) eff *= 1.05;
    if (hasTrait(this, "parent")) eff *= 1.1;

    if (hasStatus(this, "on_internship")) {
      for (let i = 0; i < 10; i++) addStat(this, "energy", this.roll(cfg.energy.workday));
      addStat(this, "coding", 1.5);
      addStat(this, "network", 1.2);
      addStat(this, "presenting", 0.3);
      addStat(this, "sanity", 2);
      tally.work += 10;
    } else {
      // Fixed commitments cost Energy like work days.
      const fixedWork = fx.parts.courses + fx.parts.ta + fx.parts.meetings + fx.parts.defense;
      for (let i = 0; i < fixedWork; i++) addStat(this, "energy", this.roll(cfg.energy.workday));
      for (let i = 0; i < fx.parts.family; i++) this.applyDay("family", eff, false, tally);
      if (fx.parts.courses) addStat(this, "knowledge", 0.3 * fx.parts.courses);
      if (fx.parts.defense) {
        s.readiness += 0.5 * fx.parts.defense;
        addStat(this, "writing", 0.2 * fx.parts.defense);
        addStat(this, "presenting", 0.2 * fx.parts.defense);
      }
      const per = fx.perChoice;
      const nProj = Object.keys(plan.picks).filter(function (k) { return k.indexOf("p:") === 0; }).length;
      const effP = nProj > 2 ? eff * (1 - cfg.progress.switch_penalty * (nProj - 2)) : eff;
      let used = 0;
      Object.keys(plan.picks).forEach(function (k) {
        const days = plan.picks[k] * per;
        used += days;
        const dayKey = k.indexOf("apply_") === 0 ? "career" : k;
        for (let i = 0; i < days; i++) self.applyDay(dayKey, dayKey.indexOf("p:") === 0 ? effP : eff, false, tally);
      });
      // Whatever is left over (an odd day, or choices you didn't use) becomes rest.
      for (let i = used; i < fx.free; i++) this.applyDay("rest", eff, false, tally);
      if (hasTrait(this, "caffeine_powered") && s.stats.energy < 40) { addStat(this, "health", -1); }
    }
    // Weekends: off, or two days of overtime on one thing.
    const ot = plan.weekend && plan.weekend !== "off" ? 2 : 0;
    for (let i = 0; i < ot; i++) this.applyDay(plan.weekend, eff, true, tally);
    for (let i = 0; i < 4 - ot; i++) {
      addStat(this, "energy", this.roll(cfg.energy.weekend_off));
      addStat(this, "sanity", cfg.sanity.weekend_off);
      addStat(this, "friends_rel", 0.5);
      tally.self++; tally.social++;
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
    if (hasStatus(this, "on_leave")) addStat(this, "sanity", 4);
    if (tally.overtime === 0) addStat(this, "health", cfg.health.calm_turn);

    // Health and burnout.
    const t = tOf(s.turn);
    let sickP = cfg.health.sick_base + cfg.health.sick_per_point * (100 - s.stats.health);
    if (t >= cfg.health.flu_season[0] && t <= cfg.health.flu_season[1]) sickP *= 2;
    if (!hasStatus(this, "sick") && this.rng.chance(sickP)) {
      addStatus(this, "sick", 2);
      addStat(this, "energy", -20);
      this.log("You catch something nasty. Next turn will be slow.", "bad");
    }
    if (s.stats.sanity <= 0 && !hasStatus(this, "burnout")) {
      addStatus(this, "burnout", cfg.sanity.burnout_turns + 1);
      tl.burnouts++;
      s.stats.sanity = 15;
      this.log("Burnout. You hit empty. For the next few turns you'll have half the choices and no weekend work. Rest. This happens to more people than will ever say so.", "bad");
    }
    if (s.stats.energy < 20 && !s.warnedEnergy) {
      s.warnedEnergy = true;
      this.log("You're running on fumes: with Energy this low, everything gets less done. Rest and weekends off refill it.", "bad");
    } else if (s.stats.energy > 50) s.warnedEnergy = false;
    if (s.stats.sanity < 25 && !s.warnedSanity && !hasStatus(this, "burnout")) {
      s.warnedSanity = true;
      this.log("Sanity is low. Friends, hobbies, exercise and family restore it; at zero you burn out.", "bad");
    } else if (s.stats.sanity > 45) s.warnedSanity = false;

    // Maybe one random event, less likely when something else already happened this turn.
    const busy = s.endItems.some(function (it) { return it.kind === "event"; }) ||
      s.log.slice(s.turnLogStart || 0).some(function (e) { return e.kind === "good" || e.kind === "bad"; });
    const ev = cfg.events;
    if (this.rng.chance(busy ? (ev.busy_turn_event_chance || 0.08) : (ev.turn_event_chance || 0.3))) {
      drawHook(this, "turn", {}, 1).forEach(function (it) { s.endItems.push(it); });
    }
  }

  finishTurn() {
    const s = this.state;
    const cfg = this.D.config;
    const self = this;
    const t = tOf(s.turn);
    tickProjects(this, function (l) { self.log(l); });
    finishSubmissions(this);
    rollMissedDeadlines(this);
    s.projects.forEach(function (p) { p.days = 0; });
    accrueCitations(this);
    if (t === 26) yearlyLabmates(this, function (l) { self.log(l); });
    this.maybeTip();
    s.telemetry.turns++;
    checkAchievements(this);
    const lines = s.log.slice(s.turnLogStart || 0);
    if (!lines.length || this.rng.chance(0.25)) {
      const f = flavorLine(this);
      if (f) this.log(f, "flavor");
    }
    const report = this.buildReport();
    s.report = report;
    s.turn++;
    s.stage = "turn_start";
    if (s.turn >= (cfg.max_year || 8) * TURNS && !s.milestones.graduated && !s.milestones.graduateAt && !s.pendingEnding) {
      s.pendingEnding = "eternal_student";
    }
    return report;
  }

  buildReport() {
    const s = this.state;
    const self = this;
    const before = s.before || this.snapshot();
    const after = this.snapshot();
    const deltas = [];
    ["energy", "sanity", "taste", "coding", "writing", "presenting", "knowledge"].forEach(function (k) {
      const a = Math.round(before.stats[k]), b = Math.round(after.stats[k]);
      if (a !== b) deltas.push({ stat: k, label: STAT_LABELS[k], from: a, to: b });
    });
    if (after.citations !== before.citations) deltas.push({ stat: "citations", label: "Citations", from: before.citations, to: after.citations });
    const projects = [];
    s.projects.forEach(function (p) {
      const a = before.projects[p.id], b = after.projects[p.id];
      if (!b) return;
      const label = function (x) { return x ? STAGE_LABELS[x.stage] + (x.pct === null ? " (waiting)" : " " + x.pct + "%") : "new"; };
      if (!a || a.stage !== b.stage || a.pct !== b.pct || a.status !== b.status) {
        projects.push({ short: p.short, from: label(a), to: b.status === "submitted" ? "Submitted" : b.status === "done" ? "Published" : label(b) });
      }
    });
    return {
      turn: s.turn,
      plan: s.plan,
      deltas: deltas,
      projects: projects,
      news: s.log.slice(s.turnLogStart || 0)
    };
  }

  // ---- Days ------------------------------------------------------------------

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
