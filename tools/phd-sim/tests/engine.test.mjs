// Engine unit tests: node --experimental-default-type=module --test tools/phd-sim/tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseValue, compare } from "../../../assets/js/phd-sim/engine/util.js";
import { Rng } from "../../../assets/js/phd-sim/engine/rng.js";
import { prepareData, newRun, rollTraits, Game } from "../../../assets/js/phd-sim/engine/index.js";
import { activeProjects } from "../../../assets/js/phd-sim/engine/projects.js";

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
  const submit = A.find((a) => a.id.indexOf("submit:") === 0);
  const projects = A.filter((a) => a.kind === "project");
  if (submit) return { action: submit.id };
  if (rng.chance(0.25)) return { action: rng.pick(A).id };
  return { action: projects.length ? projects[0].id : A[0].id };
}

function answerFor(p, rng) {
  if (p.type === "matching") return { action: "join", idx: rng.int(0, p.candidates.length - 1) };
  if (p.type === "new_project") return { type: rng.pick(p.types).id, topic: rng.pick(p.topics).id };
  if (p.type === "rebuttal") return { responses: {}, flags: [] };
  if (p.type === "qa") return { answers: Object.fromEntries(p.questions.map((q) => [q.key, "direct"])) };
  if (p.type === "sys" && p.sys === "leave") return { choice: p.choices.length - 1 };
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
      if (p.canStartProject && p.actions.filter((a) => a.kind === "project" || a.kind === "deadline").length < 2) {
        const np = game.requestNewProject();
        if (np) { game.answer(answerFor(np, rng)); continue; }
      }
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

test("each week takes exactly one action, and unknown actions fall back safely", () => {
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
