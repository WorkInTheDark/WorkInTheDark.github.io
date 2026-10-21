// Scene cards: events, system cards (decisions, deadlines, side activities, committee meetings),
// the rebuttal, and the result view shown after every decision.
import { esc, rich, arrowsHtml, deltasHtml } from "./common.js";
import { ART_FILES } from "./art-manifest.js";
import { t, T_ } from "../engine/i18n.js";

const CATEGORY = {
  research: T_("Research"), data: T_("Data"), writing: T_("Writing"), reviews: T_("Reviews"), advisor: T_("Advisor"), legion: T_("Advisor"),
  lab: T_("Lab"), milestone: T_("Milestone"), teaching: T_("Teaching"), career: T_("Career"), travel: T_("Travel"), world: T_("The field"),
  life: T_("Life"), wellbeing: T_("Wellbeing"), exit: T_("Crossroads")
};
const RARITY = { uncommon: T_("uncommon"), rare: T_("rare"), legendary: T_("legendary") };
const CATEGORY_ICON = {
  research: "\u{1F52C}", data: "\u{1F5C2}\uFE0F", writing: "\u270D\uFE0F", reviews: "\u{1F4DD}", advisor: "\u{1F9D1}\u200D\u{1F3EB}", legion: "\u{1F9D1}\u200D\u{1F3EB}",
  lab: "\u{1F9EA}", milestone: "\u{1F393}", teaching: "\u{1F34E}", career: "\u{1F4BC}", travel: "\u2708\uFE0F", world: "\u{1F30D}",
  life: "\u{1F3E0}", wellbeing: "\u{1F33F}", exit: "\u{1F6AA}"
};
// Event pictures: a few per category (art-manifest.js), picked by the event id so an event always
// shows the same one.
const ART = new URL("../../../phd-sim/art/", import.meta.url).href;
function artHtml(p) {
  const list = ART_FILES[p.category === "legion" ? "advisor" : p.category];
  if (!list || !list.length) return "";
  let h = 0;
  String(p.id || p.title || "").split("").forEach(function (ch) { h = (h * 31 + ch.charCodeAt(0)) >>> 0; });
  return '<div class="ps-art"><img src="' + ART + list[h % list.length] + '" alt=""><span class="ps-ribbon">' + t("Random event") + "</span></div>";
}

const SYS_KICKER = {
  notice: ["\u{1F4CC}", T_("News")], quals_notice: ["\u{1F393}", T_("Quals")], side: ["\u{1F388}", T_("On the side")], submit: ["\u{1F4E4}", T_("Deadline")], qa_result: ["\u{1F393}", T_("Committee")],
  first_project: ["\u{1F9EA}", T_("Year 1")], focus_result: ["\u{1F4CB}", T_("Your two weeks")], decision: ["\u{1F4E8}", T_("Decision")], conference: ["\u2708\uFE0F", T_("Conference")], leave: ["\u{1F6AA}", T_("Crossroads")]
};

function choiceButtons(choices) {
  return '<div class="ps-choices">' + choices.map(function (c, n) {
    return '<button class="ps-choice" data-action="choose" data-i="' + c.i + '">' +
      '<span><span class="ps-key" aria-hidden="true">' + (n + 1) + "</span>" + rich(c.label) +
      (c.tag ? '<span class="ps-tagchip">' + esc(c.tag) + "</span>" : "") +
      (c.desc ? '<span class="ps-choice-desc">' + esc(c.desc) + "</span>" : "") + "</span>" +
      arrowsHtml(c.arrows) + "</button>";
  }).join("") + "</div>";
}

// A first-author acceptance is the best news in the game, so its card gets the gold treatment.
export function isAcceptance(p) {
  return !!p && p.type === "sys" && p.sys === "decision" && !!p.data && p.data.outcome === "accept" && !p.data.coauthor;
}

export function promptClass(p) {
  if (p.type === "event") return "ps-rarity-" + p.rarity;
  if (isAcceptance(p)) return "ps-rarity-legendary ps-accept-card";
  if (p.sys === "focus_result") return "ps-rarity-system ps-focus-card";
  return "ps-rarity-system";
}

export function eventHtml(p) {
  const rarity = p.rarity !== "common" ? ' · <span class="ps-r-' + esc(p.rarity) + '">' + esc(RARITY[p.rarity] ? t(RARITY[p.rarity]) : p.rarity) + "</span>" : "";
  return artHtml(p) + '<div class="ps-kicker"><span class="ps-kicker-icon" aria-hidden="true">' + (CATEGORY_ICON[p.category] || "\u2022") + "</span>" + esc(CATEGORY[p.category] ? t(CATEGORY[p.category]) : p.category) + rarity + "</div>" +
    '<h3 id="ps-dialog-title">' + rich(p.title) + "</h3>" +
    '<p class="ps-text">' + rich(p.text) + "</p>" + choiceButtons(p.choices);
}

export function sysHtml(p) {
  const k = SYS_KICKER[p.sys] || ["\u{1F4E8}", T_("Decision")];
  const d = p.data || {};
  // A committee meeting: each question, and whether your answer landed.
  const lines = d.lines && d.lines.length ? '<ul class="ps-qa-lines">' + d.lines.map(function (l) {
    return '<li class="' + (l.ok ? "ps-qa-ok" : "ps-qa-no") + '"><span aria-hidden="true">' + (l.ok ? "\u2713" : "\u2717") + "</span>" +
      "<div>" + (l.who ? "<b>" + esc(l.who) + ":</b> " : "") + "\u201c" + esc(l.q) + "\u201d</div></li>";
  }).join("") + "</ul>" : "";
  return '<div class="ps-kicker"><span class="ps-kicker-icon" aria-hidden="true">' + k[0] + "</span>" + t(k[1]) + "</div>" +
    '<h3 id="ps-dialog-title">' + rich(p.title) + "</h3>" + lines +
    '<p class="ps-text">' + rich(p.text) + "</p>" + (d.visible ? deltasHtml(d.visible) : "") + choiceButtons(p.choices);
}

// A review score as five dots, colored by how good it is.
export function scoreDots(score) {
  const cls = score >= 4 ? "ps-sd-good" : score >= 3 ? "ps-sd-mid" : "ps-sd-bad";
  let d = "";
  for (let i = 1; i <= 5; i++) d += "<i" + (i <= score ? ' class="' + cls + '"' : "") + "></i>";
  return '<span class="ps-score-dots" role="img" aria-label="' + esc(t("{n} out of 5", { n: score })) + '">' + d + "</span>";
}

// A review score with where the chosen reply could take it: dashed dots for points it could
// gain if the reply goes well, faded dots for points it could lose if it goes badly.
function outlookDots(score, o) {
  if (!o) return scoreDots(score);
  const up = Math.max(score, o.up), down = Math.min(score, o.down);
  const cls = score >= 4 ? "ps-sd-good" : score >= 3 ? "ps-sd-mid" : "ps-sd-bad";
  let d = "";
  for (let i = 1; i <= 5; i++) {
    d += i <= down ? '<i class="' + cls + '"></i>' : i <= score ? '<i class="' + cls + ' ps-sd-risk"></i>' : i <= up ? '<i class="ps-sd-gain"></i>' : "<i></i>";
  }
  const say = esc(outlookSay(score, up, down, o.half));
  return '<span class="ps-score-dots ps-outlook' + (o.half ? " ps-sd-half" : "") + '" role="img" aria-label="' + say + '" title="' + say + '">' + d + "</span>";
}

// What the outlook dots say, for screen readers and the tooltip.
function outlookSay(score, up, down, half) {
  const v = { n: score, up: up, down: down };
  const rise = up > score, fall = down < score;
  if (rise && fall) return half ? t("{n} out of 5, could rise to {up}, could fall to {down}, counts half if the chair agrees", v) : t("{n} out of 5, could rise to {up}, could fall to {down}", v);
  if (rise) return half ? t("{n} out of 5, could rise to {up}, counts half if the chair agrees", v) : t("{n} out of 5, could rise to {up}", v);
  if (fall) return half ? t("{n} out of 5, could fall to {down}, counts half if the chair agrees", v) : t("{n} out of 5, could fall to {down}", v);
  return half ? t("{n} out of 5, counts half if the chair agrees", v) : t("{n} out of 5", v);
}

const SEVERITY = { fatal: 4, critical: 3, major: 2, minor: 1 };

// One row per reviewer: score, their main concern, and your reply. The dots show what the reply
// could do to the score.
export function rebuttalHtml(p, sel) {
  const exp = p.reviews.filter(function (r, i) { return sel.responses[i] === "experiment"; }).length * 2;
  return '<div class="ps-kicker">' + esc(t("Author response · {venue}", { venue: p.venue })) + '</div><h3 id="ps-dialog-title">' + esc(p.title) + "</h3>" +
    '<p class="ps-text">' + t("Pick a reply for each reviewer.") + "</p>" +
    '<p class="ps-outlook-key"><span class="ps-score-dots ps-outlook" aria-hidden="true"><i class="ps-sd-gain"></i></span> ' + t("could gain") +
    '<span class="ps-score-dots ps-outlook" aria-hidden="true"><i class="ps-sd-mid ps-sd-risk"></i></span> ' + t("could lose") + "</p>" +
    p.reviews.map(function (r, ri) {
      const cur = sel.responses[ri] || "clarify";
      const opts = p.options.filter(function (o) { return !o.llmOnly || r.llm; });
      const main = r.concerns.slice().sort(function (a, b) { return (SEVERITY[b.severity] || 0) - (SEVERITY[a.severity] || 0); })[0];
      return '<div class="ps-review"><span class="ps-review-who"><b>' + esc(t("R{n}", { n: r.n })) + "</b>" + outlookDots(r.score, p.outlook && p.outlook[ri] && p.outlook[ri][cur]) + "</span>" +
        '<span class="ps-review-concern" title="' + esc(r.concerns.map(function (c) { return c.text; }).join(" ")) + '">' + esc(main ? main.text : "") +
        (r.concerns.length > 1 ? ' <span class="ps-muted">+' + (r.concerns.length - 1) + "</span>" : "") + "</span>" +
        '<select class="ps-select" data-action="respond" data-i="' + ri + '" aria-label="' + esc(t("Reply to reviewer {n}", { n: r.n })) + '">' +
        opts.map(function (o) { return '<option value="' + o.id + '"' + (cur === o.id ? " selected" : "") + ">" + esc(o.label) + "</option>"; }).join("") +
        "</select></div>";
    }).join("") +
    (exp ? '<p class="ps-meta">' + t("New experiments cost {n} days next turn and some Energy.", { n: exp }) + "</p>" : "") +
    '<div class="ps-foot"><button class="ps-btn ps-btn-primary" data-action="submit-rebuttal">' + t("Send the response") + "</button></div>";
}


export function resultHtml(res, prompt, achievements) {
  let html = '<div class="ps-result" role="status">';
  if (res.choiceLabel) {
    html += '<div class="ps-chosen">' + (res.success === true ? '<span class="ps-check ps-check-ok">' + t("It worked.") + "</span>" : res.success === false ? '<span class="ps-check ps-check-fail">' + t("It didn't work.") + "</span>" : "") +
      esc(t("You chose: {choice}", { choice: res.choiceLabel })) + "</div>";
  }
  if (res.kind === "rebuttal" && res.reviews) {
    html += res.reviews.map(function (r) {
      return '<div class="ps-review ps-review-result"><span class="ps-review-who"><b>' + esc(t("R{n}", { n: r.n })) + "</b>" + scoreDots(r.before) + " → " + scoreDots(r.after) + "</span>" +
        '<span class="ps-review-concern ps-muted">' + esc(r.lines[0] || (r.after > r.before ? t("Convinced.") : t("Unmoved."))) + "</span></div>";
    }).join("") + '<p class="ps-muted ps-small">' + t("The decision comes later.") + "</p>";
  }
  if (res.kind === "qa" && res.qa) {
    html += res.qa.map(function (q) {
      return '<p class="ps-small"><span class="ps-check ' + (q.ok ? "ps-check-ok" : "ps-check-fail") + '">' + (q.ok ? "✓" : "✗") + "</span>" + esc(q.q) + '<br><span class="ps-muted">' + esc(q.line) + "</span></p>";
    }).join("");
  }
  if (res.text) html += '<p class="ps-text">' + rich(res.text) + "</p>";
  html += deltasHtml(res.visible);
  (res.hidden || []).forEach(function (h) { html += '<p class="ps-hidden-line">' + esc(h) + "</p>"; });
  (res.notes || []).forEach(function (n) { html += '<p class="ps-small">' + rich(n) + "</p>"; });
  html += '<div class="ps-foot"><button class="ps-btn ps-btn-primary" data-action="continue">' + t("Continue") + "</button></div></div>";
  return html;
}
