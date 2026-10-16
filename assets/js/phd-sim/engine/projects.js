// Research projects: stages, daily work, hidden quality, and venue deadlines.
import { clamp } from "./util.js";
import { absTurn, yearOf, tOf, TURNS, weeks, weekDates } from "./state.js";
import { hasTrait, hasStatus } from "./derived.js";

function S(id, kind, comp, skill, need, extra) {
  const st = { id: id, kind: kind, comp: comp, skill: skill, need: need };
  if (extra) for (const k in extra) st[k] = extra[k];
  return st;
}

export const PROJECT_TYPES = {
  empirical: {
    label: "Empirical NLP",
    stages: [S("idea", "work", "N", "taste", 50), S("lit", "work", "N", "knowledge", 100),
      S("pilot", "work", "S", "coding", 100), S("experiments", "work", "S", "coding", 150, { compute: true }),
      S("writing", "work", "C", "writing", 120)]
  },
  study: {
    label: "Human-centered study",
    stages: [S("idea", "work", "N", "taste", 50), S("lit", "work", "N", "knowledge", 100),
      S("design", "work", "S", "knowledge", 80), S("irb", "wait", null, null, 0, { wait: [2, 4] }),
      S("recruiting", "wait", null, null, 0, { wait: [1, 3] }), S("sessions", "work", "S", "presenting", 100),
      S("analysis", "work", "S", "knowledge", 100, { stats: true }), S("writing", "work", "C", "writing", 120)]
  },
  system: {
    label: "System + evaluation",
    stages: [S("idea", "work", "N", "taste", 50), S("lit", "work", "N", "knowledge", 100),
      S("build", "work", "S", "coding", 150), S("irb", "wait", null, null, 0, { wait: [2, 4] }),
      S("study", "work", "S", "presenting", 100), S("analysis", "work", "S", "knowledge", 80, { stats: true }),
      S("writing", "work", "C", "writing", 120)]
  },
  dataset: {
    label: "Dataset / benchmark",
    stages: [S("idea", "work", "N", "taste", 50), S("lit", "work", "N", "knowledge", 100),
      S("guidelines", "work", "S", "knowledge", 80), S("annotation", "wait", null, null, 0, { wait: [2, 4] }),
      S("baselines", "work", "S", "coding", 100), S("writing", "work", "C", "writing", 120)]
  },
  position: {
    label: "Position / survey",
    stages: [S("idea", "work", "N", "taste", 50), S("lit", "work", "N", "knowledge", 200),
      S("writing", "work", "C", "writing", 120)]
  }
};

export const REVISE_STAGE = S("revise", "work", "C", "writing", 60);

export const STAGE_LABELS = {
  idea: "Idea", lit: "Related work", pilot: "Pilot", experiments: "Experiments", writing: "Writing",
  design: "Study design", irb: "IRB review", recruiting: "Recruiting", sessions: "Study sessions",
  analysis: "Analysis", build: "Building", study: "User study", guidelines: "Annotation guidelines",
  annotation: "Annotation", baselines: "Baselines", revise: "Revising"
};

export function currentStage(G, p) {
  if (p.revise) return REVISE_STAGE;
  const stages = PROJECT_TYPES[p.type].stages;
  return stages[Math.min(p.stageIdx, stages.length - 1)];
}

export function stageNeed(G, p) {
  const st = currentStage(G, p);
  let need = st.need;
  if ((st.id === "writing" || st.id === "revise") && G.state.advisor && G.state.advisor.archetype === "kind_funded") need *= 1.1;
  return need;
}

export function isReady(G, p) {
  const st = currentStage(G, p);
  return (st.id === "writing" || st.id === "revise") && p.progress >= stageNeed(G, p) * 0.5;
}

export function writingCompletion(G, p) {
  const st = currentStage(G, p);
  if (st.id !== "writing" && st.id !== "revise") return 0;
  return clamp(p.progress / stageNeed(G, p), 0, 1);
}

function shortTitle(title) {
  const head = title.split(":")[0];
  if (head.length <= 44) return head;
  return title.split(" ").slice(0, 6).join(" ") + "…";
}

export function newProjectObject(G, type, topicId, opts) {
  const s = G.state;
  opts = opts || {};
  const topic = s.world.topics.find(function (t) { return t.id === topicId; }) || s.world.topics[0];
  const data = G.D.topicById[topic.id] || { titles: [] };
  const unused = (data.titles || []).filter(function (t) { return topic.used.indexOf(t) < 0; });
  let title = opts.title || (unused.length ? G.rng.pick(unused) : null);
  if (!title) title = "More on " + topic.name.charAt(0).toUpperCase() + topic.name.slice(1) + " (Part " + (topic.used.length + 1) + ")";
  topic.used.push(title);
  const p = {
    id: "p" + s.nextId++,
    type: type,
    topic: topic.id,
    title: title,
    short: shortTitle(title),
    stageIdx: opts.stageIdx || 0,
    progress: 0,
    wait: 0,
    pause: 0,
    q: { N: { s: 0, n: 0 }, S: { s: 0, n: 0 }, C: { s: 0, n: 0 } },
    bonus: { N: opts.bonusN || 0, S: 0, C: 0 },
    target: null,
    status: "active",
    firstAuthor: opts.firstAuthor !== false,
    created: s.turn,
    submissions: 0,
    revise: false,
    fixedComp: null,
    warned: null,
    days: 0,
    submitting: false,
    source: opts.source || "player"
  };
  if (opts.seedQuality) {
    ["N", "S"].forEach(function (c) { p.q[c].s = opts.seedQuality; p.q[c].n = 1; });
  }
  if (type === "study" || type === "system") s.telemetry.study_projects++;
  return p;
}

export function activeProjects(G) {
  return G.state.projects.filter(function (p) { return p.status === "active"; });
}

// ---- Deadlines -------------------------------------------------------------

export function venuesForType(G, type, opts) {
  opts = opts || {};
  return G.D.venues.filter(function (v) {
    if (v.types.indexOf(type) < 0) return false;
    if (!opts.includeJournals && v.journal) return false;
    if (opts.onlyWorkshops) return v.tier === "workshop";
    return true;
  });
}

export function nextDeadline(G, venueId, fromTurn) {
  const v = G.D.venueById[venueId];
  if (!v) return null;
  let best = null;
  const y0 = yearOf(fromTurn);
  for (let y = y0; y <= y0 + 1; y++) {
    v.cycles.forEach(function (c, i) {
      const at = absTurn(y, c.deadline) + 1;   // the deadline falls in the second week of its period
      if (at >= fromTurn && (!best || at < best.turn)) best = { venueId: venueId, cycle: i, turn: at };
    });
  }
  return best;
}

export function cycleOf(G, target) {
  const v = G.D.venueById[target.venueId];
  return v ? v.cycles[target.cycle] : null;
}

export function turnsToDeadline(G, p) {
  if (!p.target || p.target.turn === null || p.target.turn === undefined) return null;
  return p.target.turn - G.state.turn;
}

function remainingPoints(G, p) {
  if (p.revise) return Math.max(0, REVISE_STAGE.need - p.progress);
  const stages = PROJECT_TYPES[p.type].stages;
  let pts = 0;
  for (let i = p.stageIdx; i < stages.length; i++) {
    const st = stages[i];
    if (st.kind === "wait") pts += 22 * weeks((st.wait[0] + st.wait[1]) / 2);
    else pts += st.need;
  }
  return Math.max(0, pts - p.progress);
}

export function autoTarget(G, p, opts) {
  opts = opts || {};
  const s = G.state;
  // About 22 progress points a week for a typical player who works on it most weeks.
  const lead = Math.max(1, Math.ceil(remainingPoints(G, p) / 22));
  const from = s.turn + Math.max(weeks(opts.minLead || 1), Math.min(lead, 60));
  const vs = venuesForType(G, p.type, { onlyWorkshops: opts.onlyWorkshops, includeJournals: false })
    .filter(function (v) { return opts.onlyWorkshops || v.tier !== "workshop" || p.type === "position"; });
  let options = vs.map(function (v) { return nextDeadline(G, v.id, from); }).filter(Boolean);
  if (!options.length) options = venuesForType(G, p.type, {}).map(function (v) { return nextDeadline(G, v.id, from); }).filter(Boolean);
  options.sort(function (a, b) { return a.turn - b.turn; });
  const soonest = options[0];
  if (!soonest) { p.target = null; return; }
  const tierRank = { top: 0, mid: 1, workshop: 2, journal: 3 };
  const close = options.filter(function (o) { return o.turn <= soonest.turn + 6; });
  close.sort(function (a, b) {
    return tierRank[G.D.venueById[a.venueId].tier] - tierRank[G.D.venueById[b.venueId].tier] || a.turn - b.turn;
  });
  p.target = close[0];
}

export function setTarget(G, p, venueId) {
  const s = G.state;
  const d = nextDeadline(G, venueId, s.turn);
  if (d) p.target = d;
}

// ---- Quality --------------------------------------------------------------

function avg(q, fallback) {
  return q.n ? q.s / q.n : fallback;
}

export function components(G, p) {
  const s = G.state;
  const cfg = G.D.config.quality;
  let N = avg(p.q.N, 40);
  let C = avg(p.q.C, 35);
  let Sv = avg(p.q.S, p.type === "position" ? (N + C) / 2 - 3 : 35);
  const st = currentStage(G, p);
  if (st.id === "writing") C *= cfg.writing_floor + (1 - cfg.writing_floor) * writingCompletion(G, p);
  if (s.advisor) {
    const a = s.advisor.params;
    const adj = (a.stds - 3) * 1 + (a.avail - 3) * 1;
    N += adj; Sv += adj; C += adj;
  }
  const topic = s.world.topics.find(function (t) { return t.id === p.topic; });
  if (topic) N += (topic.hype - 50) * cfg.hype_weight;
  N += p.bonus.N; Sv += p.bonus.S; C += p.bonus.C;
  return { N: clamp(N, 0, 100), S: clamp(Sv, 0, 100), C: clamp(C, 0, 100) };
}

export function qualityFor(G, comps, venueId) {
  const v = G.D.venueById[venueId];
  const w = (v && v.weights) || { N: 0.33, S: 0.34, C: 0.33 };
  return comps.N * w.N + comps.S * w.S + comps.C * w.C;
}

export function weakestComp(comps) {
  let k = "N";
  ["S", "C"].forEach(function (c) { if (comps[c] < comps[k]) k = c; });
  return k;
}

// ---- Daily work -----------------------------------------------------------

const FUND_COMPUTE = [0.8, 0.9, 1, 1.08, 1.15];
const AVAIL_WRITING = [0.85, 0.92, 1, 1.05, 1.1];

export function workDay(G, p, eff, log) {
  const s = G.state;
  const cfg = G.D.config;
  const st = currentStage(G, p);
  p.days = (p.days || 0) + 1;
  if (st.kind === "wait" || p.pause > 0) return;
  const skill = s.stats[st.skill] || 0;
  let rate = cfg.progress.rate * eff * (0.6 + 0.8 * skill / 100);
  rate *= 1 + (G.rng.next() * 2 - 1) * cfg.progress.roll;
  if (hasTrait(G, "perfectionist")) rate *= 0.87;
  if (hasTrait(G, "procrastinator")) {
    const ttd = turnsToDeadline(G, p);
    if (ttd !== null && ttd <= 2) rate *= 1.4;
    else if (p.progress < stageNeed(G, p) * 0.5) rate *= 0.8;
  }
  if (hasTrait(G, "introvert") && (st.id === "lit" || st.id === "writing" || st.id === "revise")) rate *= 1.1;
  if (s.advisor && st.compute) rate *= FUND_COMPUTE[s.advisor.params.fund - 1];
  if (s.advisor && (st.id === "writing" || st.id === "revise")) {
    rate *= AVAIL_WRITING[s.advisor.params.avail - 1];
    if (s.advisor.archetype === "kind_funded") rate *= 1.07;
  }
  p.progress += rate;

  let dayQ = cfg.quality.base + cfg.quality.per_skill * skill;
  if (hasTrait(G, "perfectionist")) dayQ *= 1.1;
  if (hasTrait(G, "imposter_syndrome")) dayQ *= 1.05;
  if (st.stats && hasTrait(G, "stats_nerd")) dayQ += 5;
  if ((p.type === "study" || p.type === "system") && hasTrait(G, "career_switcher")) dayQ += 4;
  if (st.comp === "C" && s.advisor && s.advisor.archetype === "kind_funded") dayQ *= 1.1;
  if (p.revise) {
    // Revising addresses the weakest components.
    const comps = components(G, p);
    const weak = weakestComp(comps);
    p.bonus[weak] += 0.5;
    p.bonus.C += 0.2;
  } else {
    p.q[st.comp].s += dayQ;
    p.q[st.comp].n += 1;
  }

  let g = cfg.skills.growth * (1 - skill / 100);
  if (st.skill === "writing" && s.advisor && s.advisor.archetype === "kind_funded") g *= 1.2;
  s.stats[st.skill] = clamp(skill + g, 0, 100);

  const need = stageNeed(G, p);
  if (p.progress >= need) {
    if (st.id === "writing" || st.id === "revise") {
      p.progress = need;
    } else {
      advanceStage(G, p, log);
    }
  }
}

export function advanceStage(G, p, log) {
  const stages = PROJECT_TYPES[p.type].stages;
  const done = currentStage(G, p);
  p.stageIdx = Math.min(p.stageIdx + 1, stages.length - 1);
  p.progress = 0;
  const next = currentStage(G, p);
  if (next.kind === "wait") p.wait = G.rng.int(weeks(next.wait[0]), weeks(next.wait[1]));
  if (log) log(p.short + ": " + STAGE_LABELS[done.id] + " done. Next: " + STAGE_LABELS[next.id] + ".");
  if (next.id === "writing" && !p.target) autoTarget(G, p);
}

// A project pivoted or shelved mid-revision withdraws the paper waiting on that revision.
export function withdrawRevision(G, p) {
  const t = p.target;
  const id = t && (t.rrPaper || t.journalPaper);
  if (!id) return;
  const pp = G.state.papers.find(function (x) { return x.id === id; });
  if (pp && pp.status === "revise_resubmit") { pp.status = "rejected"; pp.withdrawn = true; }
  p.target = null;
}

// After submissions are finalized: any deadline that has now passed rolls to the next cycle.
export function rollMissedDeadlines(G) {
  activeProjects(G).forEach(function (p) {
    const t = p.target;
    if (!t || t.rrPaper || t.journalPaper || t.turn === null || t.turn === undefined) return;
    if (t.turn <= G.state.turn) autoTarget(G, p, { minLead: 1 });
  });
}

export function tickProjects(G, log) {
  activeProjects(G).forEach(function (p) {
    const st = currentStage(G, p);
    if (p.pause > 0) p.pause--;
    if (st.kind === "wait") {
      p.wait--;
      if (p.wait <= 0) advanceStage(G, p, log);
    }
    // A missed deadline rolls the target to the next cycle.
    if (p.target && !p.target.rrPaper && !p.target.journalPaper && p.target.turn !== null && p.target.turn < G.state.turn) autoTarget(G, p);
  });
}

export function deadlineLabel(G, p) {
  if (!p.target) return "";
  const v = G.D.venueById[p.target.venueId];
  const c = v && v.cycles[p.target.cycle];
  return c ? c.name : v ? v.name : "";
}

export function absToLabel(G, turn) {
  return "Y" + yearOf(turn) + " " + weekDates(turn);
}

export { TURNS };
