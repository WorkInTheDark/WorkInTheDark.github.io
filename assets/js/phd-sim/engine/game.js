// The turn engine. Each turn is two weeks: the player picks the turn's focus (one click), then
// the turn's updates and events come up (reviews, decisions, milestones, usually one event,
// sometimes a side activity), the two weeks play out, and a report.
// step() advances to the next thing that needs the player; everything lives in serializable state.
import { Rng } from "./rng.js";
import { t, T_ } from "./i18n.js";
import { clamp, parseValue } from "./util.js";
import { TURNS, yearOf, tOf, span, WEEKS_PER_TURN, semesterOf, semesterKey, ACTIVITY_BY_ID, ACTIVITIES, DEFAULT_ACTIONS, STAT_LABELS } from "./state.js";
import { hasStatus, hasTrait, totalCitations, firstAuthorPubs } from "./derived.js";
import { check } from "./conditions.js";
import { addStat, addStatus, removeStatus, applyOutcome } from "./effects.js";
import { fill } from "./templating.js";
import { arrowsFor } from "./events.js";
import { drawHook, fireHook, presentEvent, resolveEvent, flavorLine } from "./events.js";
import { activeProjects, workDay, readTrickle, tickProjects, rollStages, autoTarget, setTarget, currentStage, stageInfo, turnChance, chanceWord, isReady, withdrawRevision, rollMissedDeadlines, STAGE_LABELS, PROJECT_TYPES, writingCompletion, deadlineLabel } from "./projects.js";
import { accrueCitations } from "./citations.js";
import { yearlyLabmates } from "./people.js";
import { tickWorld } from "./world.js";
import { checkAchievements } from "./achievements.js";
import { finalize } from "./endings.js";
import { resolveRebuttal } from "./reviews.js";
import {
  buildSys, handleSys, answerQa, leavePrompt, autoProject, newProjectStress, stressHit, rollSide, applySide,
  queueMilestones, queuePapers, finishSubmissions, createProject, planExtras, applyPlanExtra
} from "./milestones.js";

const WORK_DAYS = ["read", "network", "help", "mentor", "career", "project", "writing_day"];
// Prompts that come before the turn's focus: your first project, and decisions on your papers
// (a rejection changes what you'd plan, so you hear about it first).
const PRE_SYS = ["first_project", "decision", "quals_notice"];
// System prompts that count as one of the turn's "things that happen".
const PROMPT_SYS = ["submit", "rebuttal", "qa", "qa_result", "quals_notice", "offers", "final_offers", "internship_offer", "the_question", "decision", "conference", "fellowship_apply", "internship_apply", "job_market_start"];
const ACTION_EXTRAS = ["apply_internship", "apply_fellowship", "proposal", "defense", "job_market", "quals_prep"];

function oppArrows(def) {
  const base = (ACTIVITY_BY_ID[def.days || "rest"] || { arrows: [] }).arrows || [];
  const extra = arrowsFor(def);
  const out = [];
  base.concat(extra).forEach(function (a) { if (!out.some(function (b) { return b.stat === a.stat; })) out.push(a); });
  if (def.days === "project") out.unshift({ stat: "progress", dir: "up", strength: (def.boost || 1) > 1.2 ? 2 : 1 });
  return out;
}

const COURSES = [T_("Machine Learning"), T_("Natural Language Processing"), T_("HCI Research Methods"), T_("Statistics for Experiments"),
  T_("Deep Learning"), T_("Qualitative Methods"), T_("Algorithms"), T_("Information Retrieval"), T_("Ethics of AI")];
const TA_COURSES = [T_("Intro to Programming"), T_("Data Structures"), T_("Intro to AI"), T_("Machine Learning"), T_("HCI Foundations"), T_("NLP")];

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
      const topic = this.rng.pick(s.world.topics);
      const p = createProject(this, this.rng.chance(0.5) ? "empirical" : "study", topic.id, { stageIdx: 1, seedQuality: 48, source: "masters" });
      autoTarget(this, p);
      this.log(t("You bring a half-finished project from your Master's: “{title}”.", { title: p.title }));
    }
    this.save();
  }

  save() { this.state.rng = this.rng.state(); }

  log(text, kind, extra) {
    const e = { turn: this.state.turn, kind: kind || "line", text: text, phase: this.state.stage };
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
      if (s.stage === "start_items" || s.stage === "turn_items" || s.stage === "end_items") {
        const queue = s.stage === "end_items" ? s.endItems : s.turnItems;
        if (queue.length) {
          const item = queue.shift();
          const p = item.kind === "event" ? presentEvent(this, item) : buildSys(this, item);
          if (p) { s.prompt = p; this.save(); return p; }
          continue;
        }
        if (s.stage === "start_items") { s.stage = "plan"; this.save(); continue; }
        if (s.stage === "turn_items") { s.stage = "end_items"; this.save(); continue; }
        const report = this.finishTurn();
        s.stage = "turn_start";
        this.save();
        if (s.pendingEnding) continue;
        return { type: "turn_end", report: report };
      }
      if (s.stage === "plan") return this.planPrompt();
      if (s.stage === "resolve") {
        // The turn's focus plays out first and gets its own small result card; the turn's events
        // and updates come after it, so they never read as caused by what you chose.
        const self = this;
        const before = this.snapshot();
        this.resolveTurn();
        tickProjects(this, function (l) { self.log(l); });
        rollStages(this, function (l) { self.log(l); });
        s.workDone = true;
        s.focusReport = this.focusReport(before);
        s.turnItems.unshift({ kind: "sys", sys: "focus_result" });
        s.stage = "turn_items";
        this.save();
        continue;
      }
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
    } else if (p.type === "rebuttal") {
      const pp = s.papers.find(function (x) { return x.id === p.paperId; });
      if (pp) res = resolveRebuttal(this, pp, resp);
      if (res) res.kind = "rebuttal";
    } else if (p.type === "qa") {
      res = answerQa(this, resp);
      if (res) res.kind = "qa";
    }
    if (res && res.tip && this.D.phd101[res.tip]) {
      res.tipLink = this.D.phd101[res.tip];
      this.shelveTip(res.tipLink, p.title || "");
    }
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

  // Starting a project doesn't use the week; its kind and topic are picked for you.
  startNewProject() {
    const s = this.state;
    if (s.prompt || s.phase === "ended" || s.stage !== "plan" || !s.advisor) return null;
    if (activeProjects(this).length >= (this.D.config.progress.max_active_projects || 4)) return null;
    const hit = newProjectStress(this);
    const p = autoProject(this);
    this.log(t("New project: “{title}” ({type}).", { title: p.title, type: t(PROJECT_TYPES[p.type].label) }) + stressHit(this, hit), "news");
    this.save();
    return p;
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
    if (p && p.status === "active") { withdrawRevision(this, p); p.status = "shelved"; this.log(t("You shelve \u201c{title}\u201d.", { title: p.short })); }
    this.save();
  }

  // ---- Planning ------------------------------------------------------------

  fixedDays() {
    const s = this.state;
    const cfg = this.D.config.fixed_days;
    const tn = tOf(s.turn);
    const f = { courses: 0, ta: 0, meetings: 0, defense: 0, family: 0, internship: 0 };
    if (hasStatus(this, "on_internship")) f.internship = 10;
    else if (!hasStatus(this, "on_leave")) {
      if (hasStatus(this, "coursework")) f.courses = yearOf(s.turn) === 1 ? cfg.courses_y1 : cfg.courses_y2;
      if (hasStatus(this, "ta")) f.ta = (tn === 8 || tn === 18) ? cfg.ta_peak : cfg.ta;
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
    if (burnout) free = free / 2;
    if (hasStatus(this, "on_internship")) free = 0;
    return { parts: f, total: total, adj: adj, sick: sick, burnout: burnout, free: free };
  }

  // Everything you could focus on this turn. You pick exactly one.
  actionList() {
    const s = this.state;
    const self = this;
    const out = [];
    const onLeave = hasStatus(this, "on_leave");
    const fx = this.fixedDays();
    if (hasStatus(this, "on_internship")) {
      const co = s.internship && s.internship.accepted ? s.internship.accepted.company : t("the internship");
      out.push({ id: "intern_all", kind: "core", label: t("Give {company} your all", { company: co }), desc: t("Better return-offer odds"),
        arrows: [{ stat: "energy", dir: "down", strength: 2 }, { stat: "sanity", dir: "down", strength: 1 }] });
      out.push({ id: "intern_pace", kind: "core", label: t("Keep a healthy pace"), desc: "",
        arrows: [{ stat: "sanity", dir: "up", strength: 1 }] });
      activeProjects(this).slice(0, 2).forEach(function (p) {
        if (currentStage(self, p).kind === "wait" || p.ready) return;
        out.push({ id: "intern_weekend:" + p.id, kind: "core", label: t("Weekends on “{title}”", { title: p.short }), desc: "",
          arrows: [{ stat: "energy", dir: "down", strength: 2 }, { stat: "progress", dir: "up", strength: 1 }] });
      });
      out.push({ id: "recharge", kind: "core", label: t("Take a few days off"), desc: "",
        arrows: [{ stat: "energy", dir: "up", strength: 2 }, { stat: "sanity", dir: "up", strength: 1 }] });
    } else if (!onLeave) {
      activeProjects(this).forEach(function (p) {
        const st = currentStage(self, p);
        const info = stageInfo(self, p);
        const ttd = p.target && p.target.turn !== null && p.target.turn !== undefined ? p.target.turn - s.turn : null;
        // A project that's waiting (IRB, recruiting, annotation) or on hold has nothing to work on this turn.
        if (st.kind === "wait" || p.pause > 0) return;
        // "ICLR now" / "ICLR 4w": tools/phd-sim/simulate.mjs reads these off the English tiles.
        const due = function (n) { return n ? t("{deadline} {weeks}w", { deadline: deadlineLabel(self, p), weeks: n * WEEKS_PER_TURN }) : t("{deadline} now", { deadline: deadlineLabel(self, p) }); };
        const dl = ttd === 0 ? " \u00b7 " + due(0) :
          ttd !== null && ttd > 0 && ttd <= 3 ? " \u00b7 " + due(ttd) : "";
        // A finished paper waits for its deadline card, but you can keep refining it.
        if (info.ready) {
          out.push({ id: "refine:" + p.id, kind: "project", label: t("Refine \u201c{title}\u201d", { title: p.short }),
            desc: t("Ready") + (p.target && ttd !== null && ttd >= 0 ? " \u00b7 " + due(ttd) : ""),
            arrows: [{ stat: "energy", dir: "down", strength: 1 }, { stat: "quality", dir: "up", strength: 1 }] });
          return;
        }
        out.push({ id: "p:" + p.id, kind: "project", label: t("Work on “{title}”", { title: p.short }),
          desc: info.label + dl + (st.id === "lit" ? " \u00b7 " + t("reading is faster") : ""),
          arrows: [{ stat: "energy", dir: "down", strength: 1 }, { stat: "progress", dir: "up", strength: st.id === "lit" ? 1 : 2 }] });
        if (ttd === 1 && !fx.burnout) {
          out.push({ id: "crunch:" + p.id, kind: "deadline", label: t("Crunch on “{title}”, weekends included", { title: p.short }),
            desc: t("{deadline} 2w \u00b7 weekends too", { deadline: deadlineLabel(self, p) }),
            arrows: [{ stat: "energy", dir: "down", strength: 2 }, { stat: "sanity", dir: "down", strength: 1 }, { stat: "health", dir: "down", strength: 1 }, { stat: "progress", dir: "up", strength: 2 }] });
        }
      });
      planExtras(this).forEach(function (x) {
        out.push({ id: x.id, kind: "milestone", label: x.label, desc: x.desc, arrows: x.arrows || [] });
      });
      const lit = activeProjects(this).filter(function (p) { return !p.revise && currentStage(self, p).id === "lit" && !(p.pause > 0); });
      DEFAULT_ACTIONS.forEach(function (a) {
        let desc = a.desc, arrows = a.arrows;
        if (a.id === "read" && lit.length) {
          desc = t("Speeds up Related work");
          arrows = [{ stat: "energy", dir: "down", strength: 1 }, { stat: "progress", dir: "up", strength: 2 }];
        }
        out.push({ id: a.id, kind: "core", label: t(a.label), desc: a.id === "read" && lit.length ? desc : "", arrows: arrows });
      });
    } else {
      out.push({ id: "recharge", kind: "core", label: t("Recharge"), desc: t("You're on leave, so resting is the job."), arrows: [{ stat: "energy", dir: "up", strength: 2 }, { stat: "sanity", dir: "up", strength: 1 }] });
    }
    // Only this turn: opportunities that came up, and anything an event unlocked.
    (s.turnOpps || []).forEach(function (o) {
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
        activeProjects(this).length < (this.D.config.progress.max_active_projects || 4),
      newProjectStress: newProjectStress(this),
      side: (s.turnSide || []).map(function (o) { return { id: o.id, label: o.label, desc: o.desc, arrows: o.arrows }; })
    };
  }

  // plan: { action: actionId }. The turn's focus; the turn's updates and events come next.
  submitPlan(plan) {
    const s = this.state;
    if (s.stage !== "plan" || s.prompt) return false;
    const list = this.actionList();
    const ids = list.map(function (a) { return a.id; });
    const action = plan && ids.indexOf(plan.action) >= 0 ? plan.action : (ids.indexOf("recharge") >= 0 ? "recharge" : ids[0]);
    const side = plan && plan.side && (s.turnSide || []).find(function (o) { return o.id === plan.side; });
    s.plan = { action: action, label: list[ids.indexOf(action)].label, side: side ? { id: side.id, label: side.label, ctx: side.ctx } : null };
    s.lastPlan = { action: action };
    s.turnItems = (s.laterItems || []).concat(s.turnItems || []);
    s.laterItems = [];
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
      const info = stageInfo(self, p);
      // The stage's English name, so a turn saved in one language compares right in the other;
      // it's translated where it's shown.
      projects[p.id] = { status: p.status, stage: STAGE_LABELS[info.id], n: info.n, ready: info.ready, hint: info.hint };
    });
    return {
      stats: { energy: s.stats.energy, sanity: s.stats.sanity, health: s.stats.health },
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
    s.workDone = false;
    s.focusReport = null;
    s.turnLogStart = s.log.length;
    s.newAchievements = [];
    s.turnItems = [];
    s.laterItems = [];
    s.endItems = [];
    s.plan = null;
    s.turnSide = [];
    s.exercisedThisTurn = false;
    s.before = this.snapshot();
    const managed = ["coursework", "ta", "fellowship"];
    s.statuses.forEach(function (st) { if (managed.indexOf(st.id) < 0) st.turns--; });
    const expired = s.statuses.filter(function (st) { return st.turns <= 0 && managed.indexOf(st.id) < 0; });
    s.statuses = s.statuses.filter(function (st) { return !(st.turns <= 0 && managed.indexOf(st.id) < 0); });
    expired.forEach(function (st) {
      if (st.id === "burnout" && s.player.traits.indexOf("burnout_survivor") < 0) {
        s.player.traits.push("burnout_survivor");
        self.log(t("You come back from burnout knowing your limits a little better. New trait: Burnout Survivor."), "news");
      }
    });
    this.updateCalendarStatuses();

    // What happens to you this turn. Choosing an advisor (and a first project) comes before the
    // focus; everything else comes right after it.
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
    activeProjects(this).forEach(function (p) {
      if (!p.target || p.target.rrPaper || p.target.journalPaper) return;
      // A deadline this turn: a card to submit or skip (one per paper, so two can go in together).
      if (p.target.turn === s.turn && isReady(self, p)) {
        items.push({ kind: "sys", sys: "submit", data: { projectId: p.id } });
      }
      // A deadline two weeks out with the paper far from done weighs on you.
      if (p.target.turn === s.turn + 1 && p.loomWarned !== p.target.turn && !isReady(self, p)) {
        p.loomWarned = p.target.turn;
        self.log(t("“{title}” is due in two weeks and it's still in {stage}.", { title: p.short, stage: stageInfo(self, p).label }) + stressHit(self, 3), "bad");
      }
    });
    // Usually one event a turn, sometimes two or none. Updates (reviews, decisions, milestones)
    // count toward it, so a busy turn gets fewer random events.
    const ev = this.D.config.events;
    const odds = ev.per_turn || [0.15, 0.6, 0.25];
    let want = 0;
    for (let r = this.rng.next(), acc = 0; want < odds.length; want++) { acc += odds[want]; if (r < acc) break; }
    const updates = items.filter(function (it) { return it.kind === "event" || PROMPT_SYS.indexOf(it.sys) >= 0; }).length;
    if (want - updates > 0) drawHook(this, "turn", {}, want - updates).forEach(function (it) { items.push(it); });
    // Now and then, something to do with an evening or a weekend: an optional pick on the plan screen.
    const low = s.stats.health < 45 || s.stats.sanity < 40;
    s.turnSide = s.advisor && !hasStatus(this, "on_leave") && this.rng.chance((this.D.config.side && this.D.config.side.chance || 0.3) + (low ? 0.15 : 0)) ? rollSide(this) : [];
    s.turnItems = items.filter(function (it) { return PRE_SYS.indexOf(it.sys) >= 0; });
    s.laterItems = items.filter(function (it) { return PRE_SYS.indexOf(it.sys) < 0; });
    this.rollOpportunities();
  }

  // Extra options that come up for this turn only, plus anything an event unlocked earlier.
  rollOpportunities() {
    const s = this.state;
    const self = this;
    const max = (this.D.config.opportunities && this.D.config.opportunities.max_per_turn) || 2;
    const picks = [];
    (s.unlocks || []).filter(function (u) { return u.turn === s.turn; }).forEach(function (u) { picks.push({ id: u.id, ctx: u.ctx || {} }); });
    s.unlocks = (s.unlocks || []).filter(function (u) { return u.turn > s.turn; });
    const cands = this.rng.shuffle(this.D.opportunities);
    for (let i = 0; i < cands.length && picks.length < max; i++) {
      const o = cands[i];
      if (picks.some(function (x) { return x.id === o.id; })) continue;
      if (o.once && s.seen["opp:" + o.id] !== undefined) continue;
      if (s.seen["opp:" + o.id] !== undefined && s.turn - s.seen["opp:" + o.id] < span(o.cooldown || 4)) continue;
      const ctx = {};
      if (!check(o.when, this, ctx)) continue;
      // Project time on a paper that's already finished would change nothing.
      if (o.days === "project" && ctx.projectId && s.projects.some(function (p) { return p.id === ctx.projectId && p.ready; })) continue;
      if (!this.rng.chance(o.chance === undefined ? 0.05 : o.chance)) continue;
      picks.push({ id: o.id, ctx: ctx });
    }
    picks.forEach(function (o) { s.seen["opp:" + o.id] = s.turn; });
    s.turnOpps = picks;
  }

  resolveTurn() {
    const s = this.state;
    const cfg = this.D.config;
    const self = this;
    const action = (s.plan && s.plan.action) || "recharge";
    const tally = { work: 0, self: 0, social: 0, exercise: 0, overtime: 0, projects: {} };

    // The evening or weekend pick first (it can cost a day), then deadlines and milestones.
    if (s.plan && s.plan.side) applySide(this, s.plan.side);
    if (ACTION_EXTRAS.indexOf(action) >= 0) applyPlanExtra(this, action, {});
    if (action.indexOf("crunch:") === 0) addStatus(this, "deadline_mode", 1);
    let opp = null;
    if (action.indexOf("opp:") === 0) {
      const oid = action.slice(4);
      opp = { def: this.D.opportunityById[oid], ctx: ((s.turnOpps || []).find(function (o) { return o.id === oid; }) || {}).ctx || {} };
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
    if (s.stats.health < cfg.health.poor) eff *= cfg.health.poor_efficiency;

    let weekendWork = null;
    const interning = hasStatus(this, "on_internship");
    if (interning && action !== "recharge") {
      // Ten internship days. A healthy pace costs little; giving it your all costs a lot.
      const allIn = action === "intern_all";
      addStat(this, "energy", allIn ? this.roll(cfg.energy.workday) * 10 - 6 : this.roll(cfg.energy.fixed_day) * 6);
      addStat(this, "sanity", (cfg.sanity.work_day || 0) * (allIn ? 10 : 4));
      addStat(this, "coding", allIn ? 2.8 : 1.6);
      addStat(this, "network", allIn ? 2.4 : 1.2);
      addStat(this, "presenting", 0.4);
      if (allIn) s.internshipEffort = (s.internshipEffort || 0) + 1;
      if (action.indexOf("intern_weekend:") === 0) weekendWork = "p:" + action.slice(15);
      tally.work += 10;
    } else if (interning) {
      // A few vacation days, and easy evenings.
      addStat(this, "energy", this.roll(cfg.energy.fixed_day) * 6);
      this.restTurn("recharge", 4, tally);
      tally.work += 6;
    } else {
      // Fixed commitments (classes, TA duty, meetings) cost a little Energy and add a little Stress.
      const fixedWork = fx.parts.courses + fx.parts.ta + fx.parts.meetings + fx.parts.defense;
      addStat(this, "energy", this.roll(cfg.energy.fixed_day) * fixedWork);
      addStat(this, "sanity", (cfg.sanity.work_day || 0) * fixedWork);
      this.applyDays("family", eff, fx.parts.family, tally);
      if (fx.parts.courses) addStat(this, "knowledge", 0.3 * fx.parts.courses);
      if (fx.parts.defense) {
        s.readiness += 0.5 * fx.parts.defense;
        addStat(this, "writing", 0.2 * fx.parts.defense);
        addStat(this, "presenting", 0.2 * fx.parts.defense);
      }
      // The turn's free days all go to its focus.
      let dayKey = "recharge";
      let effD = eff;
      if (action.indexOf("p:") === 0) dayKey = action;
      else if (action.indexOf("crunch:") === 0) dayKey = "p:" + action.slice(7);
      else if (action.indexOf("refine:") === 0) dayKey = "p:" + action.slice(7);
      else if (action === "quals_prep") dayKey = "quals_study";
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
      if (dayKey === "recharge") this.restTurn("recharge", fx.free, tally);
      else if (dayKey) this.applyDays(dayKey, effD, fx.free, tally);
      if (action.indexOf("crunch:") === 0) weekendWork = "p:" + action.slice(7);
      if (hasTrait(this, "caffeine_powered") && s.stats.energy < 40) addStat(this, "health", -1);
    }
    // Weekends (four days): off, unless you crunched or spent them on research.
    const ot = weekendWork ? 4 : 0;
    for (let i = 0; i < ot; i++) this.applyDay(weekendWork, eff, true, tally);
    for (let i = 0; i < 4 - ot; i++) {
      addStat(this, "energy", this.roll(cfg.energy.weekend_off));
      addStat(this, "sanity", cfg.sanity.weekend_off);
      addStat(this, "friends_rel", 0.5);
      tally.self++; tally.social++;
    }
    if (opp && opp.def) {
      const res = applyOutcome(this, opp.def, opp.ctx);
      const line = res.text || t("{label}.", { label: fill(opp.def.label, this, opp.ctx) });
      this.log(line, "news");
    }
    addStat(this, "energy", cfg.energy.baseline);
    addStat(this, "sanity", -(cfg.sanity.pressure || 0));

    // Passive effects (per turn).
    const tl = s.telemetry;
    tl.overtime_days += tally.overtime;
    tl.overtime_streak = tally.overtime >= 2 ? tl.overtime_streak + 1 : 0;
    tl.days_off_streak = tally.self === 0 ? tl.days_off_streak + 1 : 0;
    s.isolation = tally.social === 0 ? (s.isolation || 0) + 1 : 0;
    if (s.isolation >= span(cfg.sanity.isolation_turns)) addStat(this, "sanity", this.roll(cfg.sanity.isolation_hit) * (hasTrait(this, "social_butterfly") ? 1.3 : 1));
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
      else if (projDays) addStat(this, "advisor_rel", 0.3);
    }
    if (hasTrait(this, "cat_person")) addStat(this, "sanity", 1);
    if (hasTrait(this, "optimist")) addStat(this, "sanity", 1);
    if (hasTrait(this, "burnout_survivor")) addStat(this, "sanity", 0.5);
    if (hasStatus(this, "post_rejection_blues")) addStat(this, "sanity", -2);
    if (hasStatus(this, "deadline_mode")) addStat(this, "sanity", hasTrait(this, "deadline_junkie") ? -4 : -3);
    if (hasStatus(this, "in_love")) addStat(this, "sanity", 2);
    if (hasStatus(this, "on_leave")) addStat(this, "sanity", 4);
    // Health: desk turns wear you down a little; exhaustion and stress wear it down faster.
    if (tally.exercise === 0 && !s.exercisedThisTurn) addStat(this, "health", cfg.health.desk_turn);
    if (s.stats.energy < 25) addStat(this, "health", cfg.health.exhausted_turn);
    if (s.stats.sanity < 30) addStat(this, "health", cfg.health.stressed_turn);

    // Health and burnout.
    const tn = tOf(s.turn);
    let sickP = cfg.health.sick_base + cfg.health.sick_per_point * (100 - s.stats.health);
    if (tn >= cfg.health.flu_season[0] && tn <= cfg.health.flu_season[1]) sickP *= 2;
    if (!hasStatus(this, "sick") && this.rng.chance(sickP)) {
      addStatus(this, "sick", 1);
      addStat(this, "energy", -15);
      addStat(this, "health", -4);
      this.log(t("You catch something nasty. The next two weeks will be slow."), "bad");
    }
    if (s.stats.sanity <= 0 && !hasStatus(this, "burnout")) {
      addStatus(this, "burnout", span(cfg.sanity.burnout_turns) + 1);
      tl.burnouts++;
      s.stats.sanity = 15;
      this.log(t("You burn out. For the next several weeks you'll get half as much done and can't crunch, so rest. It happens to more people than will ever say so."), "bad");
    }
    if (s.stats.health < 35 && !s.warnedHealth) {
      s.warnedHealth = true;
      this.log(t("Your health is slipping: you'll get sick more often and work a little slower. Recharging helps, and so does saying yes to the gym or a hike when it comes up."), "bad");
    } else if (s.stats.health > 55) s.warnedHealth = false;
    if (s.stats.energy < 20 && !s.warnedEnergy) {
      s.warnedEnergy = true;
      this.log(t("You're running on fumes: with Energy this low, everything gets less done. Two weeks of recharging help."), "bad");
    } else if (s.stats.energy > 50) s.warnedEnergy = false;
    if (s.stats.sanity < 25 && !s.warnedSanity && !hasStatus(this, "burnout")) {
      s.warnedSanity = true;
      this.log(t("Your stress is high. Recharging and the good things that come up (friends, trips, hobbies) bring it down; at 100 you burn out."), "bad");
    } else if (s.stats.sanity > 45) s.warnedSanity = false;
  }


  finishTurn() {
    const s = this.state;
    const cfg = this.D.config;
    const self = this;
    finishSubmissions(this);
    rollMissedDeadlines(this);
    s.projects.forEach(function (p) { p.days = 0; });
    accrueCitations(this);
    if (tOf(s.turn) === TURNS) yearlyLabmates(this, function (l) { self.log(l); });
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

  // What the turn's focus did: its log lines, how the focused project's stage went, and the bars.
  focusReport(before) {
    const s = this.state;
    const after = this.snapshot();
    const lines = s.log.filter(function (e) { return e.turn === s.turn && e.phase === "resolve" && e.kind !== "flavor" && e.kind !== "tip"; })
      .map(function (e) { return e.text; });
    const action = (s.plan && s.plan.action) || "";
    const m = /^(?:p|crunch|refine|intern_weekend):(.+)$/.exec(action);
    const p = m && s.projects.find(function (x) { return x.id === m[1]; });
    if (p) {
      // The card's title already names the project: drop a leading "<project>: " (or "<project>：").
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].indexOf(p.short) !== 0) continue;
        const m2 = /^(?:: |\uff1a\s*)/.exec(lines[i].slice(p.short.length));
        if (m2) lines[i] = lines[i].slice(p.short.length + m2[0].length).replace(/^./, function (c) { return c.toUpperCase(); });
      }
      if (p.status === "active" && before.projects[p.id] && after.projects[p.id] &&
          before.projects[p.id].stage === after.projects[p.id].stage && !after.projects[p.id].ready) {
        lines.unshift(t("{stage} isn't done yet.", { stage: stageInfo(this, p).label }));
      }
    }
    const deltas = [];
    ["energy", "sanity", "health"].forEach(function (k) {
      const d = Math.round(after.stats[k] - before.stats[k]);
      if (d) deltas.push({ stat: k, amount: d });
    });
    return { title: (s.plan && s.plan.label) || t("Your two weeks"), lines: lines.slice(0, 4), deltas: deltas };
  }

  buildReport() {
    const s = this.state;
    const self = this;
    const before = s.before || this.snapshot();
    const after = this.snapshot();
    const deltas = [];
    ["energy", "sanity", "health"].forEach(function (k) {
      const a = Math.round(before.stats[k]), b = Math.round(after.stats[k]);
      if (a !== b) deltas.push({ stat: k, label: t(STAT_LABELS[k]), from: a, to: b });
    });
    if (after.citations !== before.citations) deltas.push({ stat: "citations", label: t("Citations"), from: before.citations, to: after.citations });
    const projects = [];
    s.projects.forEach(function (p) {
      const a = before.projects[p.id], b = after.projects[p.id];
      if (!b) return;
      const label = function (x) { return x ? (x.ready ? t("Ready to submit") : t(x.stage)) : t("new"); };
      if (!a || a.stage !== b.stage || a.ready !== b.ready || a.status !== b.status) {
        projects.push({ id: p.id, short: p.short, from: label(a), to: b.status === "submitted" ? t("Submitted") : b.status === "done" ? t("Published") : label(b) });
      } else if (p.lastWorked === s.turn && p.status === "active" && !b.ready) {
        projects.push({ id: p.id, short: p.short, from: null, to: t("still in {stage} ({hint})", { stage: t(b.stage), hint: b.hint }) });
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

  // Recharge restores a whole turn's worth however busy the turn is: classes and TA still
  // happen, but evenings, sleep and the weekend are yours. It's good for your body too.
  restTurn(kind, free, tally) {
    const s = this.state;
    const cfg = this.D.config;
    addStat(this, "energy", this.roll(cfg.energy.recharge_turn));
    addStat(this, "sanity", this.roll(cfg.sanity.recharge_turn));
    addStat(this, "health", this.roll(cfg.health.recharge_turn));
    addStat(this, "friends_rel", 3);
    s.telemetry.rest_days += Math.round(free);
    s.telemetry.exercise_days += 1;
    tally.self += 3; tally.social++; tally.exercise++;
  }

  // n can be fractional (4.5 days): the last part-day counts for its fraction of everything.
  applyDays(key, eff, n, tally) {
    const whole = Math.floor(n + 1e-9);
    for (let i = 0; i < whole; i++) this.applyDay(key, eff, false, tally);
    const frac = n - whole;
    if (frac < 0.05) return;
    const st = this.state.stats;
    const before = {};
    Object.keys(st).forEach(function (k) { before[k] = st[k]; });
    this.applyDay(key, eff * frac, false, tally);
    Object.keys(st).forEach(function (k) { st[k] = before[k] + (st[k] - before[k]) * frac; });
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
      if (key === "read") e += cfg.energy.read_relief || 0;
      addStat(this, "energy", e);
      addStat(this, "sanity", cfg.sanity.work_day || 0);
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
      case "read": {
        // Reading is how Related work gets done; every other project inches forward.
        const self = this;
        const logLine = function (line) { self.log(line); };
        activeProjects(this).forEach(function (p) {
          if (!p.revise && currentStage(self, p).id === "lit") { workDay(self, p, eff, logLine, { reading: true }); tally.projects[p.id] = true; }
          else readTrickle(self, p, logLine);
        });
        st.knowledge = clamp(st.knowledge + g * (1 - st.knowledge / 100), 0, 100);
        st.taste = clamp(st.taste + 0.5 * g * (1 - st.taste / 100), 0, 100);
        s.telemetry.reading_days++;
        if (hasStatus(this, "quals_prep")) s.readiness += 0.3;
        if (this.rng.chance(0.04 + st.taste / 1500)) { s.telemetry.ideas++; this.log(t("While reading, you have an idea worth keeping.")); }
        break;
      }
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
        addStat(this, "sanity", this.roll(cfg.sanity.recharge_day));
        addStat(this, "health", cfg.health.rest_day);
        addStat(this, "friends_rel", 1);
        s.telemetry.rest_days++;
        tally.self++; tally.social++;
        break;
      case "quals_study":
        // Mock exams and the reading list: this is what the committee's questions test.
        s.readiness += (cfg.quals_prep_per_day || 1.5) * Math.max(0.5, eff);
        st.knowledge = clamp(st.knowledge + 0.5 * g * (1 - st.knowledge / 100), 0, 100);
        break;
      case "writing_day":
        addStat(this, "writing", 0.5 * g * (1 - st.writing / 100) * 2);
        if (hasStatus(this, "defense_prep")) s.readiness += 0.5;
        break;
      case "rest":
        addStat(this, "energy", this.roll(cfg.energy.rest));
        addStat(this, "health", cfg.health.rest_day);
        s.telemetry.rest_days++;
        tally.self++;
        break;
      case "exercise":
        addStat(this, "energy", this.roll(cfg.energy.exercise));
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
    const who = lm.length ? this.rng.pick(lm).name : t("A labmate");
    const venues = this.D.venues.filter(function (v) { return !v.journal; });
    const v = this.rng.pick(venues);
    const topic = this.rng.pick(s.world.topics);
    const tt = (this.D.topicById[topic.id] || {}).titles || {};
    const titles = (tt.nlp || []).concat(tt.hci || []);
    const title = titles.length ? this.rng.pick(titles) : t("A Paper You Helped With");
    s.papers.push({
      id: "x" + s.nextId++, projectId: null, title: title, short: title.split(/[:\uff1a]/)[0], type: "empirical", topic: topic.id,
      venueId: v.id, venueName: v.cycles[0].name, tier: v.tier, journal: false, cycle: 0,
      submittedTurn: s.turn, reviewsTurn: s.turn + 10, decisionTurn: s.turn + this.rng.int(10, 18), conferenceTurn: null,
      rebuttal: false, rr: false, round: 1, comps: { N: 60, S: 60, C: 60 },
      Q: 58 + this.rng.normal(0, 8), status: "under_review", reviews: null, preprint: false, firstAuthor: false,
      submissions: 1, citations: 0, citeMean: 0, pubTurn: null, breakout: 1, bonusCites: 0, scoreBonus: 0, promises: 0, coauthor: who
    });
    this.log(t("{name} adds you as a co-author on their submission. You helped more than you realized.", { name: who }));
  }

  // ---- Turn phases -----------------------------------------------------------

  updateCalendarStatuses() {
    const s = this.state;
    const tn = tOf(s.turn);
    const y = yearOf(s.turn);
    const sem = semesterOf(tn);
    const inSemester = sem === "fall" || sem === "spring";
    const course = inSemester && (y === 1 || (y === 2 && sem === "fall"));
    if (course) addStatus(this, "coursework", 1); else removeStatus(this, "coursework");
    if (course && (tn === 1 || tn === 10)) {
      const cs = this.rng.shuffle(COURSES).slice(0, y === 1 ? 2 : 1).map(function (c) { return t(c); });
      this.log(cs.length > 1 ? t("This semester: {a} and {b}.", { a: cs[0], b: cs[1] }) : t("This semester: {course}.", { course: cs[0] }));
    }
    if (s.fellowshipYear === y) addStatus(this, "fellowship", 1); else removeStatus(this, "fellowship");
    const key = semesterKey(s.turn);
    if ((tn === 1 || tn === 10) && s.ta[key] === undefined) {
      let ta = false;
      if (s.advisor && !(y === 1 && tn === 1) && s.fellowshipYear !== y && !s.milestones.graduated) {
        const fund = s.advisor.params.fund;
        ta = this.rng.chance(this.D.config.ta_chance_by_funding[fund - 1]);
      }
      s.ta[key] = ta;
      if (ta) {
        s.telemetry.ta_semesters++;
        s.taCourse = this.rng.pick(TA_COURSES);
        this.log(t("You're a TA for {course} this semester. Two days a turn go to teaching.", { course: t(s.taCourse) }) + stressHit(this, 4));
      }
    }
    if (inSemester && s.ta[key]) addStatus(this, "ta", 1); else removeStatus(this, "ta");
  }

  maybeTip() {
    const s = this.state;
    if (s.turn - s.lastTipTurn < span(this.D.config.tip_spacing || 6)) return;
    const self = this;
    const tips = this.D.tips.filter(function (tp) { return !s.tipsShown[tp.id] && self.D.phd101[tp.topic] && (!tp.when || check(tp.when, self, {})); });
    if (!tips.length) return;
    const tip = this.rng.pick(tips);
    s.tipsShown[tip.id] = true;
    s.lastTipTurn = s.turn;
    const ep = this.D.phd101[tip.topic];
    const senior = s.labmates.filter(function (l) { return l.present !== false; }).sort(function (a, b) { return b.year - a.year; })[0];
    const said = t("{name}: “{tip}”", { name: senior ? senior.name : t("A senior student"), tip: tip.text });
    this.log(said, "tip", { title: ep.title, url: ep.url, topic: tip.topic });
    this.shelveTip(ep, said);
  }

  // Recent PhD 101 pointers (from senior labmates and from events), shown above the project trays.
  shelveTip(ep, note) {
    const s = this.state;
    s.tipShelf = [{ title: ep.title, url: ep.url, note: note || "", turn: s.turn }]
      .concat((s.tipShelf || []).filter(function (x) { return x.url !== ep.url; })).slice(0, 3);
  }
}
