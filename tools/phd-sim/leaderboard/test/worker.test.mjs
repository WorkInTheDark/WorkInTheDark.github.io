// The Worker in Cloudflare's local runtime (Miniflare), with a real local D1 database, fed with runs
// played by the game's own engine. Needs `npm install` in this folder and tools/phd-sim/out/data.json.
//   cd tools/phd-sim/leaderboard && npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Miniflare } from "miniflare";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..", "..");
const eng = await import(join(repo, "assets/js/phd-sim/engine/index.js"));
const { Rng } = await import(join(repo, "assets/js/phd-sim/engine/rng.js"));
const { runRecord, resultOf } = await import(join(repo, "assets/js/phd-sim/engine/replay.js"));
const { encodeResult } = await import(join(repo, "assets/js/phd-sim/ui/share.js"));
const D = eng.prepareData(JSON.parse(readFileSync(join(repo, "tools/phd-sim/out/data.json"), "utf8")));

function play(seed, daily, effort) {
  const g = new eng.Game(D, { runs: 0, achievements: {}, seenRuns: {}, codex: {} }, eng.newRun(D, { seed, daily, name: "Bot" }));
  const bot = new Rng(seed + ":bot");
  for (let i = 0; i < 20000; i++) {
    const p = g.step();
    if (p.type === "ended") break;
    if (p.type === "turn_end") continue;
    if (p.type === "plan") {
      const A = p.actions;
      g.submitPlan({ action: (g.state.stats.energy < 25 ? (A.find((a) => a.id === "recharge") || A[0]) : bot.chance(effort) ? (A.find((a) => a.id.indexOf("p:") === 0) || A[0]) : bot.pick(A)).id });
      continue;
    }
    if (p.type === "event") g.answer({ choice: bot.pick(p.choices).i });
    else if (p.type === "rebuttal") g.answer({ responses: {} });
    else if (p.type === "sys" && p.sys === "leave") g.answer({ choice: p.choices.length - 1 });
    else g.answer({ choice: 0 });
  }
  return g.state;
}
const body = (s, pid, nick) => ({ pid, nick, lang: "en", result: resultOf(s.ending), code: encodeResult(s.ending, D), record: runRecord(s) });

const mf = new Miniflare({
  modules: true,
  scriptPath: join(here, "..", "src", "worker.js"),
  compatibilityDate: "2025-09-01",
  d1Databases: { DB: "test-board" },
  bindings: { ALLOWED_ORIGINS: "http://127.0.0.1:8766", ADMIN_TOKEN: "test-admin-token-123456", HASH_SALT: "test" }
});
const call = async (method, path, data, ip) => {
  const r = await mf.dispatchFetch("http://localhost" + path, { method, headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:8766", "CF-Connecting-IP": ip || "10.0.0.1" }, body: data ? JSON.stringify(data) : undefined });
  return { status: r.status, cors: r.headers.get("access-control-allow-origin"), json: await r.json() };
};

const today = new Date().toISOString().slice(0, 10);
const A = "testplayer0000000001", B = "testplayer0000000002";

test("the Worker takes runs, keeps each player's best, and ranks the boards", async () => {
  const daily = play("daily-" + today, true, 0.9);
  const first = await call("POST", "/api/submit", body(daily, A, "Ada"));
  assert.equal(first.status, 200, JSON.stringify(first.json));
  assert.equal(first.cors, "http://127.0.0.1:8766");
  assert.deepEqual([first.json.ranks.all.rank, first.json.ranks.daily.rank], [1, 1]);

  // The same run can't go on twice; a result that disagrees with its share code is turned away.
  assert.equal((await call("POST", "/api/submit", body(daily, B, "Bo"))).json.reason, "duplicate");
  const other = play("random-1", false, 0.3);
  const forged = body(other, B, "Bo");
  forged.result.score += 100; forged.result.pubs += 3;
  assert.equal((await call("POST", "/api/submit", forged)).json.reason, "invalid");
  assert.equal((await call("POST", "/api/submit", body(other, B, "visit www.spam.com"))).json.reason, "bad_nick");

  const second = await call("POST", "/api/submit", body(other, B, "Bo"));
  assert.equal(second.status, 200, JSON.stringify(second.json));
  assert.equal(second.json.ranks.daily, undefined);

  // A weaker run by the same player doesn't replace their best.
  const weaker = play("random-2", false, 0.0);
  const w = await call("POST", "/api/submit", body(weaker, A, "Ada L."));
  assert.equal(w.status, 200);
  const all = await call("GET", "/api/board?kind=all&me=" + A);
  assert.equal(all.json.total, 2);
  assert.ok(all.json.entries[0].score >= all.json.entries[1].score);
  assert.equal(all.json.me.nick, "Ada L.", "the newest nickname shows");
  const dailyBoard = await call("GET", "/api/board?kind=daily&day=" + today);
  assert.equal(dailyBoard.json.total, 1);
  assert.equal(dailyBoard.json.entries[0].code, encodeResult(daily.ending, D));

  // Admin: wrong token refused; remove takes a player off every board.
  const pub = all.json.entries.find((e) => e.nick === "Bo").pub;
  assert.equal((await call("POST", "/api/admin", { token: "nope", action: "remove", pub })).status, 403);
  assert.equal((await call("POST", "/api/admin", { token: "test-admin-token-123456", action: "ban", pub })).json.ok, true);
  assert.equal((await call("GET", "/api/board?kind=all")).json.total, 1);
  assert.equal((await call("POST", "/api/submit", body(play("random-3", false, 0.5), B, "Bo"))).json.reason, "banned");

  // Rate limit: the 31st submission from one address in an hour is refused.
  let last = null;
  for (let i = 0; i < 31; i++) last = await call("POST", "/api/submit", { pid: "ratelimit000000000001", nick: "", result: {}, code: "x" }, "10.9.9.9");
  assert.equal(last.json.reason, "rate_limited");
});

test.after(() => mf.dispose());
