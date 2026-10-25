// Validates the PhD Simulator content against docs/phd-simulator/content-spec.md.
//   ruby tools/phd-sim/export-data.rb && node --experimental-default-type=module tools/phd-sim/validate.mjs
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { prepareData } from "../../assets/js/phd-sim/engine/data.js";
import { PROJECT_TYPES } from "../../assets/js/phd-sim/engine/projects.js";
import { STAT_IDS } from "../../assets/js/phd-sim/engine/state.js";
import { parseValue } from "../../assets/js/phd-sim/engine/util.js";
import { ART_FILES } from "../../assets/js/phd-sim/ui/art-manifest.js";

const here = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(process.argv[2] || join(here, "out", "data.json"), "utf8"));
const D = prepareData(raw);
const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(where + ": " + msg);
const warn = (where, msg) => warnings.push(where + ": " + msg);

const CATEGORIES = ["research", "data", "writing", "reviews", "advisor", "legion", "lab", "milestone", "teaching", "career", "travel", "world", "life", "wellbeing", "exit"];
const HOOKS = ["turn", "deadline", "after_submit", "reviews_in", "after_accept", "after_reject", "conference", "internship", "defense_prep", "defense", "job_market", "model_release", "graduation", "sick", "exhausted",
  "conf_arrival", "conf_session", "conf_question", "conf_coffee", "conf_sightseeing", "conf_night", "conf_party", "conf_talk", "conf_poster", "conf_last"];
const RARITY = ["common", "uncommon", "rare", "legendary"];
const PREFIX = { research: "res_", data: "dat_", writing: "wri_", reviews: "rev_", advisor: "adv_", legion: "leg_", lab: "lab_", milestones: "mil_", teaching: "tea_", career: "car_", travel: "tra_", conference: "con_", world: "wor_", life: "lif_", wellbeing: "wel_", exits: "exi_", tasks: "tsk_" };
// "says" is added when the data loads: the quotes engine/quotes.js finds in each event.
const EVENT_KEYS = ["id", "title", "category", "rarity", "hook", "trigger", "repeatable", "cooldown", "weight", "arc", "when", "text", "choices", "file", "says"];
const CHOICE_KEYS = ["label", "requires", "tag", "check", "success", "failure", "text", "effects", "flag_set", "flag_clear", "counter", "status", "status_remove", "trait_add", "schedule", "achievement", "tip", "ending", "unlock"];
const OUTCOME_KEYS = ["text", "effects", "flag_set", "flag_clear", "counter", "status", "status_remove", "trait_add", "schedule", "achievement", "tip", "ending"];
const COND_KEYS = ["year", "turn", "semester", "stat", "has_advisor", "advisor", "advisor_not", "background", "origin", "traits_any", "traits_none", "flags_all", "flags_any", "flags_none", "counter", "status_any", "status_none", "milestone", "project", "paper", "world", "telemetry", "chance", "any", "not", "trip"];
const TELEMETRY = ["turns", "overtime_days", "overtime_streak", "burnouts", "days_off_streak", "submissions", "acceptances", "rejections", "desk_rejects", "first_author_pubs", "coauthor_pubs", "citations", "h_index", "conferences", "rebuttals", "reading_days", "social_days", "ta_semesters", "lab_meetings_in_person", "top_pubs", "workshop_pubs", "min_sanity", "internships", "study_projects", "mentor_days", "rest_days", "exercise_days", "ideas", "scoops", "resubmissions", "events_seen"];
const EFFECT_PROJECT = ["project.progress", "project.quality.N", "project.quality.S", "project.quality.C", "project.delay", "project.pivot", "project.abandon"];
const EFFECT_PAPER = ["paper.score", "paper.desk_reject", "paper.citations"];
const EFFECT_OTHER = ["days", "days_next", "career_prep", "citations", "contacts", "prep"];
const STAGES = new Set(["revise"]);
Object.values(PROJECT_TYPES).forEach((t) => t.stages.forEach((s) => STAGES.add(s.id)));
const ARCHETYPES = new Set(D.archetypes.map((a) => a.id));
const TRAITS = new Set(Object.keys(D.traitById));
const EARNED = new Set(D.earnedTraits.map((t) => t.id));
const STATUSES = new Set(D.statuses.map((s) => s.id));
const ACHIEVEMENTS = new Set(D.achievements.map((a) => a.id));
const TOPICS = new Set(Object.keys(D.phd101));
const ENDINGS = new Set(D.endings.map((e) => e.id));
const TOKENS = ["player", "advisor", "labmate", "labmate2", "senior", "mentee", "project", "project.topic", "paper", "venue", "city", "company", "model", "biglab", "committee", "roll", "topic", "fake_prior", "prof", "stranger"];

function checkCond(where, c) {
  if (c === undefined || c === null) return;
  if (typeof c !== "object" || Array.isArray(c)) return err(where, "condition must be a mapping");
  for (const [k, v] of Object.entries(c)) {
    if (!COND_KEYS.includes(k)) { err(where, "unknown condition key '" + k + "'"); continue; }
    if (k === "stat") Object.keys(v).forEach((s) => { if (!STAT_IDS.includes(s) && s !== "citations" && s !== "h_index") err(where, "unknown stat '" + s + "'"); });
    if (k === "advisor" || k === "advisor_not") [].concat(v).forEach((a) => { if (!ARCHETYPES.has(a)) err(where, "unknown advisor '" + a + "'"); });
    if (k === "traits_any" || k === "traits_none") [].concat(v).forEach((t) => { if (!TRAITS.has(t)) err(where, "unknown trait '" + t + "'"); });
    if (k === "status_any" || k === "status_none") [].concat(v).forEach((t) => { if (!STATUSES.has(t)) err(where, "unknown status '" + t + "'"); });
    if (k === "telemetry") Object.keys(v).forEach((t) => { if (!TELEMETRY.includes(t)) err(where, "unknown telemetry '" + t + "'"); });
    if (k === "trip") {
      Object.keys(v).forEach((tk) => { if (!["kind", "talk", "days", "did", "did_not"].includes(tk)) err(where, "unknown trip field '" + tk + "'"); });
      [].concat(v.did || [], v.did_not || []).forEach((id) => { if (!D.conference.activities.some((a) => a.id === id)) err(where, "unknown conference activity '" + id + "'"); });
    }
    if (k === "project") {
      Object.keys(v).forEach((pk) => { if (!["type", "stage", "stage_kind", "turns_to_deadline", "status", "first_author"].includes(pk)) err(where, "unknown project field '" + pk + "'"); });
      [].concat(v.type || []).forEach((t) => { if (!PROJECT_TYPES[t]) err(where, "unknown project type '" + t + "'"); });
      [].concat(v.stage || []).forEach((s) => { if (!STAGES.has(s)) err(where, "unknown stage '" + s + "'"); });
    }
    if (k === "any") [].concat(v).forEach((sub, i) => checkCond(where + ".any[" + i + "]", sub));
    if (k === "not") checkCond(where + ".not", v);
  }
}

function checkValue(where, key, v) {
  if (typeof v === "boolean") return;
  if (!parseValue(v)) err(where, "bad value '" + v + "' for " + key);
}

function checkTokens(where, text) {
  if (typeof text !== "string") return;
  for (const m of text.matchAll(/\{([a-z0-9_.]+)(?::\d+-\d+)?(?:\|[a-z]+)?\}/gi)) {
    const k = m[1];
    if (!TOKENS.includes(k) && !k.startsWith("counter.")) err(where, "unknown token {" + k + "}");
  }
}

function checkOutcome(where, o, ev, schedules) {
  if (!o || typeof o !== "object") return err(where, "outcome must be a mapping");
  for (const k of Object.keys(o)) if (!CHOICE_KEYS.includes(k)) err(where, "unknown outcome key '" + k + "'");
  checkTokens(where, o.text);
  for (const [k, v] of Object.entries(o.effects || {})) {
    if (STAT_IDS.includes(k) || EFFECT_OTHER.includes(k)) checkValue(where, k, v);
    else if (EFFECT_PROJECT.includes(k)) { checkValue(where, k, v); if (!JSON.stringify(ev.when || {}).includes('"project"') && ev.hook !== "deadline" && !where.startsWith("side/")) warn(where, k + " without a bound project"); }
    else if (EFFECT_PAPER.includes(k)) { checkValue(where, k, v); }
    else err(where, "unknown effect '" + k + "'");
  }
  [].concat(o.status || []).forEach((s) => { if (!s || !STATUSES.has(s.add)) err(where, "unknown status add " + JSON.stringify(s)); });
  [].concat(o.status_remove || []).forEach((s) => { if (!STATUSES.has(s)) err(where, "unknown status_remove '" + s + "'"); });
  // Leave activities may also give a start trait (Musician, Gym Rat) that clashes with none (state.js EXCLUSIVE).
  if (o.trait_add && !EARNED.has(o.trait_add) && !(ev.file === "leave" && D.traitById[o.trait_add])) err(where, "trait_add must be an earned trait, got '" + o.trait_add + "'");
  [].concat(o.achievement || []).forEach((a) => { if (!ACHIEVEMENTS.has(a)) err(where, "unknown achievement '" + a + "'"); });
  if (o.tip && !TOPICS.has(o.tip)) err(where, "unknown PhD 101 topic '" + o.tip + "'");
  if (o.ending) { if (!ENDINGS.has(o.ending)) err(where, "unknown ending '" + o.ending + "'"); if (ev.file !== "exits") err(where, "ending used outside exits.yml"); }
  [].concat(o.schedule || []).forEach((s) => schedules.push({ from: ev.id, to: s && s.event, where }));
  [].concat(o.unlock || []).forEach((u) => { if (!D.opportunityById[u]) err(where, "unknown opportunity '" + u + "' in unlock"); });
}

const ids = new Set();
const schedules = [];
for (const ev of D.events) {
  const where = ev.file + "/" + ev.id;
  for (const k of Object.keys(ev)) if (!EVENT_KEYS.includes(k)) err(where, "unknown event key '" + k + "'");
  if (ids.has(ev.id)) err(where, "duplicate id");
  ids.add(ev.id);
  if (PREFIX[ev.file] && !ev.id.startsWith(PREFIX[ev.file])) err(where, "id should start with " + PREFIX[ev.file]);
  if (!ev.title) err(where, "missing title");
  if (!CATEGORIES.includes(ev.category)) err(where, "bad category '" + ev.category + "'");
  if (!HOOKS.includes(ev.hook)) err(where, "bad hook '" + ev.hook + "'");
  if (!RARITY.includes(ev.rarity)) err(where, "bad rarity '" + ev.rarity + "'");
  if (!["random", "scheduled"].includes(ev.trigger)) err(where, "bad trigger");
  if (!ev.text.length) err(where, "missing text");
  ev.text.forEach((t) => { checkTokens(where, t); if (String(t).length > 320) warn(where, "text over 320 chars"); });
  checkTokens(where, ev.title);
  checkCond(where + ".when", ev.when);
  if (ev.choices.length < 1 || ev.choices.length > 4) err(where, "needs 1–4 choices, has " + ev.choices.length);
  ev.choices.forEach((c, i) => {
    const cw = where + ".choices[" + i + "]";
    if (!c.label) err(cw, "missing label");
    else { checkTokens(cw, c.label); if (c.label.length > 60) warn(cw, "label over 60 chars"); }
    checkCond(cw + ".requires", c.requires);
    if (c.check) {
      if (!c.check.stat || c.check.vs === undefined) err(cw, "check needs stat and vs");
      else if (!STAT_IDS.includes(c.check.stat) && c.check.stat !== "citations" && c.check.stat !== "prep") err(cw, "unknown check stat '" + c.check.stat + "'");
      checkOutcome(cw + ".success", c.success || {}, ev, schedules);
      checkOutcome(cw + ".failure", c.failure || {}, ev, schedules);
    } else checkOutcome(cw, c, ev, schedules);
  });
}
const reached = new Set();
for (const s of schedules) {
  const target = D.eventById[s.to];
  if (!target) err(s.where, "schedule target '" + s.to + "' does not exist");
  else { reached.add(s.to); if (target.trigger !== "scheduled") warn(s.where, "schedule target '" + s.to + "' is not trigger: scheduled"); }
}
for (const ev of D.events) if (ev.trigger === "scheduled" && !reached.has(ev.id)) err(ev.file + "/" + ev.id, "scheduled event is never scheduled");

const OPP_KEYS = ["id", "label", "reason", "desc", "when", "chance", "cooldown", "once", "days", "boost"].concat(CHOICE_KEYS);
const DAY_KINDS = ["read", "network", "help", "mentor", "career", "rest", "exercise", "social", "hobby", "family", "recharge", "writing_day", "project", "none"];
const oppIds = new Set();
for (const o of D.opportunities) {
  const where = "opportunities/" + o.id;
  if (!o.id || !o.id.startsWith("opp_")) err(where, "id should start with opp_");
  if (oppIds.has(o.id)) err(where, "duplicate id");
  oppIds.add(o.id);
  for (const k of Object.keys(o)) if (!OPP_KEYS.includes(k)) err(where, "unknown key '" + k + "'");
  if (!o.label) err(where, "missing label");
  if (o.days && !DAY_KINDS.includes(o.days)) err(where, "bad days '" + o.days + "'");
  if (o.days === "project" && !JSON.stringify(o.when || {}).includes('"project"')) warn(where, "days: project without a project condition");
  checkCond(where + ".when", o.when);
  checkTokens(where, o.label); checkTokens(where, o.reason);
  const outcome = {};
  for (const k of Object.keys(o)) if (CHOICE_KEYS.includes(k) && k !== "label") outcome[k] = o[k];
  checkOutcome(where, outcome, { id: o.id, file: "opportunities", when: o.when }, schedules);
}
const SIDE_KEYS = ["id", "label", "desc", "when", "weight", "helps"].concat(CHOICE_KEYS);
const HELPS = ["health", "stress", "energy", "social", "career"];
const sideIds = new Set();
for (const o of D.side) {
  const where = "side/" + o.id;
  if (!o.id || !o.id.startsWith("side_")) err(where, "id should start with side_");
  if (sideIds.has(o.id)) err(where, "duplicate id");
  sideIds.add(o.id);
  for (const k of Object.keys(o)) if (!SIDE_KEYS.includes(k)) err(where, "unknown key '" + k + "'");
  if (!o.label) err(where, "missing label");
  if (!o.effects) warn(where, "no effects");
  if (o.helps && !HELPS.includes(o.helps)) err(where, "bad helps '" + o.helps + "'");
  checkCond(where + ".when", o.when);
  checkTokens(where, o.label); checkTokens(where, o.desc);
  const outcome = {};
  for (const k of Object.keys(o)) if (CHOICE_KEYS.includes(k) && k !== "label") outcome[k] = o[k];
  checkOutcome(where, outcome, { id: o.id, file: "side", when: o.when }, schedules);
}
const LEAVE_KEYS = ["id", "label", "desc", "icon", "when", "text", "after", "effects", "flag_set"];
const leaveIds = new Set();
for (const o of D.leave) {
  const where = "leave/" + o.id;
  if (!o.id || !o.id.startsWith("leave_")) err(where, "id should start with leave_");
  if (leaveIds.has(o.id)) err(where, "duplicate id");
  leaveIds.add(o.id);
  for (const k of Object.keys(o)) if (!LEAVE_KEYS.includes(k)) err(where, "unknown key '" + k + "'");
  if (!o.label) err(where, "missing label");
  if (!o.effects) warn(where, "no effects");
  if (!Array.isArray(o.text) || !o.text.length) warn(where, "no report lines (text)");
  checkCond(where + ".when", o.when);
  checkTokens(where, o.label); checkTokens(where, o.desc);
  checkOutcome(where, { effects: o.effects, flag_set: o.flag_set }, { id: o.id, file: "leave", when: o.when }, schedules);
  if (o.after) {
    if (!(o.after.turns >= 1)) err(where, "after.turns should be 1 or more");
    const rest = Object.assign({}, o.after); delete rest.turns;
    checkOutcome(where + ".after", rest, { id: o.id, file: "leave", when: o.when }, schedules);
  }
}
// A week at a conference (conference.yml, engine/trip.js).
const CF = D.conference;
const SCENES = ["arrival", "day", "night", "eve", "after", "talk", "poster", "party", "last"];
for (const id of SCENES) { const sc = CF.scenes.find((x) => x.id === id); if (!sc || ![].concat(sc.text || []).length) err("conference/scenes", "missing scene '" + id + "'"); }
for (const sc of CF.scenes) { if (!SCENES.includes(sc.id)) err("conference/scenes", "unknown scene '" + sc.id + "'"); [].concat(sc.text || []).forEach((x) => checkTokens("conference/scenes/" + sc.id, x)); }
const ACT_KEYS = ["id", "slots", "talk", "kind", "always", "rest", "when", "label", "desc", "text", "effects", "flag_set", "achievement", "event", "weight"];
const actIds = new Set();
for (const a of CF.activities) {
  const where = "conference/" + a.id;
  if (actIds.has(a.id)) err(where, "duplicate id");
  actIds.add(a.id);
  for (const k of Object.keys(a)) if (!ACT_KEYS.includes(k)) err(where, "unknown key '" + k + "'");
  if (!a.label) err(where, "missing label");
  if (![].concat(a.text || []).length) err(where, "missing text");
  [].concat(a.slots || []).forEach((sl) => { if (!["arrival", "day", "night", "party", "last"].includes(sl)) err(where, "unknown slot '" + sl + "'"); });
  if (a.talk && !["before", "after", "just_after"].includes(a.talk)) err(where, "talk must be before, after or just_after");
  if (a.kind && !["talk", "poster"].includes(a.kind)) err(where, "kind must be talk or poster");
  if (a.event && !HOOKS.includes(a.event.hook)) err(where, "unknown event hook '" + a.event.hook + "'");
  checkCond(where + ".when", a.when);
  [a.label, a.desc].concat(a.text || []).forEach((x) => checkTokens(where, x));
  checkOutcome(where, { effects: a.effects, flag_set: a.flag_set, achievement: a.achievement }, { id: a.id, file: "conference", when: a.when }, schedules);
}
for (const sl of ["arrival", "day", "night", "party", "last"]) if (!CF.activities.some((a) => [].concat(a.slots).includes(sl) && a.rest)) err("conference", "no way to rest in slot '" + sl + "'");
for (const q of CF.questions) { if (!["knowledge", "weakness", "big_picture", "gotcha"].includes(q.kind)) err("conference/questions/" + q.id, "bad kind"); checkTokens("conference/questions/" + q.id, q.text); }
for (const a of CF.askers) checkTokens("conference/askers/" + a.id, a.label);
for (const h of HOOKS.filter((x) => x.startsWith("conf_"))) if (!(D.byHook[h] || []).length) err("conference", "no events for hook " + h);
for (const tp of D.topics) {
  const tt = tp.titles || {};
  for (const f of ["nlp", "hci"]) if (!Array.isArray(tt[f]) || tt[f].length < 2) err("topics/" + tp.id, "needs at least two " + f + " titles");
}
for (const v of D.venues) {
  if (!["nlp", "hci", "ml"].includes(v.field)) err("venues/" + v.id, "field must be nlp, hci or ml");
  if (v.field === "ml" && (v.types || []).some((ty) => ty === "study" || ty === "system")) err("venues/" + v.id, "ML venues take NLP papers only");
  for (const ty of v.types || []) if (!["empirical", "dataset", "position", "study", "system"].includes(ty)) err("venues/" + v.id, "unknown type '" + ty + "'");
  if (v.field === "nlp" && (v.types || []).some((ty) => ty === "study" || ty === "system")) err("venues/" + v.id, "NLP venues don't take HCI studies or systems");
  if (v.field === "hci" && (v.types || []).some((ty) => ty === "empirical" || ty === "dataset")) err("venues/" + v.id, "HCI venues don't take empirical NLP or dataset papers");
}
for (const a of D.achievements) checkCond("achievements/" + a.id, a.when);
for (const t of D.titles) checkCond("titles/" + t.id, t.when);
for (const t of D.epilogues) { checkCond("epilogues", t.when); checkTokens("epilogues", t.text); }
for (const t of D.tips) { checkCond("tips/" + t.id, t.when); if (!TOPICS.has(t.topic)) err("tips/" + t.id, "unknown topic '" + t.topic + "'"); }
for (const r of D.recommendations) { checkCond("recommendations/" + r.topic, r.when); if (!TOPICS.has(r.topic)) err("recommendations", "unknown topic '" + r.topic + "'"); }
for (const f of D.flavor) { if (!f.text) err("flavor", "missing text"); checkCond("flavor", f.when); checkTokens("flavor", f.text); }
const covered = new Set(D.recommendations.map((r) => r.topic));
for (const t of TOPICS) if (!covered.has(t)) warn("recommendations", "no rule for topic '" + t + "'");
for (const p of D.reviews.personas || []) if (!p.id || !p.openers) err("reviews/personas", "persona needs id and openers");
for (const c of D.reviews.concerns || []) { if (!["N", "S", "C", "fit"].includes(c.component)) err("reviews/" + c.id, "bad component"); [].concat(c.text).forEach((t) => checkTokens("reviews/" + c.id, t)); }
for (const q of D.qa.questions || []) if (!q.text || !q.kind || !q.skill || !q.stages) err("qa/" + q.id, "question needs text, kind, skill, stages");
for (const e of ["tenure_track", "masters_out", "eternal_student", "bubble_tea"]) if (!ENDINGS.has(e)) err("endings", "missing " + e);

// Every event category needs at least one picture (ui/art-manifest.js, written by import-art.py).
for (const c of new Set(D.events.map((e) => (e.category === "legion" ? "advisor" : e.category)))) {
  const list = ART_FILES[c] || [];
  if (!list.length) err("art", "no pictures for category '" + c + "'");
  for (const f of list) if (!existsSync(join(here, "../../assets/phd-sim/art/" + f))) err("art", "missing " + f + " (rerun tools/phd-sim/import-art.py)");
}

// Translations (tools/phd-sim/out/i18n-<lang>.json from export-data.rb): {tokens} must survive, and
// untranslated lines are counted (they fall back to English, so they're not errors).
for (const lang of ["zh"]) {
  const path = join(here, "out", "i18n-" + lang + ".json");
  if (!existsSync(path)) continue;
  const tree = JSON.parse(readFileSync(path, "utf8"));
  const TOK = /\{[a-z0-9_]+(?:\.[a-z0-9_]+)?(?::\d+-\d+)?(?:\|[a-z]+)?\}/gi;
  let rows = 0, done = 0;
  for (const [src, list] of Object.entries(tree)) {
    if (src === "_stale") continue;
    (list || []).forEach((r) => {
      rows++;
      const tr = (r && r[lang]) || "";
      if (!tr.trim()) return;
      done++;
      const a = (r.en.match(TOK) || []).sort().join(" "), b = (tr.match(TOK) || []).sort().join(" ");
      if (a !== b) err("i18n " + lang + "/" + src, "tokens differ in \"" + r.en.slice(0, 50) + "\": [" + a + "] vs [" + b + "]");
    });
  }
  console.log("Translations (" + lang + "): " + done + " of " + rows + " strings");
}

const byFile = {};
D.events.forEach((e) => { byFile[e.file] = (byFile[e.file] || 0) + 1; });
console.log("Events: " + D.events.length + " " + JSON.stringify(byFile));
console.log("Flavor: " + D.flavor.length + ", personas: " + (D.reviews.personas || []).length + ", concerns: " + (D.reviews.concerns || []).length + ", QA: " + (D.qa.questions || []).length);
console.log("Opportunities: " + D.opportunities.length + ", side activities: " + D.side.length);
console.log("Achievements: " + D.achievements.length + ", endings: " + D.endings.length + ", titles: " + D.titles.length + ", tips: " + D.tips.length);
warnings.forEach((w) => console.log("warn  " + w));
errors.forEach((e) => console.log("ERROR " + e));
console.log(errors.length + " errors, " + warnings.length + " warnings");
process.exit(errors.length ? 1 : 0);
