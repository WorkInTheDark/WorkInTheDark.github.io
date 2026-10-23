// The leaderboard server (tools/phd-sim/leaderboard) with an in-memory store and the game from this
// checkout: runs are replayed before they count, claims must match, and each board keeps a best per player.
//   node --experimental-default-type=module --test tools/phd-sim/tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { prepareData, newRun, Game } from "../../../assets/js/phd-sim/engine/index.js";
import { Rng } from "../../../assets/js/phd-sim/engine/rng.js";
import { runRecord, resultOf } from "../../../assets/js/phd-sim/engine/replay.js";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
process.env.PHDSIM_SITE = pathToFileURL(repo).href;
process.env.PHDSIM_DATA = pathToFileURL(join(repo, "tools", "phd-sim", "out", "data.json")).href;
process.env.ALLOWED_ORIGINS = "http://127.0.0.1:8766";
process.env.ADMIN_TOKEN = "test-admin-token-123456";
const submit = (await import("../leaderboard/api/submit.js")).default;
const board = (await import("../leaderboard/api/board.js")).default;
const admin = (await import("../leaderboard/api/admin.js")).default;
const { useStore, memoryStore } = await import("../leaderboard/lib/redis.js");

const RAW = readFileSync(join(here, "..", "out", "data.json"), "utf8");

function play(seed, daily, effort) {
  const D = prepareData(JSON.parse(RAW));
  const g = new Game(D, { runs: 0, achievements: {}, seenRuns: {}, codex: {} }, newRun(D, { seed, daily, name: "Bot" }));
  const bot = new Rng(seed + ":bot");
  for (let i = 0; i < 20000; i++) {
    const p = g.step();
    if (p.type === "ended") break;
    if (p.type === "turn_end") continue;
    if (p.type === "plan") {
      const A = p.actions;
      const pick = g.state.stats.energy < 25 ? (A.find((a) => a.id === "recharge") || A[0]) : bot.chance(effort) ? (A.find((a) => a.id.indexOf("p:") === 0) || A[0]) : bot.pick(A);
      g.submitPlan({ action: pick.id });
      continue;
    }
    if (p.type === "event") g.answer({ choice: bot.pick(p.choices).i });
    else if (p.type === "rebuttal") g.answer({ responses: {} });
    else if (p.type === "sys" && p.sys === "leave") g.answer({ choice: p.choices.length - 1 });
    else g.answer({ choice: 0 });
  }
  return g.state;
}

async function call(handler, method, url, body) {
  const payload = body ? Buffer.from(JSON.stringify(body)) : null;
  const req = { method, url, headers: { origin: "http://127.0.0.1:8766", "x-forwarded-for": "10.0.0.1" }, socket: {},
    [Symbol.asyncIterator]: async function* () { if (payload) yield payload; } };
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(d) { this.body = d; } };
  await handler(req, res);
  return { status: res.statusCode, headers: res.headers, json: res.body ? JSON.parse(res.body) : null };
}

const PID = "testplayer0000000001", PID2 = "testplayer0000000002";
const today = new Date().toISOString().slice(0, 10);

test("the leaderboard replays, verifies and ranks submitted runs", async () => {
  useStore(memoryStore());
  const run = play("daily-" + today, true, 0.9);
  const body = { pid: PID, nick: "Ada", lang: "en", record: runRecord(run), claim: resultOf(run.ending) };

  // A claim that doesn't match the replay is turned away.
  const fake = await call(submit, "POST", "/api/submit", Object.assign({}, body, { claim: Object.assign({}, body.claim, { score: body.claim.score + 50 }) }));
  assert.equal(fake.status, 422);
  assert.equal(fake.json.reason, "unverified");

  const ok = await call(submit, "POST", "/api/submit", body);
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(ok.json.entry.score, run.ending.numbers.score);
  assert.equal(ok.json.ranks.all.rank, 1);
  assert.equal(ok.json.ranks.daily.rank, 1);
  assert.equal(ok.headers["access-control-allow-origin"], "http://127.0.0.1:8766");

  // The same run can't go on twice, even from someone else.
  const again = await call(submit, "POST", "/api/submit", Object.assign({}, body, { pid: PID2 }));
  assert.equal(again.json.reason, "duplicate");

  // Another player's weaker random run ranks second on the all-time board and isn't on the daily one.
  const other = play("random-seed-7", false, 0.2);
  const o = await call(submit, "POST", "/api/submit", { pid: PID2, nick: "", lang: "zh", record: runRecord(other), claim: resultOf(other.ending) });
  assert.equal(o.status, 200, JSON.stringify(o.json));
  assert.equal(o.json.ranks.daily, undefined);

  const all = await call(board, "GET", "/api/board?kind=all");
  assert.equal(all.json.total, 2);
  assert.deepEqual(all.json.entries.map((e) => e.nick).sort(), ["", "Ada"]);
  assert.ok(all.json.entries[0].score >= all.json.entries[1].score);
  assert.ok(/s-maxage=20/.test(all.headers["cache-control"]));
  const daily = await call(board, "GET", "/api/board?kind=daily&day=" + today + "&me=" + PID);
  assert.equal(daily.json.total, 1);
  assert.equal(daily.json.me.rank, 1);
  assert.equal(daily.json.entries[0].code.length > 20, true);

  // Nicknames are checked; the admin can take a player off the boards.
  const rude = await call(submit, "POST", "/api/submit", Object.assign({}, body, { nick: "visit www.spam.com" }));
  assert.equal(rude.json.reason, "bad_nick");
  const pub = all.json.entries.find((e) => e.nick === "Ada").pub;
  assert.equal((await call(admin, "POST", "/api/admin", { token: "wrong", action: "remove", pub })).status, 403);
  assert.equal((await call(admin, "POST", "/api/admin", { token: "test-admin-token-123456", action: "remove", pub })).json.ok, true);
  assert.equal((await call(board, "GET", "/api/board?kind=all")).json.total, 1);
  assert.equal((await call(board, "GET", "/api/board?kind=daily&day=" + today)).json.total, 0);
});
