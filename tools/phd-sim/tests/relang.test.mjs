// Switching language mid-run: the same seed played in English and in Chinese gives two saves that
// differ only in their text, so converting one should give the other.
//   node --experimental-default-type=module --test tools/phd-sim/tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { prepareData, newRun, Game } from "../../../assets/js/phd-sim/engine/index.js";
import { Rng } from "../../../assets/js/phd-sim/engine/rng.js";
import { setLanguage, buildTable, translateData } from "../../../assets/js/phd-sim/engine/i18n.js";
import { convertSave, savedLanguage } from "../../../assets/js/phd-sim/engine/relang.js";

const here = dirname(fileURLToPath(import.meta.url));
const RAW = readFileSync(join(here, "..", "out", "data.json"), "utf8");
const ZH = join(here, "..", "out", "i18n-zh.json");

function play(lang, table, seed) {
  if (lang === "zh") setLanguage("zh", table); else setLanguage("en");
  const raw = JSON.parse(RAW);
  if (lang === "zh") translateData(raw, table);
  const D = prepareData(raw);
  const meta = { runs: 0, achievements: {}, seenRuns: {}, codex: {} };
  const game = new Game(D, meta, newRun(D, { seed, name: "Bot" }));
  const bot = new Rng(seed + ":bot");
  const snaps = [];
  for (let guard = 0; guard < 20000; guard++) {
    const p = game.step();
    if (p.type === "ended") break;
    if (p.type === "turn_end") continue;
    if (p.type === "plan") {
      const A = p.actions, st = game.state.stats;
      const pick = st.energy < 25 || st.health < 30 ? (A.find((a) => a.id === "recharge") || A[0]) :
        (A.find((a) => a.kind === "milestone") || A.find((a) => a.kind === "project") || A[bot.int(0, A.length - 1)]);
      if (p.canStartProject && bot.chance(0.3)) game.startNewProject();
      game.submitPlan({ action: pick.id, side: p.side && p.side.length ? p.side[0].id : null });
      continue;
    }
    // Mid-run, with a pop-up open: what a player leaves behind when they switch on the title screen.
    if (p.type === "event" && !snaps.length && game.state.turn > 15) snaps.push(JSON.parse(JSON.stringify({ state: game.state, meta })));
    if (p.type === "event") game.answer({ choice: p.choices[bot.int(0, p.choices.length - 1)].i });
    else if (p.type === "rebuttal") game.answer({ responses: {} });
    else if (p.type === "sys" && p.sys === "leave") game.answer({ choice: p.choices.length - 1 });
    else game.answer({ choice: 0 });
  }
  snaps.push(JSON.parse(JSON.stringify({ state: game.state, meta })));
  setLanguage("en");
  return snaps;
}

// Chinese is compared as it renders: the game drops a space after full-width punctuation.
const tidy = (s) => s.replace(/([。！？；：，、”’）》])[ \t]+/g, "$1");

function tally(got, want, other, zh, out) {
  if (typeof want === "string") {
    if (want === other) { if (got !== want) out.data.push(want + " -> " + got); return; }
    out.n++;
    if ((zh ? tidy(got) : got) === (zh ? tidy(want) : want)) out.ok++;
    return;
  }
  if (want && typeof want === "object") Object.keys(want).forEach((k) => { if (k !== "lang") tally(got && got[k], want[k], other && other[k], zh, out); });
}

test("a save written in one language converts to the other after a switch", { skip: !existsSync(ZH) && "no exported Chinese table" }, () => {
  const table = buildTable(JSON.parse(readFileSync(ZH, "utf8")), "zh");
  const toEn = { n: 0, ok: 0, data: [] }, toZh = { n: 0, ok: 0, data: [] };
  for (let r = 0; r < 4; r++) {
    const en = play("en", table, "relang-" + r), zh = play("zh", table, "relang-" + r);
    assert.equal(en.length, zh.length, "the two languages played the same run");
    en.forEach((e, i) => {
      const z = zh[i];
      assert.equal(savedLanguage(z.state), "zh");
      const a = JSON.parse(JSON.stringify(z));
      convertSave(a.state, table, "zh", "en"); convertSave(a.meta, table, "zh", "en");
      tally(a, e, z, false, toEn);
      const b = JSON.parse(JSON.stringify(e));
      convertSave(b.state, table, "en", "zh"); convertSave(b.meta, table, "en", "zh");
      tally(b, z, e, true, toZh);
    });
  }
  // Ids, kinds, titles and other values the code compares never change.
  assert.deepEqual(toEn.data, []);
  assert.deepEqual(toZh.data, []);
  // A few Chinese lines translate two English ones ("Ready to submit" / "ready to submit"), so
  // going back to English can pick the other wording; everything else comes out exactly.
  assert.ok(toEn.ok / toEn.n > 0.98, "Chinese to English: " + toEn.ok + "/" + toEn.n);
  assert.ok(toZh.ok / toZh.n > 0.99, "English to Chinese: " + toZh.ok + "/" + toZh.n);
});
