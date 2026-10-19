// Small rendering helpers shared by the views.
import { escapeHtml } from "../engine/util.js";

export const esc = escapeHtml;

// The engine's "sanity" is shown as Stress = 100 − sanity: arrows and numbers flip, colors don't
// (green is always good for you).
const SHORT = { energy: "Energy", sanity: "Stress", health: "Health", citations: "Citations", progress: "Progress", quality: "Quality", quals: "Quals odds" };
const SYM = { up: ["↑", "↑↑"], down: ["↓", "↓↓"], mixed: ["↕", "↕"] };
const WORD = { up: "up", down: "down", mixed: "could go either way" };
const FLIP = { up: "down", down: "up", mixed: "mixed" };

export function arrowsHtml(arrows) {
  if (!arrows || !arrows.length) return "";
  return '<span class="ps-arrows">' + arrows.filter(function (a) { return SHORT[a.stat]; }).map(function (a) {
    const shown = a.stat === "sanity" ? FLIP[a.dir] : a.dir;
    const sym = SYM[shown][a.strength > 1 ? 1 : 0];
    const label = SHORT[a.stat] + " " + WORD[shown] + (a.strength > 1 && a.dir !== "mixed" ? " a lot" : "");
    return '<span class="ps-arrow ps-arrow-' + a.dir + '" aria-label="' + esc(label) + '" title="' + esc(label) + '">' +
      esc(SHORT[a.stat]) + " " + sym + "</span>";
  }).join("") + "</span>";
}

// A stat as the player sees it.
export function shownStat(stat, value) {
  return stat === "sanity" ? 100 - value : value;
}

const DELTA_LABEL = { energy: "Energy", sanity: "Stress", health: "Health", citations: "Citations", days: "Free days this turn", days_next: "Free days next turn" };

export function deltasHtml(list) {
  if (!list || !list.length) return "";
  return '<div class="ps-deltas">' + list.filter(function (d) { return d.amount && (DELTA_LABEL[d.stat] || d.stat === "progress" || d.stat === "delay"); }).map(function (d) {
    let label = DELTA_LABEL[d.stat];
    let good = d.amount > 0;
    if (d.stat === "sanity") d = { stat: d.stat, amount: -d.amount };
    if (d.stat === "progress") return '<span class="ps-delta ' + (good ? "ps-delta-good" : "ps-delta-bad") + '">' + esc((d.label || "Project") + " progress") + " " + (good ? "\u2191" : "\u2193") + "</span>";
    if (d.stat === "delay") { label = (d.label || "Project") + " delay (weeks)"; good = d.amount < 0; }
    const n = Math.round(d.amount * 10) / 10;
    return '<span class="ps-delta ' + (good ? "ps-delta-good" : "ps-delta-bad") + '">' + esc(label) + " " + (n > 0 ? "+" : "−") + Math.abs(n) + "</span>";
  }).join("") + "</div>";
}

// `low` marks the bar as in trouble; by default that's under 25 (for Stress it's the other end).
export function bar(value, cls, low) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const isLow = low === undefined ? v < 25 : low;
  return '<div class="ps-bar ' + (cls || "") + (isLow ? " ps-bar-low" : "") + '" role="presentation"><span style="width:' + v + '%"></span></div>';
}

export function plural(n, w) {
  return n + " " + w + (n === 1 ? "" : "s");
}

export function prefersReducedMotion() {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
}

// Escaped text with the run's paper and project titles (full or short, quoted or not) set off in
// italic semibold. The app registers the titles before each render.
let TITLE_RE = null;
export function setKnownTitles(list) {
  const uniq = Array.from(new Set((list || []).filter(function (t) { return t && t.length >= 3; })))
    .sort(function (a, b) { return b.length - a.length; })
    .map(function (t) { return esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); });
  TITLE_RE = uniq.length ? new RegExp("\u201c?(?:" + uniq.join("|") + ")\u201d?", "g") : null;
}
export function rich(text) {
  const t = esc(text);
  return TITLE_RE ? t.replace(TITLE_RE, function (m) { return '<em class="ps-ttl">' + m + "</em>"; }) : t;
}
