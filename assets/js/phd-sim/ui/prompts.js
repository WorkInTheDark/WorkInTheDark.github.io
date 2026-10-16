// Modal contents: events, system prompts, advisor matching, new projects, the rebuttal and Q&A
// mini-games, and the result view shown after every decision.
import { esc, arrowsHtml, deltasHtml } from "./common.js";

const CATEGORY = {
  research: "Research", data: "Data", writing: "Writing", reviews: "Reviews", advisor: "Advisor", legion: "Advisor",
  lab: "Lab", milestone: "Milestone", teaching: "Teaching", career: "Career", travel: "Travel", world: "The field",
  life: "Life", wellbeing: "Wellbeing", exit: "Crossroads"
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
  return "ps-rarity-system" + (p.type === "rebuttal" || p.type === "qa" || p.type === "matching" ? " ps-wide" : "");
}

export function eventHtml(p) {
  const rarity = p.rarity !== "common" ? '<span class="ps-r-' + esc(p.rarity) + '">' + esc(p.rarity) + "</span> · " : "";
  return '<div class="ps-kicker">' + rarity + esc(CATEGORY[p.category] || p.category) + "</div>" +
    '<h3 id="ps-dialog-title">' + esc(p.title) + "</h3>" +
    '<p class="ps-text">' + esc(p.text) + "</p>" + choiceButtons(p.choices);
}

export function sysHtml(p) {
  return '<div class="ps-kicker">' + (p.sys === "notice" ? "Notice" : "Decision") + "</div>" +
    '<h3 id="ps-dialog-title">' + esc(p.title) + "</h3>" +
    '<p class="ps-text">' + esc(p.text) + "</p>" + choiceButtons(p.choices);
}

export function matchingHtml(p) {
  return '<div class="ps-kicker">Year 1 · Advisor matching</div><h3 id="ps-dialog-title">' + esc(p.title) + "</h3>" +
    '<p class="ps-text">' + esc(p.text) + "</p>" +
    p.candidates.map(function (c) {
      return '<div class="ps-card ps-cand"><div class="ps-spread"><b>' + esc(c.name) + "</b>" +
        '<span class="ps-chip">' + (c.revealed ? "Confirmed" : "Rumor") + "</span></div>" +
        '<div class="ps-meta">Works on ' + esc(c.area) + "</div>" +
        '<p style="margin:.35rem 0">Students call them <span class="ps-nick">' + esc(c.nick) + "</span>: " + esc(c.tagline) + "</p>" +
        (c.quirks.length ? "<ul>" + c.quirks.map(function (q) { return "<li>" + esc(q) + "</li>"; }).join("") + "</ul>" : "") +
        '<div class="ps-row"><button class="ps-btn ps-btn-primary ps-btn-sm" data-action="join" data-i="' + c.idx + '">Join this lab</button>' +
        (!c.revealed && !p.rotatedThisTurn ? '<button class="ps-btn ps-btn-sm" data-action="rotate" data-i="' + c.idx + '">Rotate here (3 days)</button>' : "") +
        "</div></div>";
    }).join("") +
    (p.forced ? "" : '<div class="ps-foot"><button class="ps-btn" data-action="later">Decide later</button></div>');
}

// One response per reviewer (Clarify unless you change it), then submit.
export function rebuttalHtml(p, sel) {
  const exp = p.reviews.filter(function (r, i) { return sel.responses[i] === "experiment"; }).length * 2;
  return '<div class="ps-kicker">Author response · ' + esc(p.venue) + '</div><h3 id="ps-dialog-title">' + esc(p.title) + "</h3>" +
    '<p class="ps-text">Reviews are in. Choose one response for each reviewer. Their tone gives hints about what they\u2019ll respond to.</p>' +
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
    (exp ? '<p class="ps-meta">New experiments will cost ' + exp + " days this week.</p>" : "") +
    '<div class="ps-foot"><button class="ps-btn ps-btn-primary" data-action="submit-rebuttal">Submit the response</button></div>';
}

export function qaHtml(p, sel) {
  const done = p.questions.every(function (q) { return sel.answers[q.key]; });
  return '<div class="ps-kicker">' + esc(p.title) + '</div><h3 id="ps-dialog-title">' + esc(p.title) + "</h3>" +
    '<p class="ps-text">' + esc(p.text) + "</p>" +
    p.questions.map(function (q, n) {
      return '<div class="ps-q"><div class="ps-q-who">' + esc(q.member) + "</div><div>“" + esc(q.text) + "”</div>" +
        '<div class="ps-strats" role="group" aria-label="How to answer question ' + (n + 1) + '">' + p.strategies.map(function (s) {
          return '<button class="ps-strat" data-action="strat" data-key="' + esc(q.key) + '" data-id="' + s.id + '" aria-pressed="' + (sel.answers[q.key] === s.id) + '" title="' + esc(s.desc) + '">' + esc(s.label) + "</button>";
        }).join("") + "</div></div>";
    }).join("") +
    '<details class="ps-small"><summary>Answer strategies</summary><ul>' + p.strategies.map(function (s) { return "<li><b>" + esc(s.label) + ":</b> " + esc(s.desc) + "</li>"; }).join("") + "</ul></details>" +
    '<div class="ps-foot"><button class="ps-btn ps-btn-primary" data-action="submit-qa"' + (done ? "" : " disabled") + ">Answer</button></div>";
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
