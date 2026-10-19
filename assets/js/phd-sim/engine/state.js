// Constants, calendar helpers and run creation.
import { Rng } from "./rng.js";
import { clamp, parseValue } from "./util.js";

// One turn is two weeks (T1–T26 a year, starting 1 September). Content and config count in turns.
export const TURNS = 26;
// "sanity" is shown to the player as Stress (100 − sanity), so content keeps "up is good".
export const VISIBLE = ["energy", "sanity", "health"];
export const SKILLS = ["taste", "coding", "writing", "presenting", "knowledge"];
export const RELS = ["advisor_rel", "labmates_rel", "family_rel", "friends_rel"];
export const HIDDEN = SKILLS.concat(RELS, ["network"]);
export const STAT_IDS = VISIBLE.concat(HIDDEN);

export const STAT_LABELS = {
  energy: "Energy", sanity: "Stress", citations: "Citations", health: "Health",
  taste: "Research taste", coding: "Coding", writing: "Writing", presenting: "Presenting",
  knowledge: "Domain knowledge", advisor_rel: "Advisor relationship", labmates_rel: "Labmates",
  family_rel: "Family", friends_rel: "Friends", network: "Network"
};

// Day activities: what a focus, an opportunity or a side activity spends days on.
// `arrows` preview the visible effects (players never see numbers before choosing).
export const ACTIVITIES = [
  { id: "read", label: "Read papers", kind: "work", desc: "Domain knowledge and research taste. Sometimes an idea.",
    arrows: [{ stat: "energy", dir: "down", strength: 1 }] },
  { id: "network", label: "Network", kind: "work", desc: "Talks, emails, reading groups. People start to know your name.",
    arrows: [{ stat: "energy", dir: "down", strength: 1 }, { stat: "citations", dir: "up", strength: 1 }] },
  { id: "help", label: "Help labmates", kind: "work", desc: "Your lab likes you more. Sometimes it turns into a co-authorship.",
    arrows: [{ stat: "energy", dir: "down", strength: 1 }] },
  { id: "mentor", label: "Mentor your undergrad", kind: "work", desc: "Teaching is learning twice.",
    arrows: [{ stat: "energy", dir: "down", strength: 1 }] },
  { id: "career", label: "Practice talks and interviews", kind: "work", desc: "Presenting skills, and better odds on applications.",
    arrows: [{ stat: "energy", dir: "down", strength: 1 }] },
  { id: "rest", label: "Rest", kind: "self", desc: "Sleep in. Do nothing. It counts.",
    arrows: [{ stat: "energy", dir: "up", strength: 2 }] },
  { id: "exercise", label: "Exercise", kind: "self", desc: "Good for energy, mood, and the body you'll need in year five.",
    arrows: [{ stat: "health", dir: "up", strength: 2 }, { stat: "energy", dir: "up", strength: 1 }, { stat: "sanity", dir: "up", strength: 1 }] },
  { id: "social", label: "See friends", kind: "self", desc: "The best cure for the lab.",
    arrows: [{ stat: "sanity", dir: "up", strength: 2 }] },
  { id: "hobby", label: "Hobby", kind: "self", desc: "Something that has nothing to do with research.",
    arrows: [{ stat: "sanity", dir: "up", strength: 1 }, { stat: "energy", dir: "up", strength: 1 }] },
  { id: "family", label: "Call family", kind: "self", desc: "They miss you, and you miss them.",
    arrows: [{ stat: "sanity", dir: "up", strength: 1 }, { stat: "energy", dir: "up", strength: 1 }] }
];
ACTIVITIES.push({ id: "recharge", label: "Recharge", kind: "self", desc: "Sleep in, see friends, or do nothing useful for a while.",
  arrows: [{ stat: "energy", dir: "up", strength: 2 }, { stat: "sanity", dir: "up", strength: 2 }, { stat: "health", dir: "up", strength: 2 }] });
ACTIVITIES.push({ id: "writing_day", label: "Write", kind: "work", desc: "Statements, proposals, chapters.",
  arrows: [{ stat: "energy", dir: "down", strength: 1 }] });
ACTIVITIES.push({ id: "quals_study", label: "Prepare for quals", kind: "work", desc: "Practice questions, the reading list, mock exams.",
  arrows: [{ stat: "energy", dir: "down", strength: 1 }] });

// The few things you can always focus a turn on. Everything else comes up as an opportunity.
export const DEFAULT_ACTIONS = [
  { id: "read", label: "Read and learn", desc: "Two weeks with papers. Projects inch forward; sometimes you get an idea.",
    arrows: [{ stat: "energy", dir: "down", strength: 1 }, { stat: "progress", dir: "up", strength: 1 }] },
  { id: "recharge", label: "Recharge", desc: "Sleep in, see friends, or do nothing useful for a while.",
    arrows: [{ stat: "energy", dir: "up", strength: 2 }, { stat: "sanity", dir: "up", strength: 2 }, { stat: "health", dir: "up", strength: 2 }] }
];
export const ACTIVITY_BY_ID = {};
ACTIVITIES.forEach(function (a) { ACTIVITY_BY_ID[a.id] = a; });

export function yearOf(turn) { return Math.floor(turn / TURNS) + 1; }
export function tOf(turn) { return (turn % TURNS) + 1; }
export function absTurn(year, t) { return (year - 1) * TURNS + (t - 1); }
// A duration from content or config, in turns (two weeks each).
export function span(n) { return Math.max(0, Math.round(Number(n) || 0)); }
// Players read time in weeks.
export const WEEKS_PER_TURN = 2;

const MONTHS = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
const MONTH_DAYS = [30, 31, 30, 31, 31, 28, 31, 30, 31, 30, 31, 31];
function dayToDate(d) {
  let m = 0;
  while (m < 11 && d >= MONTH_DAYS[m]) { d -= MONTH_DAYS[m]; m++; }
  return { m: m, d: d + 1 };
}
export function turnDates(turn) {
  const start = dayToDate((turn % TURNS) * 14);
  const end = dayToDate((turn % TURNS) * 14 + 13);
  return MONTHS[start.m] + " " + start.d + "\u2013" + (end.m === start.m ? "" : MONTHS[end.m] + " ") + end.d;
}
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

const EXCLUSIVE = [["code_wizard", "wordsmith"], ["early_bird", "night_owl"], ["introvert", "social_butterfly"],
  ["resilient", "anxious"], ["industry_veteran", "career_switcher"], ["optimist", "imposter_syndrome"],
  ["code_wizard", "industry_veteran"], ["polyglot", "international"]];

// Traits are rolled at random: no choosing, no rerolls.
export function rollTraits(D, seed) {
  const rng = new Rng(seed + ":traits");
  const n = (D.config.turn && D.config.turn.traits) || 3;
  const out = [];
  rng.shuffle(D.traits.map(function (t) { return t.id; })).forEach(function (id) {
    if (out.length >= n) return;
    const clash = EXCLUSIVE.some(function (pair) { return pair.indexOf(id) >= 0 && out.indexOf(pair[0] === id ? pair[1] : pair[0]) >= 0; });
    if (!clash) out.push(id);
  });
  return out;
}

export function newRun(D, opts) {
  const cfg = D.config;
  const rng = new Rng(opts.seed);
  const traits = (opts.traits || rollTraits(D, opts.seed)).slice();
  const has = function (t) { return traits.indexOf(t) >= 0; };

  const stats = {
    energy: cfg.start.energy || 80,
    sanity: cfg.start.sanity || 70,
    health: clamp(rollValue(rng, cfg.start.health || 80), 0, 100),
    advisor_rel: cfg.start.advisor_rel || 50,
    labmates_rel: cfg.start.labmates_rel || 50,
    family_rel: cfg.start.family_rel || 60,
    friends_rel: cfg.start.friends_rel || 40,
    network: cfg.start.network || 15
  };
  const base = cfg.start.skills || { taste: 26, coding: 32, writing: 28, presenting: 28, knowledge: 26 };
  Object.keys(base).forEach(function (k) { stats[k] = base[k] + rng.int(-3, 3); });
  if (has("code_wizard")) { stats.coding += 20; stats.writing -= 10; }
  if (has("wordsmith")) { stats.writing += 20; stats.coding -= 10; }
  if (has("industry_veteran")) { stats.coding += 18; stats.network += 15; stats.writing -= 5; }
  if (has("career_switcher")) { stats.knowledge += 25; stats.coding -= 12; stats.presenting += 5; }
  Object.keys(stats).forEach(function (k) { stats[k] = clamp(stats[k], 0, 100); });
  const background = has("industry_veteran") ? "industry" : has("career_switcher") ? "switcher" : has("head_start") ? "masters" : "undergrad";

  const topics = rng.shuffle(D.topics).slice(0, 7).map(function (t) {
    return { id: t.id, name: t.name, hype: clamp((t.hype || 50) + rng.int(-10, 10), 5, 95), used: [] };
  });

  const state = {
    version: 5,
    seed: opts.seed,
    daily: !!opts.daily,
    rng: rng.state(),
    turn: 0,
    stage: "turn_start",
    phase: "playing",
    prompt: null,
    current: null,
    player: { name: opts.name || "Alex", background: background, origin: has("international") ? "international" : "domestic", traits: traits },
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
      nextRelease: rng.int(8, 20),
      modelCount: 0,
      cities: {}
    },
    projects: [],
    papers: [],
    nextId: 1,
    lastPlan: null,
    plan: null,
    endItems: [],
    report: null,
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
