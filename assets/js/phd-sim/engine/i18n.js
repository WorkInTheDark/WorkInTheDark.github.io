// Languages. English is the source everywhere: a translation table maps each English string to its
// translation, and anything missing falls back to the English. The game's content (_data/phd_sim) is
// translated once at load time (translateData); text the code writes goes through t().
// Tables live in _data/phd_sim_i18n/<lang>/*.yml as lists of { en, zh } pairs, kept up to date by
// tools/phd-sim/i18n-extract.mjs.
import { annotateQuotes } from "./quotes.js";

export const LANGUAGES = [{ id: "en", label: "EN" }, { id: "zh", label: "中文" }];

let LANG = "en";
let TABLE = {};

export function setLanguage(lang, table) {
  LANG = LANGUAGES.some(function (l) { return l.id === lang; }) ? lang : "en";
  TABLE = LANG === "en" ? {} : table || {};
}

export function language() { return LANG; }

// Marks an English literal for the extractor without translating it yet: for constants defined at
// import time (stage names, chance words) that are translated where they're shown, with t(CONST[id]).
export function T_(en) { return en; }

// The translation of an English string, with {name} placeholders filled from vars. A placeholder
// with no value is left alone, so content tokens like {advisor} still reach fill().
export function t(en, vars) {
  let s = LANG !== "en" && Object.prototype.hasOwnProperty.call(TABLE, en) && TABLE[en] ? TABLE[en] : en;
  if (vars) s = s.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, function (m, k) { return vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m; });
  return s;
}

// Builds the lookup from a table file tree ({ source: [{ en, zh }] }), skipping empty translations.
export function buildTable(tree, lang) {
  const out = {};
  (function walk(node) {
    if (Array.isArray(node)) {
      node.forEach(function (row) {
        if (row && typeof row.en === "string" && typeof row[lang] === "string" && row[lang].trim()) out[row.en] = row[lang];
      });
    } else if (node && typeof node === "object") Object.keys(node).forEach(function (k) { if (k !== "_stale") walk(node[k]); });
  })(tree);
  return out;
}

// ---- Which content fields are text players read ------------------------------------------------
// The same rules drive extraction (what gets translated) and translateData (what gets replaced), so
// ids, flags, stages and other mechanics are never touched. Paper titles stay in English, as real
// papers are; venue names, people, companies and model names stay as they are.
const TEXT_KEYS = ["text", "label", "title", "desc", "openers", "up", "down", "quirks", "fixed_quirks", "why", "group",
  "tag", "reason", "offer", "tagline", "note", "accept", "reject", "findings", "revise", "short", "name", "cities"];
const SKIP_NAME_IN = ["venues", "names"];

// Calls fn(source, string, set) for every player-facing string in the content; set(newValue) replaces it.
// source is "events/<file>" for events and the data file's name otherwise.
export function eachText(data, fn) {
  function walk(o, src, key, set) {
    if (Array.isArray(o)) {
      o.forEach(function (v, i) {
        if (typeof v === "string") { if (key && TEXT_KEYS.indexOf(key) >= 0) fn(src, v, function (nv) { o[i] = nv; }); }
        else walk(v, src, key);
      });
    } else if (o && typeof o === "object") {
      Object.keys(o).forEach(function (k) {
        const v = o[k];
        if (typeof v === "string") {
          if (TEXT_KEYS.indexOf(k) >= 0 && !(k === "name" && SKIP_NAME_IN.indexOf(src) >= 0) && /[A-Za-z]/.test(v)) fn(src, v, function (nv) { o[k] = nv; });
        } else walk(v, src, k);
      });
    } else if (typeof o === "string" && key && TEXT_KEYS.indexOf(key) >= 0 && set) fn(src, o, set);
  }
  Object.keys(data || {}).forEach(function (top) {
    if (top === "events") Object.keys(data.events).forEach(function (f) { walk(data.events[f], "events/" + f, null); });
    else if (top !== "percentiles" && top !== "config") walk(data[top], top, null);
  });
}

// Replaces content text in place with its translation (raw.data from data.json).
export function translateData(raw, table) {
  const data = raw && (raw.data || raw);
  if (!table || !data) return raw;
  annotateQuotes(data.events); // from the English, so every language records the same quotes
  eachText(data, function (src, en, set) { if (Object.prototype.hasOwnProperty.call(table, en) && table[en]) set(table[en]); });
  return raw;
}
