// Small shared helpers. Kept to ES2017 syntax so any minifier can read it.
import { language } from "./i18n.js";

export function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}

export function round1(x) {
  return Math.round(x * 10) / 10;
}

// "+7±3" | "-5±2" | "+3" | 4 | true  ->  { center, spread } (booleans pass through)
const RANGE_RE = /^\s*([+-]?\d+(?:\.\d+)?)\s*(?:(?:±|\+-|\+\/-)\s*(\d+(?:\.\d+)?))?\s*$/;
export function parseValue(v) {
  if (typeof v === "number") return { center: v, spread: 0 };
  if (typeof v === "boolean") return { bool: v };
  if (typeof v !== "string") return null;
  const m = RANGE_RE.exec(v);
  if (!m) return null;
  return { center: parseFloat(m[1]), spread: m[2] ? parseFloat(m[2]) : 0 };
}

// Comparison spec: "<30", "<=1", ">=60", ">5", "==2", or a plain value for equality.
const CMP_RE = /^\s*(<=|>=|==|!=|<|>)\s*(-?\d+(?:\.\d+)?)\s*$/;
export function compare(actual, spec) {
  if (typeof spec === "string") {
    const m = CMP_RE.exec(spec);
    if (m) {
      const n = parseFloat(m[2]);
      const a = Number(actual) || 0;
      switch (m[1]) {
        case "<": return a < n;
        case "<=": return a <= n;
        case ">": return a > n;
        case ">=": return a >= n;
        case "==": return a === n;
        case "!=": return a !== n;
      }
    }
    return String(actual) === spec;
  }
  if (Array.isArray(spec)) return spec.indexOf(actual) >= 0;
  return actual === spec;
}

export function asList(x) {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

// The daily PhD's day: today's date in US Eastern Time, so a new one starts at midnight in New York
// (Arthur, 2026-10-23; it was UTC). Daylight saving is handled by the time zone.
export function dailyDay(ms) {
  const d = new Date(ms === undefined ? Date.now() : ms);
  try {
    const p = {};
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    if (p.year && p.month && p.day) return p.year + "-" + p.month + "-" + p.day;
  } catch (e) { /* a browser without time zones: fall back to UTC-5 */ }
  return new Date(d.getTime() - 5 * 3600e3).toISOString().slice(0, 10);
}

// "3rd" in English; "第3" in Chinese (translators write "你{counter.x|ordinal}次").
export function ordinal(n) {
  if (language() === "zh") return "第" + n;
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function escapeHtml(s) {
  return String(s === undefined || s === null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

export function sum(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s;
}

export function assign(target) {
  for (let i = 1; i < arguments.length; i++) {
    const src = arguments[i];
    if (!src) continue;
    for (const k in src) if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
  }
  return target;
}

export function plural(n, word, pluralWord) {
  return n + " " + (n === 1 ? word : (pluralWord || word + "s"));
}
