// The leaderboard Worker's checks (tools/phd-sim/leaderboard/src/worker.js), which need no Cloudflare
// runtime: a result must be well formed and match the run's share code; nicknames are cleaned.
// The Worker itself runs in Miniflare in tools/phd-sim/leaderboard/test (npm test there).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { prepareData, newRun, Game } from "../../../assets/js/phd-sim/engine/index.js";
import { resultOf } from "../../../assets/js/phd-sim/engine/replay.js";
import { encodeResult } from "../../../assets/js/phd-sim/ui/share.js";
import { checkResult, cleanNick, decodeCode } from "../leaderboard/src/worker.js";

const here = dirname(fileURLToPath(import.meta.url));
const D = prepareData(JSON.parse(readFileSync(join(here, "..", "out", "data.json"), "utf8")));

function finished(seed, daily) {
  const g = new Game(D, { runs: 0, achievements: {}, seenRuns: {}, codex: {} }, newRun(D, { seed, daily, name: "Bot" }));
  for (let i = 0; i < 20000; i++) {
    const p = g.step();
    if (p.type === "ended") break;
    if (p.type === "turn_end") continue;
    if (p.type === "plan") { g.submitPlan({ action: (p.actions.find((a) => a.id.indexOf("p:") === 0) || p.actions[0]).id }); continue; }
    g.answer(p.type === "event" ? { choice: p.choices[0].i } : p.type === "rebuttal" ? { responses: {} } : { choice: p.sys === "leave" ? p.choices.length - 1 : 0 });
  }
  return g.state.ending;
}

test("a finished run's result passes the leaderboard's checks; edited ones don't", () => {
  const today = new Date().toISOString().slice(0, 10);
  for (const [seed, daily] of [["board-1", false], ["daily-" + today, true]]) {
    const e = finished(seed, daily);
    const code = encodeResult(e, D);
    const ok = checkResult(resultOf(e), code, Date.now());
    assert.ok(ok.value, seed + ": " + ok.reason);
    assert.equal(ok.value.day, daily ? today : null);
    assert.equal(decodeCode(code).e, e.id);
    for (const edit of [{ pubs: e.numbers.pubs + 1 }, { citations: e.numbers.citations + 500 }, { ending: "tenure_track" === e.id ? "masters_out" : "tenure_track" }, { score: -1 }]) {
      assert.ok(!checkResult(Object.assign(resultOf(e), edit), code, Date.now()).value, "edited " + JSON.stringify(edit));
    }
  }
  // A daily run counts for a week after its day, never for a day that hasn't come.
  const e = finished("daily-2026-10-01", true);
  assert.equal(checkResult(resultOf(e), encodeResult(e, D), Date.UTC(2026, 9, 5)).value.day, "2026-10-01");
  assert.equal(checkResult(resultOf(e), encodeResult(e, D), Date.UTC(2026, 9, 20)).reason, "daily_out_of_range");
  assert.equal(checkResult(resultOf(e), encodeResult(e, D), Date.UTC(2026, 8, 30)).reason, "daily_out_of_range");
});

test("nicknames: trimmed to 20 characters, no links, markup or slurs", () => {
  assert.equal(cleanNick("  Ada   Lovelace  "), "Ada Lovelace");
  assert.equal(cleanNick(""), "");
  assert.equal(cleanNick("小明同学"), "小明同学");
  assert.equal(Array.from(cleanNick("a".repeat(40))).length, 20);
  assert.equal(cleanNick("see www.x.com"), null);
  assert.equal(cleanNick("<b>hi</b>"), null);
  assert.equal(cleanNick("傻 逼"), null);
  assert.equal(cleanNick("尼玛次仁"), "尼玛次仁", "a common Tibetan name is fine");
});
