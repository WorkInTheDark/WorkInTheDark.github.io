// The leaderboard replays a run from its record (engine/replay.js), so a run must be fully decided by
// its seed, setup, history snapshot and choices.
//   node --experimental-default-type=module --test tools/phd-sim/tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { prepareData, newRun, Game, venuesFor } from "../../../assets/js/phd-sim/engine/index.js";
import { Rng } from "../../../assets/js/phd-sim/engine/rng.js";
import { runRecord, replayRun, resultOf, canSubmit } from "../../../assets/js/phd-sim/engine/replay.js";

const here = dirname(fileURLToPath(import.meta.url));
const RAW = readFileSync(join(here, "..", "out", "data.json"), "utf8");
const fresh = () => prepareData(JSON.parse(RAW));

// A bot that uses every kind of choice: new projects, retargeting, shelving, asking to leave, rebuttals.
// It also saves and reloads now and then, as a player closing the tab would.
function play(D, seed, meta, opts) {
  opts = opts || {};
  let g = new Game(D, meta, newRun(D, { seed, daily: !!opts.daily, name: "Bot" }));
  const bot = new Rng(seed + ":bot");
  for (let guard = 0; guard < 20000; guard++) {
    if (bot.chance(0.02)) g = new Game(D, meta, JSON.parse(JSON.stringify(g.state)));
    const p = g.step();
    if (p.type === "ended") break;
    if (p.type === "turn_end") { if (bot.chance(0.01)) g.requestLeave(); continue; }
    if (p.type === "plan") {
      const s = g.state;
      if (p.canStartProject && bot.chance(0.12)) g.startNewProject();
      const act = s.projects.filter((x) => x.status === "active");
      if (act.length && bot.chance(0.08)) {
        const pr = bot.pick(act);
        const vs = venuesFor(g, pr);
        if (vs.length) g.setTarget(pr.id, bot.pick(vs).id);
      }
      if (act.length > 2 && bot.chance(0.02)) g.shelveProject(bot.pick(act).id);
      if (bot.chance(0.01)) { g.requestLeave(); continue; }
      const A = p.actions;
      const pick = s.stats.energy < 25 ? (A.find((a) => a.id === "recharge") || A[0]) : bot.pick(A);
      g.submitPlan({ action: pick.id, side: p.side && p.side.length && bot.chance(0.5) ? bot.pick(p.side).id : null });
      continue;
    }
    if (p.type === "event") g.answer({ choice: bot.pick(p.choices).i });
    else if (p.type === "rebuttal") { const r = {}; p.reviews.forEach((x, i) => { if (bot.chance(0.7)) r[i] = bot.pick(p.options.filter((o) => !o.llmOnly)).id; }); g.answer({ responses: r }); }
    else if (p.type === "sys" && p.sys === "leave") g.answer({ choice: bot.chance(opts.leave || 0.15) ? 0 : p.choices.length - 1 });
    else g.answer({ choice: p.choices && p.choices.length ? bot.int(0, p.choices.length - 1) : 0 });
  }
  return g;
}

test("a finished run replays to the same state from its record", () => {
  for (let r = 0; r < 8; r++) {
    const meta = { runs: 3, achievements: {}, seenRuns: {}, codex: {} };
    // A player with history: earlier runs saw some events.
    fresh().events.slice(0, 40).forEach((ev, i) => { meta.seenRuns[ev.id] = i % 3; });
    const g = play(fresh(), "replay-" + r, meta);
    assert.ok(canSubmit(g.state), "run " + r + " finished with a record");
    const back = replayRun(fresh(), JSON.parse(JSON.stringify(runRecord(g.state))));
    assert.equal(JSON.stringify(back.state), JSON.stringify(g.state), "run " + r + " replays exactly");
    assert.deepEqual(resultOf(back.state.ending), resultOf(g.state.ending));
  }
});

test("the daily run is the same game for every player, whatever their history", () => {
  const a = play(fresh(), "daily-2026-10-23", { runs: 0, achievements: {}, seenRuns: {}, codex: {} }, { daily: true });
  const seen = {};
  fresh().events.forEach((ev, i) => { if (i % 2) seen[ev.id] = 4; });
  const b = play(fresh(), "daily-2026-10-23", { runs: 9, achievements: {}, seenRuns: seen, codex: {} }, { daily: true });
  const strip = (s) => JSON.stringify(Object.assign({}, s, { runIndex: 0 }));
  assert.equal(strip(a.state), strip(b.state));
});

test("an edited record doesn't replay to a better result", () => {
  const g = play(fresh(), "replay-edit", { runs: 0, achievements: {}, seenRuns: {}, codex: {} }, { leave: 0 });
  const rec = JSON.parse(JSON.stringify(runRecord(g.state)));
  // Change one choice in the middle of the run.
  const i = rec.inputs.findIndex((x, j) => j > rec.inputs.length / 2 && x.k === "p");
  rec.inputs[i].v.action = rec.inputs[i].v.action === "recharge" ? "read" : "recharge";
  let out = null;
  try { out = resultOf(replayRun(fresh(), rec).state.ending); } catch (e) { out = e.code; }
  assert.notDeepEqual(out, resultOf(g.state.ending));
  assert.throws(() => replayRun(fresh(), Object.assign({}, rec, { inputs: [] })), /bad_inputs/);
  assert.throws(() => replayRun(fresh(), Object.assign({}, rec, { seed: "daily-tomorrow", daily: true })), /bad_seed/);
});
