// The turn engine. Each turn is one week: start-of-week happenings (reviews, milestones, matching,
// maybe an event, and any "this week only" options), then the player picks one thing to do, the
// week plays out, and a report.
// step() advances to the next thing that needs the player; everything lives in serializable state.
import { Rng } from "./rng.js";
import { clamp, parseValue } from "./util.js";
import { TURNS, yearOf, tOf, wOf, firstWeek, weeks, perWeek, semesterOf, semesterKey, ACTIVITY_BY_ID, ACTIVITIES, DEFAULT_ACTIONS, STAT_LABELS } from "./state.js";
import { hasStatus, hasTrait, totalCitations, firstAuthorPubs } from "./derived.js";
import { check } from "./conditions.js";
import { addStat, addStatus, removeStatus, applyOutcome } from "./effects.js";
import { fill } from "./templating.js";
import { arrowsFor } from "./events.js";
import { drawHook, fireHook, presentEvent, resolveEvent, flavorLine } from "./events.js";
import { activeProjects, workDay, tickProjects, autoTarget, setTarget, currentStage, stageNeed, withdrawRevision, rollMissedDeadlines, STAGE_LABELS, writingCompletion, deadlineLabel } from "./projects.js";
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

const WORK_DAYS = ["read", "network", "help", "mentor", "career", "project", "writing_day"];
const ACTION_EXTRAS = ["apply_internship", "apply_fellowship", "proposal", "defense", "job_market"];

function oppArrows(def) {
  const base = (ACTIVITY_BY_ID[def.days || "rest"] || { arrows: [] }).arrows || [];
  const extra = arrowsFor(def);
  const out = [];
  base.concat(extra).forEach(function (a) { if (!out.some(function (b) { return b.stat === a.stat; })) out.push(a); });
  if (def.days === "project") out.unshift({ stat: "progress", dir: "up", strength: (def.boost || 1) > 1.2 ? 2 : 1 });
  return out;
}

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
    if (hasStatus(this, "on_internship")) f.internship = 5;
    else if (!hasStatus(this, "on_leave")) {
      if (hasStatus(this, "coursework")) f.courses = perWeek(yearOf(s.turn) === 1 ? cfg.courses_y1 : cfg.courses_y2, s.turn);
      if (hasStatus(this, "ta")) f.ta = perWeek((t === 8 || t === 18) ? cfg.ta_peak : cfg.ta, s.turn);
      if (s.advisor) f.meetings = perWeek(s.advisor.archetype === "micromanager" ? 2 : cfg.meetings, s.turn);
      if (hasStatus(this, "defense_prep")) f.defense = perWeek(cfg.defense_prep, s.turn);
      if (hasTrait(this, "parent")) f.family = 1;
    }
    const total = f.courses + f.ta + f.meetings + f.defense + f.family + f.internship;
    const adj = s.stage === "turn_start" ? s.dayAdjNext : s.dayAdj;
    let free = Math.max(0, 5 - total + adj);
    const sick = hasStatus(this, "sick");
    if (sick) free = Math.max(0, free - 3);
    const burnout = hasStatus(this, "burnout");
    if (burnout) free = Math.floor(free / 2);
    if (hasStatus(this, "on_internship")) free = 0;
    return { parts: f, total: total, adj: adj, sick: sick, burnout: burnout, free: free };
  }

  // Everything you could do this week. You pick exactly one, and the week plays out.
  actionList() {
    const s = this.state;
    const self = this;
    const out = [];
    const onLeave = hasStatus(this, "on_leave");
    const fx = this.fixedDays();
    if (hasStatus(this, "on_internship")) {
      const co = s.internship && s.internship.accepted ? s.internship.accepted.company : "the internship";
      out.push({ id: "intern_all", kind: "core", label: "Give " + co + " your all", desc: "Long days, big impression. Skills and network grow faster.",
        arrows: [{ stat: "energy", dir: "down", strength: 1 }, { stat: "coding", dir: "up", strength: 1 }] });
      out.push({ id: "intern_pace", kind: "core", label: "Keep a healthy pace", desc: "Do good work and leave at six.",
        arrows: [{ stat: "sanity", dir: "up", strength: 1 }, { stat: "coding", dir: "up", strength: 1 }] });
      activeProjects(this).slice(0, 2).forEach(function (p) {
        out.push({ id: "intern_weekend:" + p.id, kind: "core", label: "Spend the weekend on “" + p.short + "”", desc: "Your own research doesn't stop for the summer.",
          arrows: [{ stat: "energy", dir: "down", strength: 2 }, { stat: "progress", dir: "up", strength: 1 }] });
      });
    } else if (!onLeave) {
      activeProjects(this).forEach(function (p) {
        const st = currentStage(self, p);
        const pct = st.kind === "wait" ? null : Math.min(100, Math.round(p.progress / stageNeed(self, p) * 100));
        const ttd = p.target && p.target.turn !== null && p.target.turn !== undefined ? p.target.turn - s.turn : null;
        if (ttd === 0 && planExtras(self).some(function (x) { return x.id === "submit:" + p.id; })) {
          const pctW = Math.round(writingCompletion(self, p) * 100);
          out.push({ id: "submit:" + p.id, kind: "deadline", label: "Polish and submit “" + p.short + "” to " + deadlineLabel(self, p),
            desc: "Deadline this week. The draft is " + pctW + "% written; it needs at least half by the end of the week.",
            arrows: [{ stat: "energy", dir: "down", strength: 1 }, { stat: "progress", dir: "up", strength: 1 }, { stat: "writing", dir: "up", strength: 1 }] });
          return;
        }
        out.push({ id: "p:" + p.id, kind: "project", label: "Work on “" + p.short + "”",
          desc: STAGE_LABELS[st.id] + (st.kind === "wait" ? ": waiting (about " + Math.max(1, p.wait) + " more weeks). Working on it now does little." : " " + pct + "%") +
            (ttd !== null && ttd > 0 && ttd <= 6 ? ". " + deadlineLabel(self, p) + " deadline in " + ttd + (ttd === 1 ? " week" : " weeks") + "." : ""),
          arrows: st.kind === "wait" ? [{ stat: "energy", dir: "down", strength: 1 }] :
            [{ stat: "energy", dir: "down", strength: 1 }, { stat: "progress", dir: "up", strength: 1 }, { stat: st.skill, dir: "up", strength: 1 }] });
        if (ttd !== null && ttd >= 1 && ttd <= 2 && st.kind !== "wait" && !fx.burnout) {
          out.push({ id: "crunch:" + p.id, kind: "deadline", label: "Crunch on “" + p.short + "”, weekend included",
            desc: "Deadline in " + ttd + (ttd === 1 ? " week" : " weeks") + ". Every day of the week and the weekend.",
            arrows: [{ stat: "energy", dir: "down", strength: 2 }, { stat: "sanity", dir: "down", strength: 1 }, { stat: "progress", dir: "up", strength: 2 }] });
        }
      });
      planExtras(this).forEach(function (x) {
        if (x.kind === "submit") return;
        out.push({ id: x.id, kind: "milestone", label: x.label, desc: x.desc, arrows: x.arrows || [] });
      });
      DEFAULT_ACTIONS.forEach(function (a) { out.push({ id: a.id, kind: "core", label: a.label, desc: a.desc, arrows: a.arrows }); });
    } else {
      out.push({ id: "recharge", kind: "core", label: "Recharge", desc: "You're on leave. Rest is the job.", arrows: [{ stat: "energy", dir: "up", strength: 2 }, { stat: "sanity", dir: "up", strength: 1 }] });
    }
    // This week only: opportunities that came up, and anything an event unlocked.
    (s.weekOpps || []).forEach(function (o) {
      const def = self.D.opportunityById[o.id];
      if (!def) return;
      if (onLeave && WORK_DAYS.indexOf(def.days || "rest") >= 0) return;
      out.push({ id: "opp:" + o.id, kind: "opportunity", label: fill(def.label, self, o.ctx), desc: fill(def.reason || def.desc || "", self, o.ctx), arrows: oppArrows(def) });
    });
    return out;
  }

  planPrompt() {
    const s = this.state;
    const fx = this.fixedDays();
    return {
      type: "plan",
      turn: s.turn,
      days: fx,
      actions: this.actionList(),
      internship: hasStatus(this, "on_internship"),
      onLeave: hasStatus(this, "on_leave"),
      canStartProject: !!s.advisor && !s.milestones.graduated && !hasStatus(this, "on_leave") &&
        activeProjects(this).length < (this.D.config.progress.max_active_projects || 4)
    };
  }

  // plan: { action: actionId }. One choice per week; the week resolves right away.
  submitPlan(plan) {
    const s = this.state;
    if (s.stage !== "plan" || s.prompt) return false;
    const list = this.actionList();
    const ids = list.map(function (a) { return a.id; });
    const action = plan && ids.indexOf(plan.action) >= 0 ? plan.action : (ids.indexOf("recharge") >= 0 ? "recharge" : ids[0]);
    s.plan = { action: action, label: list[ids.indexOf(action)].label };
    s.lastPlan = { action: action };
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

    // Everything that happens to you this week comes before you choose what to do.
    let items = [];
    items = items.concat(queueMilestones(this));
    items = items.concat(queuePapers(this));
    if (s.milestones.graduated && !s.pendingEnding && !items.some(function (it) { return it.sys === "final_offers"; })) {
      items.push({ kind: "sys", sys: "final_offers" });
    }
    tickWorld(this, function (l) { self.log(l, "news"); }).forEach(function (h) {
      fireHook(self, h.hook, h.ctx).forEach(function (it) { items.push(it); });
    });
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
    // At most one random event, rarely: less likely when something else already happened.
    const busy = items.some(function (it) { return it.kind === "event"; }) ||
      s.log.slice(s.turnLogStart || 0).some(function (e) { return e.kind === "good" || e.kind === "bad"; });
    const ev = this.D.config.events;
    if (this.rng.chance(busy ? (ev.busy_turn_event_chance || 0.03) : (ev.turn_event_chance || 0.12))) {
      drawHook(this, "turn", {}, 1).forEach(function (it) { items.push(it); });
    }
    s.turnItems = s.turnItems.concat(items);
    this.rollOpportunities();
  }

  // Extra options that come up for this week only, plus anything an event unlocked earlier.
  rollOpportunities() {
    const s = this.state;
    const self = this;
    const max = (this.D.config.opportunities && this.D.config.opportunities.max_per_week) || 2;
    const picks = [];
    (s.unlocks || []).filter(function (u) { return u.turn === s.turn; }).forEach(function (u) { picks.push({ id: u.id, ctx: u.ctx || {} }); });
    s.unlocks = (s.unlocks || []).filter(function (u) { return u.turn > s.turn; });
    const cands = this.rng.shuffle(this.D.opportunities);
    for (let i = 0; i < cands.length && picks.length < max; i++) {
      const o = cands[i];
      if (picks.some(function (x) { return x.id === o.id; })) continue;
      if (o.once && s.seen["opp:" + o.id] !== undefined) continue;
      if (s.seen["opp:" + o.id] !== undefined && s.turn - s.seen["opp:" + o.id] < weeks(o.cooldown || 4)) continue;
      const ctx = {};
      if (!check(o.when, this, ctx)) continue;
      if (!this.rng.chance(o.chance === undefined ? 0.05 : o.chance)) continue;
      picks.push({ id: o.id, ctx: ctx });
    }
    picks.forEach(function (o) { s.seen["opp:" + o.id] = s.turn; });
    s.weekOpps = picks;
  }

  resolveTurn() {
    const s = this.state;
    const cfg = this.D.config;
    const self = this;
    const action = (s.plan && s.plan.action) || "recharge";
    const tally = { work: 0, self: 0, social: 0, exercise: 0, overtime: 0, projects: {} };
    const K = 0.5;   // passive effects were tuned per two weeks; a turn is now one week

    // Deadlines and milestones first (deadline mode changes how the week goes).
    if (action.indexOf("submit:") === 0) applyPlanExtra(this, action, { preprint: true });
    else if (ACTION_EXTRAS.indexOf(action) >= 0) applyPlanExtra(this, action, {});
    if (action.indexOf("crunch:") === 0) addStatus(this, "deadline_mode", 1);
    let opp = null;
    if (action.indexOf("opp:") === 0) {
      const oid = action.slice(4);
      opp = { def: this.D.opportunityById[oid], ctx: ((s.weekOpps || []).find(function (o) { return o.id === oid; }) || {}).ctx || {} };
    }

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

    let weekendWork = null;
    if (hasStatus(this, "on_internship")) {
      for (let i = 0; i < 5; i++) addStat(this, "energy", this.roll(cfg.energy.workday));
      addStat(this, "coding", action === "intern_all" ? 1.4 : 0.8);
      addStat(this, "network", action === "intern_all" ? 1.2 : 0.6);
      addStat(this, "presenting", 0.2);
      if (action === "intern_all") { addStat(this, "energy", -6); addStat(this, "advisor_rel", 0); s.internshipEffort = (s.internshipEffort || 0) + 1; }
      if (action === "intern_pace") addStat(this, "sanity", 3);
      if (action.indexOf("intern_weekend:") === 0) weekendWork = "p:" + action.slice(15);
      tally.work += 5;
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
      // The week's free days all go to the one thing you chose.
      let dayKey = "recharge";
      let effD = eff;
      if (action.indexOf("p:") === 0) dayKey = action;
      else if (action.indexOf("submit:") === 0 || action.indexOf("crunch:") === 0) dayKey = "p:" + action.slice(action.indexOf(":") + 1);
      else if (ACTION_EXTRAS.indexOf(action) >= 0) dayKey = action === "apply_fellowship" || action === "proposal" || action === "defense" ? "writing_day" : "career";
      else if (action === "read") dayKey = "read";
      else if (opp && opp.def) {
        const kind = opp.def.days || "rest";
        if (kind === "project") {
          const pid = opp.ctx.projectId || (activeProjects(this)[0] || {}).id;
          dayKey = pid ? "p:" + pid : "rest";
          effD = eff * (opp.def.boost || 1);
        } else dayKey = kind === "none" ? null : kind;
      }
      if (dayKey) for (let i = 0; i < fx.free; i++) this.applyDay(dayKey, effD, false, tally);
      if (action.indexOf("crunch:") === 0) weekendWork = "p:" + action.slice(7);
      if (hasTrait(this, "caffeine_powered") && s.stats.energy < 40) addStat(this, "health", -0.5);
    }
    // Weekends: off, unless you crunched.
    const ot = weekendWork ? 2 : 0;
    for (let i = 0; i < ot; i++) this.applyDay(weekendWork, eff, true, tally);
    for (let i = 0; i < 2 - ot; i++) {
      addStat(this, "energy", this.roll(cfg.energy.weekend_off));
      addStat(this, "sanity", cfg.sanity.weekend_off);
      addStat(this, "friends_rel", 0.5);
      tally.self++; tally.social++;
    }
    if (opp && opp.def) {
      const res = applyOutcome(this, opp.def, opp.ctx);
      const line = res.text || fill(opp.def.label, this, opp.ctx) + ".";
      this.log(line, "news");
    }
    addStat(this, "energy", cfg.energy.baseline);
    addStat(this, "sanity", -(cfg.sanity.pressure || 0));

    // Passive effects (per week).
    const tl = s.telemetry;
    tl.overtime_days += tally.overtime;
    tl.overtime_streak = tally.overtime >= 1 ? tl.overtime_streak + 1 : 0;
    tl.days_off_streak = tally.self === 0 ? tl.days_off_streak + 1 : 0;
    s.isolation = tally.social === 0 ? (s.isolation || 0) + 1 : 0;
    if (s.isolation >= weeks(cfg.sanity.isolation_turns)) addStat(this, "sanity", K * this.roll(cfg.sanity.isolation_hit) * (hasTrait(this, "social_butterfly") ? 1.3 : 1));
    s.noExercise = tally.exercise === 0 ? (s.noExercise || 0) + 1 : 0;
    if (hasTrait(this, "gym_rat") && s.noExercise >= 6) addStat(this, "sanity", -1);
    const inPerson = s.advisor && !hasStatus(this, "at_conference") && !hasStatus(this, "on_internship") && !hasStatus(this, "sick") && !hasStatus(this, "on_leave");
    if (inPerson && s.advisor.archetype === "kind_funded") {
      addStat(this, "sanity", this.roll("+1±1"));
      addStat(this, "labmates_rel", 0.15);
      tl.lab_meetings_in_person++;
    }
    if (s.advisor) {
      if (s.advisor.archetype === "micromanager") addStat(this, "sanity", -K);
      if (s.advisor.archetype === "famous_absent") addStat(this, "network", 0.4 * K);
      const projDays = Object.keys(tally.projects).length;
      if (activeProjects(this).length && !projDays && !hasStatus(this, "on_internship")) addStat(this, "advisor_rel", -0.3);
      else if (projDays) addStat(this, "advisor_rel", 0.15);
    }
    if (hasTrait(this, "cat_person")) addStat(this, "sanity", K);
    if (hasTrait(this, "optimist")) addStat(this, "sanity", K);
    if (hasTrait(this, "burnout_survivor")) addStat(this, "sanity", 0.5 * K);
    if (hasStatus(this, "post_rejection_blues")) addStat(this, "sanity", -1);
    if (hasStatus(this, "deadline_mode")) addStat(this, "sanity", hasTrait(this, "deadline_junkie") ? -3 : -2);
    if (hasStatus(this, "in_love")) addStat(this, "sanity", 1);
    if (hasStatus(this, "on_leave")) addStat(this, "sanity", 2);
    if (tally.overtime === 0) addStat(this, "health", cfg.health.calm_turn * K);

    // Health and burnout.
    const t = tOf(s.turn);
    let sickP = (cfg.health.sick_base + cfg.health.sick_per_point * (100 - s.stats.health)) * K;
    if (t >= cfg.health.flu_season[0] && t <= cfg.health.flu_season[1]) sickP *= 2;
    if (!hasStatus(this, "sick") && this.rng.chance(sickP)) {
      addStatus(this, "sick", 2);
      addStat(this, "energy", -15);
      this.log("You catch something nasty. The next week or two will be slow.", "bad");
    }
    if (s.stats.sanity <= 0 && !hasStatus(this, "burnout")) {
      addStatus(this, "burnout", weeks(cfg.sanity.burnout_turns) + 1);
      tl.burnouts++;
      s.stats.sanity = 15;
      this.log("Burnout. You hit empty. For the next several weeks you'll get half as much done and can't crunch. Rest. This happens to more people than will ever say so.", "bad");
    }
    if (s.stats.energy < 20 && !s.warnedEnergy) {
      s.warnedEnergy = true;
      this.log("You're running on fumes: with Energy this low, everything gets less done. A week of recharging helps.", "bad");
    } else if (s.stats.energy > 50) s.warnedEnergy = false;
    if (s.stats.sanity < 25 && !s.warnedSanity && !hasStatus(this, "burnout")) {
      s.warnedSanity = true;
      this.log("Sanity is low. Recharging and the good things that come up (friends, trips, hobbies) restore it; at zero you burn out.", "bad");
    } else if (s.stats.sanity > 45) s.warnedSanity = false;
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
    if (wOf(s.turn) === TURNS) yearlyLabmates(this, function (l) { self.log(l); });
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
      case "recharge":
        addStat(this, "energy", this.roll(cfg.energy.rest) - 1);
        addStat(this, "sanity", this.roll("+2±1"));
        addStat(this, "friends_rel", 1);
        s.telemetry.rest_days++;
        tally.self++; tally.social++;
        break;
      case "writing_day":
        addStat(this, "writing", 0.5 * g * (1 - st.writing / 100) * 2);
        if (hasStatus(this, "defense_prep")) s.readiness += 0.5;
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
    if ((s.coauthorYears[y] || 0) >= 2 || !s.advisor || !this.rng.chance(p * 2)) return;
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
      submittedTurn: s.turn, reviewsTurn: s.turn + 10, decisionTurn: s.turn + this.rng.int(10, 18), conferenceTurn: null,
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
    if (course && (t === 1 || t === 10) && firstWeek(s.turn)) {
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
        this.log("You're a TA for " + s.taCourse + " this semester. About a day a week goes to teaching.");
      }
    }
    if (inSemester && s.ta[key]) addStatus(this, "ta", 1); else removeStatus(this, "ta");
  }

  maybeTip() {
    const s = this.state;
    if (s.turn - s.lastTipTurn < weeks(this.D.config.tip_spacing || 6)) return;
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
