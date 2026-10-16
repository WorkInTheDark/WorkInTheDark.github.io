// Headless balance simulator: plays many runs with simple bot policies and reports outcomes.
//   node --experimental-default-type=module tools/phd-sim/simulate.mjs [runs=200] [policy=mixed]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { prepareData, newRun, Game, firstAuthorPubs, totalCitations, hIndex } from "../../assets/js/phd-sim/engine/index.js";
import { Rng } from "../../assets/js/phd-sim/engine/rng.js";
import { TURNS } from "../../assets/js/phd-sim/engine/state.js";
import { activeProjects } from "../../assets/js/phd-sim/engine/projects.js";

const here = dirname(fileURLToPath(import.meta.url));
const D = prepareData(JSON.parse(readFileSync(join(here, "out", "data.json"), "utf8")));
const RUNS = parseInt(process.argv[2] || "200", 10);
const POLICY = process.argv[3] || "mixed";
const POLICIES = ["balanced", "workaholic", "slacker", "random"];

// Picks one action for the week, the way each kind of player might.
function pickAction(p, policy, rng, stats) {
  const A = p.actions;
  const by = (kind) => A.filter((a) => a.kind === kind);
  const has = (id) => A.some((a) => a.id === id);
  const sanityOpp = by("opportunity").find((a) => (a.arrows || []).some((x) => x.stat === "sanity" && x.dir === "up"));
  const boostOpp = by("opportunity").find((a) => (a.arrows || []).some((x) => x.stat === "progress"));
  const submit = A.find((a) => a.id.indexOf("submit:") === 0);
  const crunch = A.find((a) => a.id.indexOf("crunch:") === 0);
  const projects = by("project");
  if (policy === "random") return rng.pick(A).id;
  if (policy === "slacker") {
    if (by("opportunity").length && rng.chance(0.8)) return rng.pick(by("opportunity")).id;
    if (submit && rng.chance(0.5)) return submit.id;
    if (by("milestone").length && rng.chance(0.25)) return by("milestone")[0].id;
    if (rng.chance(0.45) || !projects.length) return has("recharge") ? "recharge" : A[0].id;
    return rng.pick(projects).id;
  }
  if (policy === "workaholic") {
    if (stats.energy < 12 && has("recharge")) return "recharge";
    if (submit) return submit.id;
    if (crunch) return crunch.id;
    if (by("milestone").length) return by("milestone")[0].id;
    if (boostOpp) return boostOpp.id;
    if (projects.length) return projects[Math.floor(rng.next() * Math.min(2, projects.length))].id;
    return "read";
  }
  // A reasonable player: research most weeks, reacting to the bars and to what comes up.
  if (stats.energy < 30 && has("recharge")) return "recharge";
  if (stats.sanity < 40) return sanityOpp ? sanityOpp.id : has("recharge") ? "recharge" : A[0].id;
  if (submit) return submit.id;
  if (by("milestone").length) return by("milestone")[0].id;
  if (boostOpp) return boostOpp.id;
  if (sanityOpp && stats.sanity < 65 && rng.chance(0.6)) return sanityOpp.id;
  if (crunch && stats.energy > 55 && rng.chance(0.5)) return crunch.id;
  if (rng.chance(0.1) && has("read")) return "read";
  if (rng.chance(0.08) && has("recharge")) return "recharge";
  if (projects.length) {
    const soon = projects.slice().sort((x, y) => (/deadline in (\d+)/.exec(x.desc) ? +/deadline in (\d+)/.exec(x.desc)[1] : 99) - (/deadline in (\d+)/.exec(y.desc) ? +/deadline in (\d+)/.exec(y.desc)[1] : 99));
    return (rng.chance(0.7) ? soon[0] : rng.pick(projects)).id;
  }
  return has("read") ? "read" : A[0].id;
}

function answerPrompt(game, p, policy, rng) {
  switch (p.type) {
    case "event": return { choice: policy === "random" ? rng.pick(p.choices).i : p.choices[rng.int(0, p.choices.length - 1)].i };
    case "matching":
      if (p.forced || rng.chance(0.5)) return { action: "join", idx: rng.int(0, p.candidates.length - 1) };
      if (!p.rotatedThisTurn && rng.chance(0.4)) return { action: "rotate", idx: rng.int(0, p.candidates.length - 1) };
      return { action: "later" };
    case "new_project": return { type: rng.pick(p.types).id, topic: rng.pick(p.topics).id };
    case "rebuttal": {
      const responses = {};
      let slots = p.slots;
      p.reviews.forEach((r) => r.concerns.forEach((c) => {
        const opt = rng.pick(["clarify", "concede", "pushback", "experiment", "skip"]);
        if (slots > 0 && opt !== "skip") { responses[c.key] = opt; slots--; }
      }));
      return { responses, flags: p.reviews.filter((r) => r.llm).map((r) => r.n - 1) };
    }
    case "qa": {
      const answers = {};
      p.questions.forEach((q) => { answers[q.key] = rng.pick(p.strategies).id; });
      return { answers };
    }
    case "sys": {
      if (p.sys === "leave") return { choice: p.choices.length - 1 };
      if (p.sys === "internship_apply") return { choice: policy === "slacker" ? 2 : 0 };
      if (p.sys === "first_project") return { choice: rng.int(0, 1) };
      if (p.sys === "decision" && p.choices.length === 3) return { choice: rng.chance(0.8) ? 0 : 1 };
      return { choice: 0 };
    }
    default: return {};
  }
}

const results = [];
const meta = { runs: 0, achievements: {}, seenRuns: {}, codex: {} };
let prevSeen = null;
const overlaps = [];
const errors = [];
const promptTypes = {};
const weekly = { weeks: 0, offered: 0, withOpp: 0, kinds: {} };
const t0 = Date.now();
for (let r = 0; r < RUNS; r++) {
  const policy = POLICY === "mixed" ? POLICIES[r % POLICIES.length] : POLICY;
  const seed = "sim-" + r;
  const rng = new Rng(seed + ":bot");
  const state = newRun(D, { seed, name: "Bot" });
  const game = new Game(D, meta, state);
  let prompts = 0, guard = 0, sanSum = 0, sanN = 0, planTurns = 0;
  try {
    while (guard++ < 20000) {
      const p = game.step();
      if (p.type === "ended") break;
      if (p.type === "error") throw new Error("engine error state");
      if (p.type === "turn_end") { sanSum += game.state.stats.sanity; sanN++; continue; }
      if (p.type === "plan") {
        const projectsN = p.actions.filter((a) => a.kind === "project" || a.kind === "deadline").length;
        if (p.canStartProject && projectsN < (policy === "slacker" ? 1 : 2) && rng.chance(0.5)) {
          const np = game.requestNewProject();
          if (np) { prompts++; game.answer({ type: rng.pick(np.types).id, topic: rng.pick(np.topics).id }); continue; }
        }
        planTurns++;
        const opps = p.actions.filter((a) => a.kind === "opportunity").length;
        const choice = pickAction(p, policy, rng, game.state.stats);
        weekly.weeks++; weekly.offered += opps; if (opps) weekly.withOpp++;
        const kind = (p.actions.find((a) => a.id === choice) || {}).kind || "?";
        if (policy === "balanced") weekly.kinds[kind] = (weekly.kinds[kind] || 0) + 1;
        game.submitPlan({ action: choice });
        continue;
      }
      prompts++;
      const pk = p.type === "event" ? "event:" + (D.eventById[p.id] && D.eventById[p.id].trigger === "scheduled" ? "scheduled" : "random/hook") : p.type;
      promptTypes[pk] = (promptTypes[pk] || 0) + 1;
      game.answer(answerPrompt(game, p, policy, rng));
    }
    if (guard >= 20000) throw new Error("did not finish");
  } catch (e) {
    errors.push("run " + r + " (" + policy + ", turn " + state.turn + "): " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e));
    continue;
  }
  const s = game.state;
  const bad = Object.keys(s.stats).filter((k) => !Number.isFinite(s.stats[k]));
  if (bad.length) errors.push("run " + r + ": non-finite stats " + bad.join(", "));
  if (!Number.isFinite(totalCitations(game))) errors.push("run " + r + ": non-finite citations");
  const seenRandom = Object.keys(s.seen).filter((id) => D.eventById[id] && D.eventById[id].trigger !== "scheduled");
  if (prevSeen) {
    const a = new Set(seenRandom), b = prevSeen;
    const inter = [...a].filter((x) => b.has(x)).length;
    overlaps.push(inter / Math.max(1, Math.min(a.size, b.size)));
  }
  prevSeen = new Set(seenRandom);
  const tiers = {};
  s.papers.forEach((p) => {
    if (!p.firstAuthor) return;
    const k = p.tier === "findings" ? "top" : p.tier;
    tiers[k] = tiers[k] || { sub: 0, acc: 0 };
    if (p.status === "accepted" || p.status === "rejected") { tiers[k].sub++; if (p.status === "accepted") tiers[k].acc++; }
  });
  results.push({
    policy, ending: s.ending.id, graduated: s.ending.graduated, years: s.turn / TURNS, pubs: firstAuthorPubs(game),
    cites: totalCitations(game), h: hIndex(game), burnouts: s.telemetry.burnouts, events: s.telemetry.events_seen,
    prompts, tiers, title: s.ending.title.id, advisor: s.advisor ? s.advisor.archetype : "none", quals: s.milestones.quals,
    proposal: s.milestones.proposal, uniqueRandom: seenRandom.length, sanity: sanN ? sanSum / sanN : 0, perTurn: prompts / Math.max(1, s.turn),
    qs: s.papers.filter((p) => p.firstAuthor && p.meta !== undefined).map((p) => ({ y: Math.floor(p.submittedTurn / TURNS) + 1, Q: p.Q, meta: p.meta, bonus: p.scoreBonus || 0, tier: p.tier, st: p.status, round: p.round }))
  });
}

const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0) + "%";
const median = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
const avg = (a) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : 0);
console.log("Runs: " + results.length + "/" + RUNS + " in " + ((Date.now() - t0) / 1000).toFixed(1) + "s, errors: " + errors.length);
for (const pol of POLICY === "mixed" ? POLICIES : [POLICY]) {
  const R = results.filter((x) => x.policy === pol);
  if (!R.length) continue;
  const grads = R.filter((x) => x.graduated);
  console.log("\n[" + pol + "] n=" + R.length + "  graduated " + pct(grads.length, R.length) +
    "  median years " + median(grads.map((x) => x.years)).toFixed(1) +
    "  pubs avg " + avg(R.map((x) => x.pubs)) + "  cites median " + median(R.map((x) => x.cites)) +
    "  h median " + median(R.map((x) => x.h)) + "  burnouts avg " + avg(R.map((x) => x.burnouts)) +
    "  sanity avg " + avg(R.map((x) => x.sanity)) + "  events avg " + avg(R.map((x) => x.events)) + "  prompts avg " + avg(R.map((x) => x.prompts)) + "  pop-ups per turn " + avg(R.map((x) => Math.round(x.perTurn * 100) / 100)));
}
const all = results;
const count = (key) => { const m = {}; all.forEach((x) => { m[x[key]] = (m[x[key]] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + v).join(", "); };
console.log("\nEndings: " + count("ending"));
console.log("Titles: " + count("title"));
console.log("Advisors: " + count("advisor"));
console.log("Quals: " + count("quals") + " | Proposal: " + count("proposal"));
const agg = {};
all.forEach((x) => Object.entries(x.tiers).forEach(([k, v]) => { agg[k] = agg[k] || { sub: 0, acc: 0 }; agg[k].sub += v.sub; agg[k].acc += v.acc; }));
console.log("Acceptance by tier (first-author, decided): " + Object.entries(agg).map(([k, v]) => k + " " + pct(v.acc, v.sub) + " of " + v.sub).join(", "));
console.log("Years (all runs): " + [1, 2, 3, 4, 5, 6, 7, 8, 9].map((y) => y + ":" + all.filter((x) => Math.ceil(x.years) === y).length).join(" "));
console.log("Prompts by type (per week): " + Object.entries(promptTypes).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + (v / Math.max(1, weekly.weeks)).toFixed(3)).join(", "));
console.log("Weekly options: " + (weekly.withOpp / Math.max(1, weekly.weeks) * 100).toFixed(0) + "% of weeks offer at least one, avg " + (weekly.offered / Math.max(1, weekly.weeks)).toFixed(2) + " per week");
console.log("Balanced bot's choices: " + Object.entries(weekly.kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + v).join(", "));
console.log("Random-event overlap between consecutive runs: median " + pct(median(overlaps) * 100, 100) + ", unique random events per run avg " + avg(all.map((x) => x.uniqueRandom)));
const pool = D.events.filter((e) => e.trigger !== "scheduled").length;
console.log("Random pool size: " + pool + ", seen at least once across all runs: " + Object.keys(meta.seenRuns).length);
errors.slice(0, 10).forEach((e) => console.log("ERROR " + e));
if (process.env.QSTATS) {
  const qs = [].concat(...all.map((x) => x.qs));
  for (let y = 1; y <= 6; y++) {
    const q = qs.filter((p) => p.y === y);
    if (!q.length) continue;
    console.log("Y" + y + " n=" + q.length + " Q median " + median(q.map((p) => p.Q)).toFixed(0) + " meta median " + median(q.map((p) => p.meta)).toFixed(0) +
      " scoreBonus avg " + avg(q.map((p) => p.bonus)) + " accepted " + pct(q.filter((p) => p.st === "accepted").length, q.length));
  }
}
