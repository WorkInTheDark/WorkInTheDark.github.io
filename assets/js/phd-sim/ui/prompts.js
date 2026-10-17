// Scene cards: events, system cards (decisions, deadlines, side activities, committee meetings),
// the rebuttal, and the result view shown after every decision.
import { esc, arrowsHtml, deltasHtml } from "./common.js";
import { ART_FILES } from "./art-manifest.js";

const CATEGORY = {
  research: "Research", data: "Data", writing: "Writing", reviews: "Reviews", advisor: "Advisor", legion: "Advisor",
  lab: "Lab", milestone: "Milestone", teaching: "Teaching", career: "Career", travel: "Travel", world: "The field",
  life: "Life", wellbeing: "Wellbeing", exit: "Crossroads"
};
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
  return '<div class="ps-art"><img src="' + ART + list[h % list.length] + '" alt=""><span class="ps-ribbon">Random event</span></div>';
}

const SYS_KICKER = {
  notice: ["\u{1F4CC}", "Notice"], side: ["\u{1F388}", "On the side"], submit: ["\u{1F4E4}", "Deadline"], qa_result: ["\u{1F393}", "Committee"],
  first_project: ["\u{1F9EA}", "Year 1"], decision: ["\u{1F4E8}", "Decision"], conference: ["\u2708\uFE0F", "Conference"], leave: ["\u{1F6AA}", "Crossroads"]
};

function choiceButtons(choices) {
  return '<div class="ps-choices">' + choices.map(function (c, n) {
    return '<button class="ps-choice" data-action="choose" data-i="' + c.i + '">' +
      '<span><span class="ps-key" aria-hidden="true">' + (n + 1) + "</span>" + esc(c.label) +
      (c.tag ? '<span class="ps-tagchip">' + esc(c.tag) + "</span>" : "") +
      (c.desc ? '<span class="ps-choice-desc">' + esc(c.desc) + "</span>" : "") + "</span>" +
      arrowsHtml(c.arrows) + "</button>";
  }).join("") + "</div>";
}

export function promptClass(p) {
  if (p.type === "event") return "ps-rarity-" + p.rarity;
  return "ps-rarity-system";
}

export function eventHtml(p) {
  const rarity = p.rarity !== "common" ? ' · <span class="ps-r-' + esc(p.rarity) + '">' + esc(p.rarity) + "</span>" : "";
  return artHtml(p) + '<div class="ps-kicker"><span class="ps-kicker-icon" aria-hidden="true">' + (CATEGORY_ICON[p.category] || "\u2022") + "</span>" + esc(CATEGORY[p.category] || p.category) + rarity + "</div>" +
    '<h3 id="ps-dialog-title">' + esc(p.title) + "</h3>" +
    '<p class="ps-text">' + esc(p.text) + "</p>" + choiceButtons(p.choices);
}

export function sysHtml(p) {
  const k = SYS_KICKER[p.sys] || ["\u{1F4E8}", "Decision"];
  const d = p.data || {};
  // A committee meeting: each question, and whether your answer landed.
  const lines = d.lines && d.lines.length ? '<ul class="ps-qa-lines">' + d.lines.map(function (l) {
    return '<li class="' + (l.ok ? "ps-qa-ok" : "ps-qa-no") + '"><span aria-hidden="true">' + (l.ok ? "\u2713" : "\u2717") + "</span>" +
      "<div>" + (l.who ? "<b>" + esc(l.who) + ":</b> " : "") + "\u201c" + esc(l.q) + "\u201d</div></li>";
  }).join("") + "</ul>" : "";
  return '<div class="ps-kicker"><span class="ps-kicker-icon" aria-hidden="true">' + k[0] + "</span>" + k[1] + "</div>" +
    '<h3 id="ps-dialog-title">' + esc(p.title) + "</h3>" + lines +
    '<p class="ps-text">' + esc(p.text) + "</p>" + (d.visible ? deltasHtml(d.visible) : "") + choiceButtons(p.choices);
}

export function rebuttalHtml(p, sel) {
  const exp = p.reviews.filter(function (r, i) { return sel.responses[i] === "experiment"; }).length * 2;
  return '<div class="ps-kicker">Author response · ' + esc(p.venue) + '</div><h3 id="ps-dialog-title">' + esc(p.title) + "</h3>" +
    '<p class="ps-text">Reviews are in. Pick a reply for each reviewer; their tone is a hint.</p>' +
    p.reviews.map(function (r, ri) {
      const cur = sel.responses[ri] || "clarify";
      const opts = p.options.filter(function (o) { return !o.llmOnly || r.llm; });
      return '<div class="ps-review"><div class="ps-review-head"><b>Reviewer ' + r.n + "</b><span>Score " + r.score + "/5 · confidence " + r.confidence + "/5</span></div>" +
        "<blockquote>" + esc(r.opener) + "</blockquote>" +
        "<ul class=\"ps-small\">" + r.concerns.map(function (c) { return "<li>" + esc(c.text) + "</li>"; }).join("") + "</ul>" +
        '<label class="ps-meta">Your response <select class="ps-select" data-action="respond" data-i="' + ri + '">' +
        opts.map(function (o) { return '<option value="' + o.id + '"' + (cur === o.id ? " selected" : "") + ">" + esc(o.label) + "</option>"; }).join("") +
        "</select></label></div>";
    }).join("") +
    '<details class="ps-small"><summary>What the responses do</summary><ul>' + p.options.map(function (o) { return "<li><b>" + esc(o.label) + ":</b> " + esc(o.desc) + "</li>"; }).join("") + "</ul></details>" +
    (exp ? '<p class="ps-meta">New experiments will cost ' + exp + " days this turn.</p>" : "") +
    '<div class="ps-foot"><button class="ps-btn ps-btn-primary" data-action="submit-rebuttal">Submit the response</button></div>';
}


export function resultHtml(res, prompt, achievements) {
  let html = '<div class="ps-result" role="status">';
  if (res.choiceLabel) {
    html += '<div class="ps-chosen">' + (res.success === true ? '<span class="ps-check ps-check-ok">It worked.</span>' : res.success === false ? '<span class="ps-check ps-check-fail">It didn\'t work.</span>' : "") +
      "You chose: " + esc(res.choiceLabel) + "</div>";
  }
  if (res.kind === "rebuttal" && res.reviews) {
    html += res.reviews.map(function (r) {
      return "<p><b>Reviewer " + r.n + ":</b> " + r.before + " → " + r.after + "/5" + (r.lines.length ? '<br><span class="ps-muted ps-small">' + esc(r.lines.join(" ")) + "</span>" : "") + "</p>";
    }).join("") + '<p class="ps-muted ps-small">The final decision comes later.</p>';
  }
  if (res.kind === "qa" && res.qa) {
    html += res.qa.map(function (q) {
      return '<p class="ps-small"><span class="ps-check ' + (q.ok ? "ps-check-ok" : "ps-check-fail") + '">' + (q.ok ? "✓" : "✗") + "</span>" + esc(q.q) + '<br><span class="ps-muted">' + esc(q.line) + "</span></p>";
    }).join("");
  }
  if (res.text) html += '<p class="ps-text">' + esc(res.text) + "</p>";
  html += deltasHtml(res.visible);
  (res.hidden || []).forEach(function (h) { html += '<p class="ps-hidden-line">' + esc(h) + "</p>"; });
  (res.notes || []).forEach(function (n) { html += '<p class="ps-small">' + esc(n) + "</p>"; });
  if (res.tipLink) html += '<a class="ps-tiplink" href="' + esc(res.tipLink.url) + '" target="_blank" rel="noopener">PhD 101: ' + esc(res.tipLink.title) + " →</a>";
  (achievements || []).forEach(function (a) { html += '<p class="ps-small" style="color:var(--ps-legendary)"><b>Achievement: ' + esc(a.name) + "</b> · " + esc(a.desc || "") + "</p>"; });
  html += '<div class="ps-foot"><button class="ps-btn ps-btn-primary" data-action="continue">Continue</button></div></div>';
  return html;
}
