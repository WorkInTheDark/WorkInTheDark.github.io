// Research projects: named stages, daily work, hidden quality, and venue deadlines.
import { clamp } from "./util.js";
import { absTurn, yearOf, tOf, TURNS, span, turnDates } from "./state.js";
import { hasTrait, hasStatus } from "./derived.js";

function S(id, kind, comp, skill, chance, extra) {
  const st = { id: id, kind: kind, comp: comp, skill: skill, chance: chance };
  if (extra) for (const k in extra) st[k] = extra[k];
  return st;
}

// A project moves through named stages. Each turn you work on it, the current stage gets one try
// at its set `chance` (Arthur's design, 2026-10-16): success moves to the next stage, failure
// stays. A short or tired turn lowers the chance; a full one, a crunch or a boost raises it a
// little. "Wait" stages (IRB, recruiting, annotation) just take time: `wait` in turns.
// There's no Writing stage: you write all along, and the last stage, Consolidation, pulls it
// together into one paper and tailors it to the venue.
export const PROJECT_TYPES = {
  empirical: {
    label: "Empirical NLP",
    stages: [S("idea", "work", "N", "taste", 0.8), S("lit", "work", "N", "knowledge", 0.7),
      S("pilot", "work", "S", "coding", 0.6), S("experiments", "work", "S", "coding", 0.5, { compute: true }),
      S("consolidation", "work", "C", "writing", 0.6)]
  },
  study: {
    label: "Human-centered study",
    stages: [S("idea", "work", "N", "taste", 0.8), S("lit", "work", "N", "knowledge", 0.7),
      S("design", "work", "S", "knowledge", 0.65), S("irb", "wait", null, null, 0, { wait: [1, 2] }),
      S("recruiting", "wait", null, null, 0, { wait: [1, 1] }), S("sessions", "work", "S", "presenting", 0.55),
      S("analysis", "work", "S", "knowledge", 0.6, { stats: true }), S("consolidation", "work", "C", "writing", 0.6)]
  },
  system: {
    label: "System + evaluation",
    stages: [S("idea", "work", "N", "taste", 0.8), S("lit", "work", "N", "knowledge", 0.7),
      S("build", "work", "S", "coding", 0.5), S("irb", "wait", null, null, 0, { wait: [1, 2] }),
      S("study", "work", "S", "presenting", 0.55), S("analysis", "work", "S", "knowledge", 0.6, { stats: true }),
      S("consolidation", "work", "C", "writing", 0.6)]
  },
  dataset: {
    label: "Dataset / benchmark",
    stages: [S("idea", "work", "N", "taste", 0.8), S("lit", "work", "N", "knowledge", 0.7),
      S("guidelines", "work", "S", "knowledge", 0.65), S("annotation", "wait", null, null, 0, { wait: [1, 2] }),
      S("baselines", "work", "S", "coding", 0.5), S("consolidation", "work", "C", "writing", 0.6)]
  },
  position: {
    label: "Position / survey",
    stages: [S("idea", "work", "N", "taste", 0.8), S("lit", "work", "N", "knowledge", 0.5),
      S("consolidation", "work", "C", "writing", 0.55)]
  }
};

// After a rejection or a revise-and-resubmit, the project goes back to one Revising stage.
export const REVISE_STAGE = S("revise", "work", "C", "writing", 0.6);

// Which community a paper is for: NLP papers go to NLP venues, HCI papers to HCI venues.
export const FIELD_LABELS = { nlp: "NLP", hci: "HCI", ml: "ML" };
export function fieldOf(p) {
  return p.field || (p.type === "study" || p.type === "system" ? "hci" : "nlp");
}

export const STAGE_LABELS = {
  idea: "Idea", lit: "Related work", pilot: "Pilot", experiments: "Experiments", consolidation: "Consolidation",
  design: "Study design", irb: "IRB review", recruiting: "Recruiting", sessions: "Study sessions",
  analysis: "Analysis", build: "Building", study: "User study", guidelines: "Annotation guidelines",
  annotation: "Annotation", baselines: "Baselines", revise: "Revising"
};

export function currentStage(G, p) {
  if (p.revise) return REVISE_STAGE;
  const stages = PROJECT_TYPES[p.type].stages;
  return stages[Math.min(p.stageIdx, stages.length - 1)];
}

export function stageChance(G, p) {
  return currentStage(G, p).chance || 0;
}

function finalStage(st) { return st.id === "consolidation" || st.id === "revise"; }

// Events can tip the odds of a project's next stage roll (n percentage points, kept within ±30).
export function nudgeOdds(G, p, n) {
  if (currentStage(G, p).kind === "wait") return;
  p.nudge = clamp((p.nudge || 0) + n / 100, -0.3, 0.3);
}

// The chance a turn of work finishes the current stage: the stage's set chance for a normal full
// turn. A short or tired turn keeps at least half of it (a busy Year 1 turn, about 80%); extra
// effort like a crunch adds at most 15%.
export function turnChance(G, p, effort) {
  const full = G.D.config.progress.full_turn || 6.5;
  const r = Math.max(0, effort / full);
  const f = r <= 1 ? 0.5 + 0.5 * r : 1 + 0.5 * Math.min(r - 1, 0.3);
  return clamp(stageChance(G, p) * f + (p.nudge || 0), 0, 0.95);
}

const CHANCE_WORDS = [[0.8, "very likely"], [0.6, "likely"], [0.45, "about even"], [0.3, "unlikely"], [0, "a long shot"]];
export function chanceWord(c) {
  for (let i = 0; i < CHANCE_WORDS.length; i++) if (c >= CHANCE_WORDS[i][0]) return CHANCE_WORDS[i][1];
  return "a long shot";
}

// End of turn: each project you worked on gets one try at finishing its stage.
export function rollStages(G, log) {
  activeProjects(G).forEach(function (p) {
    const st = currentStage(G, p);
    const effort = p.turnEffort || 0;
    p.turnEffort = 0;
    if (effort <= 0 || st.kind === "wait" || p.ready) return;
    p.lastWorked = G.state.turn;
    const c = turnChance(G, p, effort);
    p.nudge = 0;
    if (!G.rng.chance(c)) { p.stuck = (p.stuck || 0) + 1; return; }
    p.stuck = 0;
    if (finalStage(st)) {
      p.ready = true;
      if (log) log(p.short + ": " + (p.revise ? "the revision is done." : "it all comes together.") + " Ready to submit.");
    } else {
      advanceStage(G, p, log);
    }
  });
}

// For display: where a project stands, in words.
export function stageInfo(G, p) {
  const st = currentStage(G, p);
  const stages = PROJECT_TYPES[p.type].stages;
  let hint = "";
  if (st.kind === "wait") hint = "waiting, about " + Math.max(1, p.wait) * 2 + " weeks";
  else if (p.pause > 0) hint = "on hold for " + p.pause * 2 + " weeks";
  else if (p.ready) hint = "ready to submit";
  else hint = chanceWord(stageChance(G, p)) + " to finish in a full turn of work";
  return {
    label: p.revise ? STAGE_LABELS.revise : STAGE_LABELS[st.id],
    n: p.revise ? stages.length : Math.min(p.stageIdx, stages.length - 1) + 1,
    of: stages.length,
    hint: hint,
    ready: !!p.ready && finalStage(st),
    wait: st.kind === "wait",
    stuck: p.stuck || 0
  };
}

// Submittable: in Consolidation (or Revising), finished or not. A finished paper reads better.
export function isReady(G, p) {
  return finalStage(currentStage(G, p));
}

// How finished the paper is, for clarity: done, being pulled together, or not there yet.
export function writingCompletion(G, p) {
  const st = currentStage(G, p);
  if (!finalStage(st)) return 0;
  return p.ready ? 1 : 0.5;
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
  const field = type === "position" ? (G.rng.chance(0.5) ? "nlp" : "hci") : (type === "study" || type === "system" ? "hci" : "nlp");
  // Titles come from the project's own field, so an NLP paper never sounds like a CHI paper.
  const data = G.D.topicById[topic.id] || { titles: {} };
  const pool = (data.titles && data.titles[field]) || [];
  const unused = pool.filter(function (t) { return topic.used.indexOf(t) < 0; });
  let title = opts.title || (unused.length ? G.rng.pick(unused) : null);
  if (!title) title = "More on " + topic.name.charAt(0).toUpperCase() + topic.name.slice(1) + " (Part " + (topic.used.length + 1) + ")";
  topic.used.push(title);
  const p = {
    id: "p" + s.nextId++,
    type: type,
    field: field,
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

// The venues a project can go to: its own field's venues that take its kind of paper. NLP papers
// can also go to the top machine learning conferences.
const FIELD_VENUES = { nlp: ["nlp", "ml"], hci: ["hci"] };
export function venuesFor(G, p, opts) {
  opts = opts || {};
  const ok = FIELD_VENUES[fieldOf(p)] || [];
  return G.D.venues.filter(function (v) {
    if (v.types.indexOf(p.type) < 0 || (v.field && ok.indexOf(v.field) < 0)) return false;
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
      const at = absTurn(y, c.deadline);
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

// Roughly how many turns until a project is ready, for picking a realistic first target.
function remainingTurns(G, p) {
  if (p.ready) return 0;
  if (p.revise) return 1 / REVISE_STAGE.chance;
  const stages = PROJECT_TYPES[p.type].stages;
  let w = 0;
  for (let i = p.stageIdx; i < stages.length; i++) {
    const st = stages[i];
    if (st.kind === "wait") w += i === p.stageIdx ? Math.max(0, p.wait) : (st.wait[0] + st.wait[1]) / 2;
    else w += 1.3 / st.chance;   // a few rest turns in between
  }
  return w;
}

export function autoTarget(G, p, opts) {
  opts = opts || {};
  const s = G.state;
  const lead = Math.max(1, Math.ceil(remainingTurns(G, p)));
  const from = s.turn + Math.max(span(opts.minLead || 1), Math.min(lead, 30));
  const vs = venuesFor(G, p, { onlyWorkshops: opts.onlyWorkshops, includeJournals: false })
    .filter(function (v) { return opts.onlyWorkshops || v.tier !== "workshop" || p.type === "position"; });
  let options = vs.map(function (v) { return nextDeadline(G, v.id, from); }).filter(Boolean);
  if (!options.length) options = venuesFor(G, p, {}).map(function (v) { return nextDeadline(G, v.id, from); }).filter(Boolean);
  options.sort(function (a, b) { return a.turn - b.turn; });
  const soonest = options[0];
  if (!soonest) { p.target = null; return; }
  const tierRank = { top: 0, mid: 1, workshop: 2, journal: 3 };
  const close = options.filter(function (o) { return o.turn <= soonest.turn + 3; });
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
  if (st.id === "consolidation") C *= cfg.writing_floor + (1 - cfg.writing_floor) * writingCompletion(G, p);
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

export function workDay(G, p, eff, log, opts) {
  const s = G.state;
  const cfg = G.D.config;
  const st = currentStage(G, p);
  p.days = (p.days || 0) + 1;
  if (st.kind === "wait" || p.pause > 0) return;
  // Related work is mostly reading: a turn of reading counts for more than "working on it".
  if (st.id === "lit") eff *= opts && opts.reading ? cfg.progress.read_lit : cfg.progress.work_lit;
  // How much this day counts toward the turn's try at finishing the stage (a full turn is about 6.5).
  const skill = s.stats[st.skill] || 0;
  let day = eff * (0.6 + 0.8 * skill / 100);
  if (hasTrait(G, "perfectionist")) day *= 0.87;
  if (hasTrait(G, "procrastinator")) {
    const ttd = turnsToDeadline(G, p);
    day *= ttd !== null && ttd <= 1 ? 1.4 : 0.85;
  }
  if (hasTrait(G, "introvert") && (st.id === "lit" || st.id === "consolidation" || st.id === "revise")) day *= 1.1;
  if (s.advisor && st.compute) day *= FUND_COMPUTE[s.advisor.params.fund - 1];
  if (s.advisor && (st.id === "consolidation" || st.id === "revise")) {
    day *= AVAIL_WRITING[s.advisor.params.avail - 1];
    if (s.advisor.archetype === "kind_funded") day *= 0.97;   // meticulous about every figure
  }
  p.turnEffort = (p.turnEffort || 0) + day;

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
    // You write all along, not just at the end: every stage adds to the paper's clarity.
    if (st.comp !== "C") { p.q.C.s += dayQ * 0.4; p.q.C.n += 0.4; }
  }

  let g = cfg.skills.growth * (1 - skill / 100);
  if (st.skill === "writing" && s.advisor && s.advisor.archetype === "kind_funded") g *= 1.2;
  s.stats[st.skill] = clamp(skill + g, 0, 100);

}

// A reading day gives projects that aren't in Related work a small chance of moving too.
export function readTrickle(G, p) {
  const st = currentStage(G, p);
  if (st.kind === "wait" || p.pause > 0 || p.revise || p.ready) return;
  p.turnEffort = (p.turnEffort || 0) + (G.D.config.progress.read_trickle || 0.05);
}

export function advanceStage(G, p, log) {
  const stages = PROJECT_TYPES[p.type].stages;
  const done = currentStage(G, p);
  p.stageIdx = Math.min(p.stageIdx + 1, stages.length - 1);
  p.ready = false;
  const next = currentStage(G, p);
  if (next.kind === "wait") p.wait = G.rng.int(next.wait[0], next.wait[1]);
  if (log) log(p.short + ": " + STAGE_LABELS[done.id] + " is done. On to " + STAGE_LABELS[next.id] +
    (next.kind === "wait" ? " (about " + p.wait * 2 + " weeks)" : "") + ".");
  if (next.id === "consolidation" && !p.target) autoTarget(G, p);
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
  return "Y" + yearOf(turn) + " " + turnDates(turn);
}

export { TURNS };
