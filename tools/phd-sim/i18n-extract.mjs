// Keeps the translation tables in step with the English: every player-facing string in the content
// (the fields engine/i18n.js eachText picks) and every t("...") in the code gets a row in
// _data/phd_sim_i18n/<lang>/<source>.yml. Existing translations are kept; rows whose English is gone
// move to _stale.yml so an edited line can be re-translated from its old version.
//   ruby tools/phd-sim/export-data.rb && node --experimental-default-type=module tools/phd-sim/i18n-extract.mjs [lang=zh]
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { eachText } from "../../assets/js/phd-sim/engine/i18n.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const LANG = process.argv[2] || "zh";
const data = JSON.parse(readFileSync(join(here, "out", "data.json"), "utf8")).data;
const prevPath = join(here, "out", "i18n-" + LANG + ".json");
const prev = existsSync(prevPath) ? JSON.parse(readFileSync(prevPath, "utf8")) : {};

// What translators had before, English -> translation, from every table (including _stale).
const known = {};
Object.values(prev).forEach((rows) => (rows || []).forEach((r) => { if (r && r.en && r[LANG]) known[r.en] = r[LANG]; }));

const sources = {};
const add = (src, en) => { (sources[src] = sources[src] || new Map()).set(en, true); };
eachText(data, (src, en) => add(src, en));

// t("...") calls in the game's code (double-quoted literals; the first argument is the English).
function jsFiles(dir) {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? jsFiles(p) : p.endsWith(".js") ? [p] : []; });
}
const T_RE = /\b(?:t|T_)\(\s*"((?:[^"\\\n]|\\.)*)"/g;
jsFiles(join(root, "assets", "js", "phd-sim")).forEach((f) => {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(T_RE)) add("code", JSON.parse('"' + m[1] + '"'));
});

const q = (s) => JSON.stringify(s);
const outDir = join(root, "_data", "phd_sim_i18n", LANG);
let rowsTotal = 0, translated = 0;
const used = new Set();
Object.keys(sources).sort().forEach((src) => {
  const rows = [...sources[src].keys()];
  const path = join(outDir, src + ".yml");
  mkdirSync(dirname(path), { recursive: true });
  const body = rows.map((en) => { used.add(en); rowsTotal++; const tr = known[en] || ""; if (tr) translated++; return "- en: " + q(en) + "\n  " + LANG + ": " + q(tr); }).join("\n");
  writeFileSync(path, "# " + LANG + " translations for " + src + " (English is the source; see docs/phd-simulator/zh-guide.md).\n" + body + "\n");
});
const stale = Object.keys(known).filter((en) => !used.has(en));
writeFileSync(join(outDir, "_stale.yml"), "# Translations whose English no longer appears (kept to help re-translate edited lines).\n" +
  (stale.length ? stale.map((en) => "- en: " + q(en) + "\n  " + LANG + ": " + q(known[en])).join("\n") + "\n" : "[]\n"));
console.log("tables in " + relative(root, outDir) + ": " + Object.keys(sources).length + " files, " + rowsTotal + " strings, " + translated + " translated, " + stale.length + " stale");
