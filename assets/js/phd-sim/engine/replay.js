// Playing a finished run again from its record, for the leaderboard. A run is decided by its seed,
// the setup, which events earlier runs showed (pastSeen) and the player's choices in order (inputs),
// so the server can replay the record and compute the result itself instead of trusting a number.
import { newRun } from "./state.js";
import { Game, promptKey } from "./game.js";

const KINDS = { a: 1, p: 1, n: 1, l: 1, t: 1, s: 1 };
const MAX_INPUTS = 6000;
const MAX_STEPS = 60000;

// What a finished run sends to the leaderboard.
export function runRecord(state) {
  return {
    v: 1,
    seed: state.seed,
    daily: !!state.daily,
    name: state.player && state.player.name,
    runIndex: state.runIndex,
    pastSeen: state.pastSeen || {},
    inputs: state.inputs || []
  };
}

// Whether a run can go on the leaderboard: started with recording on, and finished.
export function canSubmit(state) {
  return !!(state && state.inputs && state.pastSeen && state.phase === "ended" && state.ending);
}

// The numbers a leaderboard keeps from a finished run.
export function resultOf(ending) {
  const n = ending.numbers;
  return { score: n.score, beats: n.beats, ending: ending.id, title: ending.title && ending.title.id, graduated: !!ending.graduated,
    years: n.years, pubs: n.pubs, citations: n.citations, h: n.h, daily: ending.daily || null };
}

function fail(code, detail) {
  const e = new Error(code + (detail ? ": " + detail : ""));
  e.code = code;
  return e;
}

// A record from outside is checked before it touches the engine.
function clean(D, rec) {
  if (!rec || typeof rec !== "object" || rec.v !== 1) throw fail("bad_record");
  if (typeof rec.seed !== "string" || !rec.seed || rec.seed.length > 80) throw fail("bad_seed");
  const daily = rec.daily === true;
  if (daily && !/^daily-\d{4}-\d{2}-\d{2}$/.test(rec.seed)) throw fail("bad_seed", "daily");
  const runIndex = Number(rec.runIndex);
  if (!Number.isInteger(runIndex) || runIndex < 1 || runIndex > 1e6) throw fail("bad_run_index");
  const pastSeen = {};
  if (!daily) {
    const ps = rec.pastSeen && typeof rec.pastSeen === "object" ? rec.pastSeen : {};
    const keys = Object.keys(ps);
    if (keys.length > 5000) throw fail("bad_history");
    keys.forEach(function (id) {
      const n = Number(ps[id]);
      if (D.eventById[id] && Number.isInteger(n) && n >= 0 && n < runIndex) pastSeen[id] = n;
    });
  }
  if (!Array.isArray(rec.inputs) || !rec.inputs.length || rec.inputs.length > MAX_INPUTS) throw fail("bad_inputs");
  const inputs = rec.inputs.map(function (x) {
    if (!x || !KINDS[x.k] || !Number.isInteger(x.t) || typeof x.g !== "string") throw fail("bad_inputs");
    return x;
  });
  const name = typeof rec.name === "string" ? rec.name.slice(0, 24) : "Alex";
  return { seed: rec.seed, daily: daily, runIndex: runIndex, pastSeen: pastSeen, inputs: inputs, name: name };
}

function apply(g, x) {
  switch (x.k) {
    case "a": g.answer(x.v && typeof x.v === "object" ? x.v : {}); return true; // some pop-ups return no result
    case "p": return g.submitPlan(x.v && typeof x.v === "object" ? { action: x.v.action, side: x.v.side || null } : null);
    case "n": return !!g.startNewProject();
    case "l": return !!g.requestLeave();
    case "t": return Array.isArray(x.v) ? (g.setTarget(String(x.v[0]), String(x.v[1])), true) : false;
    case "s": return (g.shelveProject(String(x.v)), true);
  }
  return false;
}

// Plays the record through the engine and returns the finished game. Throws if the record doesn't
// fit the game (a different version, or edited), with error.code saying why.
export function replayRun(D, record) {
  const rec = clean(D, record);
  const meta = { runs: rec.runIndex - 1, achievements: {}, seenRuns: rec.pastSeen, codex: {} };
  const g = new Game(D, meta, newRun(D, { seed: rec.seed, daily: rec.daily, name: rec.name }));
  let steps = 0;
  const advance = function () {
    if (++steps > MAX_STEPS) throw fail("too_long");
    const r = g.step();
    if (r.type === "error") throw fail("engine_error");
    return r;
  };
  for (let i = 0; i < rec.inputs.length; i++) {
    const x = rec.inputs[i];
    const s = g.state;
    // Step to where the choice was made: the same turn and stage, with the same pop-up open (or none).
    for (;;) {
      if (s.phase === "ended") throw fail("diverged", "ended before input " + i);
      const here = s.turn === x.t && s.stage === x.g;
      if (x.k === "a") {
        if (here && s.prompt) {
          if (x.id && promptKey(s.prompt) !== x.id) throw fail("diverged", "input " + i + " expected " + x.id + ", got " + promptKey(s.prompt));
          break;
        }
      } else if (here && !s.prompt) break;
      if (s.turn > x.t) throw fail("diverged", "passed input " + i);
      const before = s.stage + "|" + s.turn + "|" + (s.prompt ? promptKey(s.prompt) : "");
      const r = advance();
      if (r.type === "ended") throw fail("diverged", "ended before input " + i);
      // step() waits on an open pop-up or the turn's plan; if nothing moved, the record is off.
      if ((r.type === "plan" || s.prompt) && before === s.stage + "|" + s.turn + "|" + (s.prompt ? promptKey(s.prompt) : "")) throw fail("diverged", "stuck before input " + i);
    }
    if (!apply(g, x)) throw fail("diverged", "input " + i + " did nothing");
  }
  // After the last choice the run plays out to its ending without needing anything else.
  while (g.state.phase !== "ended") {
    const r = advance();
    if (r.type === "ended") break;
    if (r.type === "plan" || g.state.prompt) throw fail("unfinished");
  }
  return g;
}
