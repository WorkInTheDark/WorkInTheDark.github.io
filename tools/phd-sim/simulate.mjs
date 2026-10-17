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
// "pusher" and "swinger" keep one project at a time, to measure how long a project takes.
const POLICIES = ["balanced", "workaholic", "slacker", "random", "pusher", "swinger"];

// Picks one action for the week, the way each kind of player might.
function pickAction(p, policy, rng, stats) {
  const A = p.actions;
  // Bots prepare for quals on about half of the turns it's offered.
  const skipQuals = rng.chance(0.5);
  const by = (kind) => A.filter((a) => a.kind === kind && !(skipQuals && a.id === "quals_prep"));
  const has = (id) => A.some((a) => a.id === id);
  const sanityOpp = by("opportunity").find((a) => (a.arrows || []).some((x) => x.stat === "sanity" && x.dir === "up"));
  const boostOpp = by("opportunity").find((a) => (a.arrows || []).some((x) => x.stat === "progress"));
  const crunch = A.find((a) => a.id.indexOf("crunch:") === 0);
  const projects = by("project");
  const litRead = A.find((a) => a.id === "read" && (a.arrows || []).some((x) => x.stat === "progress" && x.strength > 1));
  const care = () => (has("recharge") ? "recharge" : A[0].id);
  if (policy === "random") return rng.pick(A).id;
  if (policy === "slacker") {
    if (by("opportunity").length && rng.chance(0.8)) return rng.pick(by("opportunity")).id;
    if (by("milestone").length && rng.chance(0.25)) return by("milestone")[0].id;
    if (rng.chance(0.45) || !projects.length) return has("recharge") ? "recharge" : A[0].id;
    return rng.pick(projects).id;
  }
  if (policy === "workaholic") {
    if (stats.energy < 12 || stats.health < 20) return care();
    if (crunch) return crunch.id;
    if (by("milestone").length) return by("milestone")[0].id;
    if (boostOpp) return boostOpp.id;
    if (projects.length) return projects[Math.floor(rng.next() * Math.min(2, projects.length))].id;
    return "read";
  }
  if (policy === "pusher" || policy === "swinger") {
    if (stats.energy < (policy === "pusher" ? 25 : 40) || stats.sanity < 30) return has("recharge") ? "recharge" : A[0].id;
    if (stats.health < 40) return care();
    if (by("milestone").length) return by("milestone")[0].id;
    if (policy === "swinger" && rng.chance(0.45)) return rng.pick(A.filter((a) => a.kind === "core" || a.kind === "opportunity")).id;
    if (litRead) return litRead.id;
    if (boostOpp) return boostOpp.id;
    return projects.length ? projects[0].id : has("read") ? "read" : A[0].id;
  }
  // A reasonable player: research most weeks, reacting to the bars and to what comes up.
  if (stats.energy < 35) return has("recharge") ? "recharge" : A[0].id;
  if (stats.health < 40 && has("recharge")) return "recharge";
  if (stats.sanity < 40) return sanityOpp ? sanityOpp.id : has("recharge") ? "recharge" : A[0].id;
  if (by("milestone").length) return by("milestone")[0].id;
  if (boostOpp) return boostOpp.id;
  if (sanityOpp && stats.sanity < 65 && rng.chance(0.6)) return sanityOpp.id;
  if (crunch && stats.energy > 55 && rng.chance(0.5)) return crunch.id;
  if (litRead && rng.chance(0.8)) return litRead.id;
  if (rng.chance(0.06) && has("read")) return "read";
  if (projects.length) {
    const dl = (x) => { const m = /deadline in (\d+)/.exec(x.desc); return m ? +m[1] : 99; };
    const soon = projects.slice().sort((x, y) => dl(x) - dl(y));
    return (rng.chance(0.7) ? soon[0] : rng.pick(projects)).id;
  }
  return has("read") ? "read" : A[0].id;
}

function answerPrompt(game, p, policy, rng) {
  switch (p.type) {
    case "event": return { choice: policy === "random" ? rng.pick(p.choices).i : p.choices[rng.int(0, p.choices.length - 1)].i };
    case "rebuttal": {
      const responses = {};
      p.reviews.forEach((r, i) => { const o = rng.pick(p.options.filter((x) => !x.llmOnly || r.llm)); if (rng.chance(0.5)) responses[i] = o.id; });
      return { responses };
    }
    case "sys": {
      if (p.sys === "leave") return { choice: p.choices.length - 1 };
      // A paper due this turn: submit it, unless a slacker can't be bothered.
      if (p.sys === "submit") return { choice: policy === "slacker" && rng.chance(0.3) ? 2 : policy === "random" ? rng.int(0, 2) : 0 };
      if (p.sys === "internship_apply") return { choice: policy === "slacker" ? 2 : 0 };
      if (p.sys === "first_project") return { choice: rng.int(0, 1) };
      if (p.sys === "decision" && p.choices.length === 3) return { choice: rng.chance(0.93) ? 0 : 1 };
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
const perTurn = { turns: 0, offered: 0, withOpp: 0, kinds: {} };
const t0 = Date.now();
for (let r = 0; r < RUNS; r++) {
  const policy = POLICY === "mixed" ? POLICIES[r % POLICIES.length] : POLICY;
  const seed = "sim-" + r;
  const rng = new Rng(seed + ":bot");
  const state = newRun(D, { seed, name: "Bot" });
  const game = new Game(D, meta, state);
  let prompts = 0, guard = 0, sanSum = 0, sanN = 0, planTurns = 0, enSum = 0, hpSum = 0;
  const doneAt = {};
  try {
    while (guard++ < 20000) {
      const p = game.step();
      if (p.type === "ended") break;
      if (p.type === "error") throw new Error("engine error state");
      if (p.type === "turn_end") {
        sanSum += game.state.stats.sanity; enSum += game.state.stats.energy; hpSum += game.state.stats.health; sanN++;
        // How long a project takes, from its start until the draft is done (or it's submitted).
        game.state.projects.forEach((pr) => {
          if (doneAt[pr.id] !== undefined || pr.source !== "player") return;
          if (pr.status === "submitted" || pr.status === "done" || (pr.status === "active" && !pr.revise && pr.ready)) doneAt[pr.id] = game.state.turn - pr.created;
        });
        continue;
      }
      if (p.type === "plan") {
        const projectsN = activeProjects(game).filter((x) => !x.revise && !x.ready).length;
        const cap = policy === "slacker" || policy === "pusher" || policy === "swinger" ? 1 : 2;
        if (p.canStartProject && projectsN < cap && rng.chance(0.5)) {
          if (game.startNewProject()) continue;
        }
        planTurns++;
        const opps = p.actions.filter((a) => a.kind === "opportunity").length;
        const choice = pickAction(p, policy, rng, game.state.stats);
        perTurn.turns++; perTurn.offered += opps; if (opps) perTurn.withOpp++;
        const kind = (p.actions.find((a) => a.id === choice) || {}).kind || "?";
        if (policy === "balanced") perTurn.kinds[kind] = (perTurn.kinds[kind] || 0) + 1;
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
    // When the milestones that pace graduation happened (in years), for the timeline line below.
    timeline: {
      paper1: null, paper2: null, paper3: null,
      proposal: s.milestones.proposalAt ? s.milestones.proposalAt / TURNS : null,
      defensePrep: s.milestones.defensePrepStart ? s.milestones.defensePrepStart / TURNS : null,
      ...Object.fromEntries(s.papers.filter((p) => p.firstAuthor && p.pubTurn !== null && p.pubTurn !== undefined).map((p) => p.pubTurn).sort((a, b) => a - b).slice(0, 3).map((t, i) => ["paper" + (i + 1), t / TURNS]))
    },
    submissions: s.telemetry.submissions,
    cites: totalCitations(game), h: hIndex(game), burnouts: s.telemetry.burnouts, events: s.telemetry.events_seen,
    prompts, tiers, title: s.ending.title.id, advisor: s.advisor ? s.advisor.archetype : "none", quals: s.milestones.quals,
    proposal: s.milestones.proposal, uniqueRandom: seenRandom.length, sanity: sanN ? sanSum / sanN : 0, perTurn: prompts / Math.max(1, s.turn),
    energy: sanN ? enSum / sanN : 0, health: hpSum / Math.max(1, sanN), projWeeks: Object.values(doneAt),
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
    "  energy avg " + avg(R.map((x) => x.energy)) + "  stress avg " + avg(R.map((x) => 100 - x.sanity)) + "  health avg " + avg(R.map((x) => x.health)) +
    "  pop-ups per turn " + avg(R.map((x) => Math.round(x.perTurn * 100) / 100)) +
    "  weeks per project (median) " + median([].concat(...R.map((x) => x.projWeeks))) * 2);
}
const all = results;
const count = (key) => { const m = {}; all.forEach((x) => { m[x[key]] = (m[x[key]] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + v).join(", "); };
console.log("\nEndings: " + count("ending"));
console.log("Titles: " + count("title"));
console.log("Advisors: " + count("advisor"));
console.log("Quals: " + count("quals") + " | Proposal: " + count("proposal"));
{
  const B = results.filter((x) => x.policy === (POLICY === "mixed" ? "balanced" : POLICY) && x.graduated);
  const med = (k) => { const v = B.map((x) => x.timeline[k]).filter((x) => x !== null); return v.length ? median(v).toFixed(1) : "-"; };
  console.log("Timeline (" + (POLICY === "mixed" ? "balanced" : POLICY) + ", graduates, median year): 1st paper " + med("paper1") + ", 2nd " + med("paper2") + ", 3rd " + med("paper3") +
    ", proposal " + med("proposal") + ", defense prep " + med("defensePrep") + ", graduation " + (B.length ? median(B.map((x) => x.years)).toFixed(1) : "-") +
    " | first-author submissions per run " + avg(B.map((x) => x.submissions)));
}
const agg = {};
all.forEach((x) => Object.entries(x.tiers).forEach(([k, v]) => { agg[k] = agg[k] || { sub: 0, acc: 0 }; agg[k].sub += v.sub; agg[k].acc += v.acc; }));
console.log("Acceptance by tier (first-author, decided): " + Object.entries(agg).map(([k, v]) => k + " " + pct(v.acc, v.sub) + " of " + v.sub).join(", "));
console.log("Years (all runs): " + [1, 2, 3, 4, 5, 6, 7, 8, 9].map((y) => y + ":" + all.filter((x) => Math.ceil(x.years) === y).length).join(" "));
console.log("Prompts by type (per turn): " + Object.entries(promptTypes).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + (v / Math.max(1, perTurn.turns)).toFixed(3)).join(", "));
console.log("Only-this-turn options: " + (perTurn.withOpp / Math.max(1, perTurn.turns) * 100).toFixed(0) + "% of turns offer at least one, avg " + (perTurn.offered / Math.max(1, perTurn.turns)).toFixed(2) + " per turn");
console.log("Balanced bot's choices: " + Object.entries(perTurn.kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + v).join(", "));
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
