// Constants, calendar helpers and run creation.
import { Rng } from "./rng.js";
import { clamp, parseValue } from "./util.js";

export const TURNS = 26;
export const VISIBLE = ["energy", "sanity"];
export const SKILLS = ["taste", "coding", "writing", "presenting", "knowledge"];
export const RELS = ["advisor_rel", "labmates_rel", "family_rel", "friends_rel"];
export const HIDDEN = SKILLS.concat(RELS, ["network", "health"]);
export const STAT_IDS = VISIBLE.concat(HIDDEN);

export const STAT_LABELS = {
  energy: "Energy", sanity: "Sanity", citations: "Citations", health: "Health",
  taste: "Research taste", coding: "Coding", writing: "Writing", presenting: "Presenting",
  knowledge: "Domain knowledge", advisor_rel: "Advisor relationship", labmates_rel: "Labmates",
  family_rel: "Family", friends_rel: "Friends", network: "Network"
};

export const ACTIVITIES = [
  { id: "read", label: "Read broadly", kind: "work", desc: "Knowledge and taste. Sometimes an idea." },
  { id: "network", label: "Network", kind: "work", desc: "Talks, emails, reading groups. Network and a few citations." },
  { id: "help", label: "Help labmates", kind: "work", desc: "Labmates like you more. Sometimes a co-authorship." },
  { id: "mentor", label: "Mentor", kind: "work", desc: "Help your mentee grow." },
  { id: "career", label: "Career prep", kind: "work", desc: "Applications and interview practice." },
  { id: "rest", label: "Rest", kind: "self", desc: "Energy." },
  { id: "exercise", label: "Exercise", kind: "self", desc: "Energy and health." },
  { id: "social", label: "Friends", kind: "self", desc: "Sanity and friendships." },
  { id: "hobby", label: "Hobby", kind: "self", desc: "Sanity." },
  { id: "family", label: "Family time", kind: "self", desc: "Sanity and family." }
];
export const ACTIVITY_BY_ID = {};
ACTIVITIES.forEach(function (a) { ACTIVITY_BY_ID[a.id] = a; });

export function yearOf(turn) { return Math.floor(turn / TURNS) + 1; }
export function tOf(turn) { return (turn % TURNS) + 1; }
export function absTurn(year, t) { return (year - 1) * TURNS + (t - 1); }
export function semesterOf(t) {
  if (t <= 8) return "fall";
  if (t === 9) return "break";
  if (t <= 18) return "spring";
  return "summer";
}
export function semesterKey(turn) {
  const t = tOf(turn);
  const s = semesterOf(t);
  return yearOf(turn) + ":" + (s === "break" ? "fall" : s);
}

function rollValue(rng, v) {
  const p = parseValue(v);
  return p ? rng.triangular(p.center, p.spread) : 0;
}

// Three trait offers plus two random traits; the player keeps one offer.
export function rollTraits(D, seed, reroll) {
  const rng = new Rng(seed + ":traits:" + (reroll || 0));
  const pool = rng.shuffle(D.traits.map(function (t) { return t.id; }));
  return { offers: pool.slice(0, 3), random: pool.slice(3, 5) };
}

export function newRun(D, opts) {
  const cfg = D.config;
  const rng = new Rng(opts.seed);
  const bg = D.backgroundById[opts.background] || D.backgrounds[0];
  const traits = opts.traits.slice();

  const stats = {
    energy: clamp((cfg.start.energy || 80) + (bg.energy_bonus || 0), 0, 100),
    sanity: cfg.start.sanity || 70,
    health: clamp(rollValue(rng, cfg.start.health || 80), 0, 100),
    advisor_rel: cfg.start.advisor_rel || 50,
    labmates_rel: cfg.start.labmates_rel || 50,
    family_rel: cfg.start.family_rel || 60,
    friends_rel: cfg.start.friends_rel || 40,
    network: bg.network || 15
  };
  Object.keys(bg.skills).forEach(function (k) { stats[k] = bg.skills[k]; });
  if (traits.indexOf("code_wizard") >= 0) { stats.coding += 20; stats.writing -= 10; }
  if (traits.indexOf("wordsmith") >= 0) { stats.writing += 20; stats.coding -= 10; }
  Object.keys(stats).forEach(function (k) { stats[k] = clamp(stats[k], 0, 100); });

  const topics = rng.shuffle(D.topics).slice(0, 7).map(function (t) {
    return { id: t.id, name: t.name, hype: clamp((t.hype || 50) + rng.int(-10, 10), 5, 95), used: [] };
  });

  const state = {
    version: 1,
    seed: opts.seed,
    daily: !!opts.daily,
    rng: rng.state(),
    turn: 0,
    stage: "turn_start",
    phase: "playing",
    prompt: null,
    current: null,
    player: { name: opts.name || "Alex", background: bg.id, origin: opts.origin || "domestic", traits: traits },
    stats: stats,
    statuses: [],
    flags: {},
    counters: {},
    advisor: null,
    candidates: null,
    labmates: [],
    mentee: null,
    world: {
      topics: topics,
      hiring: "neutral",
      models: [],
      nextRelease: rng.int(4, 10),
      modelCount: 0,
      cities: {}
    },
    projects: [],
    papers: [],
    nextId: 1,
    routine: { days: { read: 3, social: 1, exercise: 1 }, overtime: 0, overtimeTarget: "read" },
    queue: [],
    pendingHooks: [],
    turnItems: [],
    dayAdj: 0,
    dayAdjNext: 0,
    careerPrep: 0,
    readiness: 0,
    bonusCitations: 0,
    milestones: {
      quals: "pending",
      qualsYear: rng.chance(0.5) ? 1 : 2,
      proposal: "pending",
      proposalAt: null,
      defensePrepStart: null,
      defense: "pending",
      graduated: false
    },
    ta: {},
    fellowshipYear: null,
    internship: null,
    job: null,
    offers: null,
    acceptedOffer: null,
    telemetry: {
      turns: 0, overtime_days: 0, overtime_streak: 0, burnouts: 0, days_off_streak: 0,
      submissions: 0, acceptances: 0, rejections: 0, desk_rejects: 0, first_author_pubs: 0,
      coauthor_pubs: 0, top_pubs: 0, workshop_pubs: 0, conferences: 0, rebuttals: 0,
      reading_days: 0, social_days: 0, ta_semesters: 0, lab_meetings_in_person: 0,
      events_seen: 0, min_sanity: stats.sanity, internships: 0, study_projects: 0,
      mentor_days: 0, rest_days: 0, exercise_days: 0, ideas: 0, scoops: 0, resubmissions: 0
    },
    seen: {},
    recentCats: [],
    lastTipTurn: -99,
    tipsShown: {},
    log: [],
    newAchievements: [],
    notices: [],
    ending: null
  };
  return state;
}
