// Engine unit tests: node --experimental-default-type=module --test tools/phd-sim/tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseValue, compare } from "../../../assets/js/phd-sim/engine/util.js";
import { Rng } from "../../../assets/js/phd-sim/engine/rng.js";
import { prepareData, newRun, rollTraits, Game } from "../../../assets/js/phd-sim/engine/index.js";
import { activeProjects, rollStages, currentStage, stageChance, fieldOf, autoTarget, venuesFor, PROJECT_TYPES, workDay, components, qualityFor } from "../../../assets/js/phd-sim/engine/projects.js";
import { resolveRebuttal, replyOutlook } from "../../../assets/js/phd-sim/engine/reviews.js";

const here = dirname(fileURLToPath(import.meta.url));
const D = prepareData(JSON.parse(readFileSync(join(here, "..", "out", "data.json"), "utf8")));

test("parseValue reads ranges and fixed values", () => {
  assert.deepEqual(parseValue("+7±3"), { center: 7, spread: 3 });
  assert.deepEqual(parseValue("-5±2"), { center: -5, spread: 2 });
  assert.deepEqual(parseValue("+3"), { center: 3, spread: 0 });
  assert.deepEqual(parseValue(4), { center: 4, spread: 0 });
  assert.equal(parseValue("nonsense"), null);
});

test("compare handles operators and equality", () => {
  assert.ok(compare(3, "<=3"));
  assert.ok(compare(10, ">5"));
  assert.ok(!compare(10, "<5"));
  assert.ok(compare("passed", "passed"));
  assert.ok(compare(2, [1, 2, 3]));
});

test("rng is deterministic and triangular rolls stay in range", () => {
  const a = new Rng("seed"), b = new Rng("seed");
  for (let i = 0; i < 50; i++) assert.equal(a.next(), b.next());
  const r = new Rng("tri");
  for (let i = 0; i < 2000; i++) { const v = r.triangular(7, 3); assert.ok(v >= 4 && v <= 10); }
  const c = Rng.fromState(a.state());
  assert.equal(c.next(), a.next());
});

function planFor(p, rng) {
  const A = p.actions;
  const projects = A.filter((a) => a.kind === "project");
  if (rng.chance(0.25)) return { action: rng.pick(A).id };
  return { action: projects.length ? projects[0].id : A[0].id };
}

function answerFor(p, rng) {
  if (p.type === "rebuttal") return { responses: {} };
  if (p.type === "sys" && p.sys === "leave") return { choice: p.choices.length - 1 };
  if (p.type === "sys" && p.sys === "submit") return { choice: 0 };
  return { choice: (p.choices[rng.int(0, p.choices.length - 1)] || {}).i || 0 };
}

function bot(game, seed, untilTurn) {
  const rng = new Rng(seed + ":bot");
  let steps = 0;
  for (;;) {
    if (steps++ > 30000) throw new Error("run did not end");
    if (untilTurn !== undefined && game.state.turn >= untilTurn && game.state.stage === "plan") return game.state;
    const p = game.step();
    if (p.type === "ended") return game.state;
    if (p.type === "turn_end") continue;
    if (p.type === "plan") {
      if (p.canStartProject && game.state.projects.filter((x) => x.status === "active").length < 2 && game.startNewProject()) continue;
      game.submitPlan(planFor(p, rng));
      continue;
    }
    game.answer(answerFor(p, rng));
  }
}

function start(seed) {
  return newRun(D, { seed, name: "Test" });
}

test("traits are rolled at random, without contradictory pairs", () => {
  for (let i = 0; i < 200; i++) {
    const t = rollTraits(D, "t" + i);
    assert.equal(t.length, 3);
    assert.equal(new Set(t).size, 3);
    assert.ok(!(t.includes("code_wizard") && t.includes("wordsmith")));
    assert.ok(!(t.includes("early_bird") && t.includes("night_owl")));
  }
});

test("each turn takes exactly one focus, and unknown actions fall back safely", () => {
  const g = new Game(D, {}, start("plan-1"));
  let p = g.step();
  const rng = new Rng("a");
  while (p.type !== "plan") { g.answer(answerFor(p, rng)); p = g.step(); }
  const week = g.state.turn;
  assert.ok(g.submitPlan({ action: "not-a-real-action" }));
  assert.equal(g.state.plan.action, "recharge");
  let q = g.step();
  while (q.type !== "plan" && q.type !== "ended") { if (q.type !== "turn_end") g.answer(answerFor(q, rng)); q = g.step(); }
  assert.equal(g.state.turn, week + 1);
});

// Plays until the first week with an advisor and an active project.
function gameWithProject(seed) {
  const g = new Game(D, {}, start(seed));
  const rng = new Rng(seed);
  for (let i = 0; i < 3000; i++) {
    const p = g.step();
    if (p.type === "plan" && g.state.advisor) {
      if (!activeProjects(g).length) g.startNewProject();
      return g;
    }
    if (p.type === "plan") { g.submitPlan(planFor(p, rng)); continue; }
    if (p.type !== "turn_end") g.answer(answerFor(p, rng));
  }
  throw new Error("no advisor");
}

test("every project kind ends in Consolidation, with no Writing stage", () => {
  Object.keys(PROJECT_TYPES).forEach((k) => {
    const st = PROJECT_TYPES[k].stages;
    assert.equal(st[st.length - 1].id, "consolidation", k);
    assert.ok(!st.some((x) => x.id === "writing"), k);
    st.filter((x) => x.kind === "work").forEach((x) => assert.ok(x.chance > 0 && x.chance < 1, k + "/" + x.id));
  });
});

test("each turn of work is one try at the stage's set chance", () => {
  const g = gameWithProject("stage-1");
  const p = activeProjects(g)[0];
  const full = D.config.progress.full_turn;
  const tries = (stageIdx, n) => {
    let moved = 0;
    for (let i = 0; i < n; i++) {
      p.type = "empirical"; p.stageIdx = stageIdx; p.revise = false; p.pause = 0; p.ready = false; p.nudge = 0;
      p.turnEffort = full; rollStages(g);
      if (p.stageIdx > stageIdx || p.ready) moved++;
    }
    return moved / n;
  };
  const idea = tries(0, 2000), pilot = tries(2, 2000), exp = tries(3, 2000);
  assert.ok(Math.abs(idea - 0.8) < 0.04, "Idea moves on about 80% of turns: " + idea);
  assert.ok(Math.abs(pilot - 0.6) < 0.04, "Pilot about 60%: " + pilot);
  assert.ok(Math.abs(exp - 0.5) < 0.04, "Experiments about 50%: " + exp);
  p.stageIdx = 1; p.turnEffort = 0; rollStages(g);
  assert.equal(p.stageIdx, 1, "no work this turn: no try");
  p.type = "study"; p.stageIdx = 2; p.turnEffort = full * 2; p.nudge = 0.5; rollStages(g);
  if (currentStage(g, p).id === "irb") assert.ok(p.wait >= 1 && p.wait <= 2, "IRB waits one or two turns (2-4 weeks)");
  p.type = "empirical"; p.stageIdx = 4; p.ready = false; p.nudge = 0.3; p.turnEffort = full * 1.3;
  for (let i = 0; i < 20 && !p.ready; i++) { p.turnEffort = full; rollStages(g); }
  assert.ok(p.ready, "finishing Consolidation makes the paper ready");
});

test("a turn of reading counts more toward Related work than toward other stages", () => {
  const lit = gameWithProject("read-1");
  const a = activeProjects(lit)[0];
  a.type = "empirical"; a.stageIdx = 1; a.revise = false; a.pause = 0; a.ready = false; a.turnEffort = 0;
  lit.submitPlan({ action: "read" });
  lit.resolveTurn();
  const other = gameWithProject("read-1");
  const b = activeProjects(other)[0];
  b.type = "empirical"; b.stageIdx = 3; b.revise = false; b.pause = 0; b.ready = false; b.turnEffort = 0;
  other.submitPlan({ action: "read" });
  other.resolveTurn();
  assert.ok(b.turnEffort < 1, "other stages get a small chance: " + b.turnEffort);
  assert.ok(a.turnEffort > b.turnEffort * 5, "related work gets a real try: " + a.turnEffort + " vs " + b.turnEffort);
});

test("two papers due in the same turn can both be submitted", () => {
  const g = gameWithProject("two-1");
  const rng = new Rng("two-1");
  while (activeProjects(g).length < 2) g.startNewProject();
  const due = g.state.turn + 1;
  const ps = activeProjects(g).slice(0, 2);
  ps.forEach((p) => {
    p.type = "empirical"; p.field = "nlp"; p.stageIdx = PROJECT_TYPES.empirical.stages.length - 1;
    p.ready = true; p.revise = false; p.pause = 0;
    p.target = { venueId: "arr", cycle: 0, turn: due };
  });
  g.submitPlan({ action: "read" });
  let cards = 0;
  for (let i = 0; i < 400; i++) {
    const p = g.step();
    if (p.type === "ended") break;
    if (p.type === "turn_end") continue;
    if (p.type === "plan") { if (g.state.turn > due) break; g.submitPlan({ action: "read" }); continue; }
    if (p.type === "sys" && p.sys === "submit") cards++;
    g.answer(answerFor(p, rng));
  }
  assert.equal(cards, 2, "one deadline card per paper");
  ps.forEach((p) => assert.ok(g.state.papers.some((pp) => pp.projectId === p.id), "submitted: " + p.short));
});

test("NLP papers go to NLP or ML venues, HCI papers only to HCI venues", () => {
  const g = gameWithProject("field-1");
  const p = activeProjects(g)[0];
  ["empirical", "dataset", "study", "system", "position"].forEach((type) => {
    for (let i = 0; i < 6; i++) {
      p.type = type; p.field = type === "position" ? (i % 2 ? "nlp" : "hci") : undefined; p.target = null;
      autoTarget(g, p);
      assert.ok(p.target, type + " gets a target");
      const vf = D.venueById[p.target.venueId].field;
      assert.ok(fieldOf(p) === "nlp" ? vf === "nlp" || vf === "ml" : vf === "hci", type + " -> " + p.target.venueId);
    }
  });
  p.type = "study"; p.field = undefined;
  assert.ok(venuesFor(g, p, { includeJournals: true }).every((v) => v.field === "hci"), "no ML venues for HCI studies");
  p.type = "empirical";
  assert.ok(venuesFor(g, p, {}).some((v) => v.id === "neurips") && venuesFor(g, p, {}).some((v) => v.id === "iclr"), "NeurIPS and ICLR take NLP papers");
});

test("new projects pick their own kind and topic, without a prompt", () => {
  const g = gameWithProject("new-1");
  const before = activeProjects(g).length;
  const p = g.startNewProject();
  assert.ok(p && PROJECT_TYPES[p.type]);
  assert.equal(activeProjects(g).length, before + 1);
  assert.equal(g.state.prompt, null);
});

test("starting a project adds real Stress, more when you're already juggling", () => {
  const g = gameWithProject("stress-1");
  activeProjects(g).forEach((p) => { p.status = "shelved"; });
  g.state.player.traits = [];
  const costs = [];
  for (let i = 0; i < 3; i++) {
    g.state.stats.sanity = 90;
    g.startNewProject();
    costs.push(Math.round(90 - g.state.stats.sanity));
  }
  assert.deepEqual(costs, [6, 9, 12]);
});

test("the rebuttal takes one response per reviewer and defaults to clarifying", () => {
  const g = gameWithProject("reb-1");
  const paper = {
    promises: 0, reviews: [0, 1, 2].map((i) => ({ raw: 50, score: 3, openness: 1, silent: false, llm: i === 2,
      concerns: [{ key: "c" + i, valid: false, severity: "minor", comp: "C" }] }))
  };
  const res = resolveRebuttal(g, paper, { responses: { 1: "concede", 2: "flag" } });
  assert.equal(res.reviews.length, 3);
  assert.equal(paper.promises, 1, "only reviewer 2 got a concession");
  assert.ok(paper.reviews[2].flagged !== undefined, "the LLM-looking review can be flagged");
  const res2 = resolveRebuttal(g, { promises: 0, reviews: [{ raw: 50, score: 3, openness: 1, llm: false, concerns: [{ key: "x", valid: false, severity: "minor", comp: "C" }] }] }, { responses: { 0: "flag" } });
  assert.ok(!/area chair/.test(res2.reviews[0].lines.join(" ")), "flagging a normal review falls back to clarifying");
});

test("a ready paper can be refined, and each pass helps less than the one before", () => {
  const g = gameWithProject("refine-1");
  const p = activeProjects(g)[0];
  p.type = "empirical"; p.field = "nlp"; p.stageIdx = PROJECT_TYPES.empirical.stages.length - 1;
  p.ready = true; p.revise = false; p.pause = 0;
  const tile = g.actionList().find((a) => a.id === "refine:" + p.id);
  assert.ok(tile, "a finished paper offers a Refine tile");
  assert.ok(!g.actionList().some((a) => a.id === "p:" + p.id), "and no plain Work tile");
  const Q = () => qualityFor(g, components(g, p), "arr");
  const q = [Q()];
  for (let t = 0; t < 3; t++) { for (let d = 0; d < 7; d++) workDay(g, p, 0.9, null); rollStages(g, null); q.push(Q()); }
  assert.ok(q[1] > q[0] + 1, "the first pass makes a real difference");
  assert.ok(q[2] - q[1] < q[1] - q[0] && q[3] - q[2] < q[2] - q[1], "later passes help less");
  assert.equal(p.refineTurns, 3);
  assert.ok(p.ready, "refining never un-finishes the paper");
});

test("the rebuttal preview shows where each reply could take a score, without touching the game's dice", () => {
  const g = gameWithProject("outlook-1");
  const paper = { id: "x9", reviews: [
    { raw: 54, score: 2, openness: 1, silent: false, llm: true, concerns: [{ key: "a", validP: 0.3, severity: "minor", comp: "C" }, { key: "b", validP: 0.3, severity: "major", comp: "S" }] },
    { raw: 54, score: 2, openness: 0, silent: true, llm: false, concerns: [{ key: "c", validP: 0.5, severity: "minor", comp: "N" }] }
  ] };
  const before = g.rng.state();
  const o = replyOutlook(g, paper);
  assert.deepEqual(g.rng.state(), before, "the preview has its own dice");
  assert.ok(o[0].clarify.up >= 3, "clarifying a likely misread could raise the score");
  assert.ok(o[0].passive.down < 2, "a passive-aggressive reply could lower it");
  assert.ok(o[0].flag && o[0].flag.half, "an LLM-looking review can be flagged");
  assert.ok(!o[1].flag, "a normal review can't");
  assert.equal(o[1].clarify.up, 2, "a reviewer who won't read the response doesn't move");
  assert.deepEqual(replyOutlook(g, paper), o, "the same paper gives the same preview");
});

test("the same seed and the same answers give the same PhD", () => {
  const a = bot(new Game(D, {}, start("det-1")), "det-1");
  const b = bot(new Game(D, {}, start("det-1")), "det-1");
  assert.equal(a.turn, b.turn);
  assert.equal(a.ending.id, b.ending.id);
  assert.deepEqual(a.stats, b.stats);
});

test("a run survives a save and reload in the middle", () => {
  const meta1 = {}, meta2 = {};
  const g1 = new Game(D, meta1, start("save-1"));
  const g2 = new Game(D, meta2, start("save-1"));
  // Play both to turn 40 with the same bot, reload g2 from JSON, then finish both the same way.
  bot(g1, "save-1", 40);
  bot(g2, "save-1", 40);
  const reloaded = new Game(D, meta2, JSON.parse(JSON.stringify(g2.state)));
  const a = bot(g1, "save-1b"), b = bot(reloaded, "save-1b");
  assert.equal(a.turn, b.turn);
  assert.equal(a.ending.id, b.ending.id);
});

test("many runs end cleanly with finite stats", () => {
  for (let i = 0; i < 25; i++) {
    const s = bot(new Game(D, {}, start("many-" + i)), "many-" + i);
    assert.equal(s.phase, "ended");
    assert.ok(s.ending && s.ending.id);
    for (const [k, v] of Object.entries(s.stats)) assert.ok(Number.isFinite(v), k + " is not finite");
    assert.doesNotThrow(() => JSON.stringify(s));
  }
});
