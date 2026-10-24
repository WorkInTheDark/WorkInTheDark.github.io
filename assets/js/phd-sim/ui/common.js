// Small rendering helpers shared by the views.
import { escapeHtml } from "../engine/util.js";
import { t, T_, LANGUAGES, language } from "../engine/i18n.js";

export const esc = escapeHtml;

// The EN / 中文 switch. Each language is named in itself, so it reads the same in every language.
export function langSwitchHtml() {
  return '<div class="ps-langs" role="group" aria-label="Language / 语言">' + LANGUAGES.map(function (l) {
    const on = l.id === language();
    return '<button class="ps-lang' + (on ? " ps-lang-on" : "") + '" data-action="lang" data-id="' + l.id + '" aria-pressed="' + on + '" lang="' + (l.id === "zh" ? "zh-Hans" : "en") + '">' + esc(l.label) + "</button>";
  }).join("") + "</div>";
}

// "1 paper" but "3 papers" (Chinese reads the same either way).
export function papersText(n) { return n === 1 ? t("1 paper") : t("{n} papers", { n: n }); }
export function citationsText(n) { return n === 1 ? t("1 citation") : t("{n} citations", { n: n }); }
export function yearsText(n) { return n === 1 ? t("1 year") : t("{n} years", { n: n }); }

// The engine's "sanity" is shown as Stress = 100 − sanity: arrows and numbers flip, colors don't
// (green is always good for you).
const SHORT = { energy: T_("Energy"), sanity: T_("Stress"), health: T_("Health"), citations: T_("Citations"), progress: T_("Progress"), quality: T_("Quality"), quals: T_("Quals odds") };
const SYM = { up: ["↑", "↑↑"], down: ["↓", "↓↓"], mixed: ["↕", "↕"] };
// What an arrow says, plain and strong ("Energy up", "Energy up a lot").
const SAY = {
  up: [T_("{stat} up"), T_("{stat} up a lot")],
  down: [T_("{stat} down"), T_("{stat} down a lot")],
  mixed: [T_("{stat} could go either way"), T_("{stat} could go either way")]
};
const FLIP = { up: "down", down: "up", mixed: "mixed" };

export function arrowsHtml(arrows) {
  if (!arrows || !arrows.length) return "";
  return '<span class="ps-arrows">' + arrows.filter(function (a) { return SHORT[a.stat]; }).map(function (a) {
    const shown = a.stat === "sanity" ? FLIP[a.dir] : a.dir;
    const sym = SYM[shown][a.strength > 1 ? 1 : 0];
    const name = t(SHORT[a.stat]);
    const label = t(SAY[shown][a.strength > 1 && a.dir !== "mixed" ? 1 : 0], { stat: name });
    return '<span class="ps-arrow ps-arrow-' + a.dir + '" aria-label="' + esc(label) + '" title="' + esc(label) + '">' +
      esc(name) + " " + sym + "</span>";
  }).join("") + "</span>";
}

// A stat as the player sees it.
export function shownStat(stat, value) {
  return stat === "sanity" ? 100 - value : value;
}

const DELTA_LABEL = { energy: T_("Energy"), sanity: T_("Stress"), health: T_("Health"), citations: T_("Citations"), days: T_("Free days this turn"), days_next: T_("Free days next turn") };

export function deltasHtml(list) {
  if (!list || !list.length) return "";
  return '<div class="ps-deltas">' + list.filter(function (d) { return d.amount && (DELTA_LABEL[d.stat] || d.stat === "progress" || d.stat === "delay"); }).map(function (d) {
    let label = DELTA_LABEL[d.stat] ? t(DELTA_LABEL[d.stat]) : "";
    let good = d.amount > 0;
    if (d.stat === "sanity") d = { stat: d.stat, amount: -d.amount };
    if (d.stat === "progress") return '<span class="ps-delta ' + (good ? "ps-delta-good" : "ps-delta-bad") + '">' + esc(t("{project} progress", { project: d.label || t("Project") })) + " " + (good ? "\u2191" : "\u2193") + "</span>";
    if (d.stat === "delay") { label = t("{project} delay (weeks)", { project: d.label || t("Project") }); good = d.amount < 0; }
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

export function prefersReducedMotion() {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
}

// Escaped text with the run's paper and project titles (full or short, quoted or not) set off in
// italic semibold. The app registers the titles before each render.
let TITLE_RE = null;
export function setKnownTitles(list) {
  const uniq = Array.from(new Set((list || []).filter(function (x) { return x && x.length >= 3; })))
    .sort(function (a, b) { return b.length - a.length; })
    .map(function (x) { return esc(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); });
  TITLE_RE = uniq.length ? new RegExp("\u201c?(?:" + uniq.join("|") + ")\u201d?", "g") : null;
}
export function rich(text) {
  const s = esc(text);
  return TITLE_RE ? s.replace(TITLE_RE, function (m) { return '<em class="ps-ttl">' + m + "</em>"; }) : s;
}
