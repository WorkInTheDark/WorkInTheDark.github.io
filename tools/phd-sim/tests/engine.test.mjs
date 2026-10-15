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

function bot(game, seed) {
  const rng = new Rng(seed + ":bot");
  let steps = 0;
  for (;;) {
    if (steps++ > 30000) throw new Error("run did not end");
    const p = game.step();
    if (p.type === "ended") return game.state;
    if (p.type === "turn_end") {
      const ap = activeProjects(game);
      const days = { read: 1, social: 1, exercise: 1 };
      ap.slice(0, 2).forEach((x) => { days["p:" + x.id] = 3; });
      game.setRoutine({ days, overtime: 0, overtimeTarget: "read" });
      if (ap.length < 2 && game.state.advisor) game.requestNewProject();
      continue;
    }
    let a = { choice: 0 };
    if (p.type === "event" || p.type === "sys") a = { choice: (p.choices[rng.int(0, p.choices.length - 1)] || {}).i || 0 };
    if (p.type === "sys" && p.sys === "leave") a = { choice: p.choices.length - 1 };
    if (p.type === "matching") a = { action: "join", idx: rng.int(0, p.candidates.length - 1) };
    if (p.type === "new_project") a = { type: rng.pick(p.types).id, topic: rng.pick(p.topics).id };
    if (p.type === "rebuttal") a = { responses: {}, flags: [] };
    if (p.type === "qa") a = { answers: Object.fromEntries(p.questions.map((q) => [q.key, "direct"])) };
    game.answer(a);
  }
}

function start(seed) {
  const tr = rollTraits(D, seed);
  return newRun(D, { seed, name: "Test", background: "undergrad", origin: "domestic", traits: [tr.offers[0]].concat(tr.random) });
}

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
  // Play both to turn 40, then reload g2 from JSON and finish both.
  const rngA = new Rng("x"), rngB = new Rng("x");
  for (const [g, rng] of [[g1, rngA], [g2, rngB]]) {
    let guard = 0;
    while (g.state.turn < 40 && guard++ < 5000) {
      const p = g.step();
      if (p.type === "turn_end") continue;
      if (p.type === "ended") break;
      g.answer(p.type === "matching" ? { action: "join", idx: 0 } : p.type === "new_project" ? { type: "empirical", topic: p.topics[0].id } : p.type === "qa" ? { answers: {} } : p.type === "rebuttal" ? { responses: {} } : { choice: p.choices ? p.choices[0].i : 0 });
      void rng;
    }
  }
  const reloaded = new Game(D, meta2, JSON.parse(JSON.stringify(g2.state)));
  const a = bot(g1, "save-1"), b = bot(reloaded, "save-1");
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
