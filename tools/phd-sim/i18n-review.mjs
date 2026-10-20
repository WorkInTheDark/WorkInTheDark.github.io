// Builds the Chinese review page: every translation table, English beside Chinese, grouped by the
// event or item each line belongs to, with flags (a suggested fix and a note) and "file reviewed"
// marks kept in the published page's database so Claude can read them back.
//   ruby tools/phd-sim/export-data.rb && node --experimental-default-type=module tools/phd-sim/i18n-review.mjs <out.html>
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import { eachText } from "../../assets/js/phd-sim/engine/i18n.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const out = process.argv[2] || join(here, "out", "zh-review.html");
const data = JSON.parse(readFileSync(join(here, "out", "data.json"), "utf8")).data;
const tables = JSON.parse(readFileSync(join(here, "out", "i18n-zh.json"), "utf8"));

// Which group (event, item, or code file) each English line belongs to, per table.
function groupsFor(src) {
  const groups = [];
  const seen = new Set();
  const push = (label, strings) => {
    const rows = strings.filter((s) => !seen.has(s));
    rows.forEach((s) => seen.add(s));
    if (rows.length) groups.push({ label, strings: rows });
  };
  const collect = (wrapped) => { const list = []; eachText(wrapped, (s, en) => list.push(en)); return list; };
  if (src.startsWith("events/")) {
    const f = src.slice(7);
    (data.events[f] || []).forEach((ev) => push(ev.id + (ev.title ? " · " + ev.title : ""), collect({ events: { [f]: [ev] } })));
  } else if (src === "code") {
    const files = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : p.endsWith(".js") ? [p] : []; });
    const re = /\b(?:t|T_)\(\s*"((?:[^"\\\n]|\\.)*)"/g;
    files(join(root, "assets", "js", "phd-sim")).sort().forEach((p) => {
      const list = [];
      for (const m of readFileSync(p, "utf8").matchAll(re)) list.push(JSON.parse('"' + m[1] + '"'));
      push(p.includes("/ui/") ? "ui/" + basename(p) : "engine/" + basename(p), list);
    });
  } else {
    const v = data[src];
    if (Array.isArray(v)) v.forEach((item, i) => push(item && item.id ? item.id : src + " " + (i + 1), collect({ [src]: [item] })));
    else if (v && typeof v === "object") Object.keys(v).forEach((k) => push(k, collect({ [src]: { [k]: v[k] } })));
  }
  return groups;
}

const files = Object.keys(tables).filter((s) => s !== "_stale").sort((a, b) => {
  const rank = (s) => (s.startsWith("events/") ? 0 : s === "code" ? 2 : 1);
  return rank(a) - rank(b) || a.localeCompare(b);
}).map((src) => {
  const zh = new Map((tables[src] || []).map((r) => [r.en, r.zh || ""]));
  const groups = groupsFor(src).map((g) => ({ label: g.label, rows: g.strings.filter((en) => zh.has(en)).map((en) => [en, zh.get(en)]) })).filter((g) => g.rows.length);
  // Anything the grouping missed goes at the end, so every row is reviewable.
  const placed = new Set(groups.flatMap((g) => g.rows.map((r) => r[0])));
  const rest = [...zh.keys()].filter((en) => !placed.has(en)).map((en) => [en, zh.get(en)]);
  if (rest.length) groups.push({ label: "other", rows: rest });
  return { src, n: zh.size, groups };
});

const payload = JSON.stringify({ built: new Date().toISOString().slice(0, 10), files }).replace(/</g, "\\u003c");
const tpl = readFileSync(join(here, "i18n-review.html"), "utf8");
writeFileSync(out, tpl.replace("/*DATA*/null", payload));
console.log("wrote " + out + " (" + files.length + " tables, " + files.reduce((t, f) => t + f.n, 0) + " rows, " + Math.round(payload.length / 1024) + " KB of data)");
