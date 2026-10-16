// Small rendering helpers shared by the views.
import { escapeHtml } from "../engine/util.js";

export const esc = escapeHtml;

const SHORT = { energy: "Energy", sanity: "Sanity", citations: "Citations", progress: "Progress", taste: "Taste", coding: "Coding", writing: "Writing", presenting: "Presenting", knowledge: "Knowledge" };
const SYM = { up: ["↑", "↑↑"], down: ["↓", "↓↓"], mixed: ["↕", "↕"] };
const WORD = { up: "up", down: "down", mixed: "could go either way" };

export function arrowsHtml(arrows) {
  if (!arrows || !arrows.length) return "";
  return '<span class="ps-arrows">' + arrows.map(function (a) {
    const sym = SYM[a.dir][a.strength > 1 ? 1 : 0];
    const label = SHORT[a.stat] + " " + WORD[a.dir] + (a.strength > 1 && a.dir !== "mixed" ? " a lot" : "");
    return '<span class="ps-arrow ps-arrow-' + a.dir + '" aria-label="' + esc(label) + '" title="' + esc(label) + '">' +
      esc(SHORT[a.stat]) + " " + sym + "</span>";
  }).join("") + "</span>";
}

const DELTA_LABEL = { energy: "Energy", sanity: "Sanity", citations: "Citations", days: "Free days this turn", days_next: "Free days next turn",
  taste: "Research taste", coding: "Coding", writing: "Writing", presenting: "Presenting", knowledge: "Domain knowledge" };

export function deltasHtml(list) {
  if (!list || !list.length) return "";
  return '<div class="ps-deltas">' + list.filter(function (d) { return d.amount; }).map(function (d) {
    let label = DELTA_LABEL[d.stat] || d.stat;
    let good = d.amount > 0;
    if (d.stat === "progress") label = (d.label || "Project") + " progress";
    if (d.stat === "delay") { label = (d.label || "Project") + " delay (turns)"; good = d.amount < 0; }
    const n = Math.round(d.amount * 10) / 10;
    return '<span class="ps-delta ' + (good ? "ps-delta-good" : "ps-delta-bad") + '">' + esc(label) + " " + (n > 0 ? "+" : "−") + Math.abs(n) + "</span>";
  }).join("") + "</div>";
}

export function bar(value, cls) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return '<div class="ps-bar ' + (cls || "") + (v < 25 ? " ps-bar-low" : "") + '" role="presentation"><span style="width:' + v + '%"></span></div>';
}

export function plural(n, w) {
  return n + " " + w + (n === 1 ? "" : "s");
}

export function prefersReducedMotion() {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
}
