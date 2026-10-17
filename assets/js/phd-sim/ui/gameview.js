// The main game screen, laid out to fit one window (like the original game's single box):
// a one-line top bar; on the left, the main box where this turn's focus choices and every event
// appear; on the right, your projects (with their stages), your status, and what's coming up.
import { esc, bar, plural, arrowsHtml, shownStat } from "./common.js";
import {
  yearOf, tOf, turnDates, absTurn, span, WEEKS_PER_TURN, PROJECT_TYPES, STAGE_LABELS, FIELD_LABELS, fieldOf, stageInfo,
  deadlineLabel, venuesFor, absToLabel, totalCitations, hIndex, firstAuthorPubs
} from "../engine/index.js";

// Short stage names for the step chips on project cards.
const STEP = {
  idea: "Idea", lit: "Related work", pilot: "Pilot", experiments: "Experiments", consolidation: "Consolidation",
  design: "Design", irb: "IRB", recruiting: "Recruiting", sessions: "Sessions", analysis: "Analysis",
  build: "Build", study: "User study", guidelines: "Guidelines", annotation: "Annotation", baselines: "Baselines"
};

function weeksText(turns) {
  return turns <= 0 ? "this turn" : plural(turns * WEEKS_PER_TURN, "week");
}

// ---- Top bar --------------------------------------------------------------------------------

function meter(label, value, cls, low) {
  return '<div class="ps-meter"><div class="ps-meter-label"><span>' + label + "</span><b>" + Math.round(value) + "</b></div>" + bar(value, cls, low) + "</div>";
}

function topBarHtml(G) {
  const s = G.state;
  const row = G.D.calendar[tOf(s.turn) - 1] || {};
  const sem = { fall: "Fall", spring: "Spring", summer: "Summer", break: "Winter break" }[row.semester] || "";
  const pending = s.papers.filter(function (p) { return p.status === "under_review" || p.status === "revise_resubmit"; }).length;
  return '<header class="ps-topbar">' +
    '<div class="ps-when"><b>Year ' + yearOf(s.turn) + " · " + esc(turnDates(s.turn)) + "</b><span>" + esc(sem) + (row.note && row.note !== sem ? " · " + esc(row.note) : "") + "</span></div>" +
    '<div class="ps-meters" aria-label="Your bars">' +
    meter("Energy", s.stats.energy, "ps-bar-energy") +
    meter("Stress", shownStat("sanity", s.stats.sanity), "ps-bar-sanity", s.stats.sanity < 25) +
    meter("Health", s.stats.health, "ps-bar-health") +
    "</div>" +
    '<div class="ps-score"><span><b>' + firstAuthorPubs(G) + "</b>" + (pending ? '<i>+' + pending + "</i>" : "") + " papers</span>" +
    "<span><b>" + totalCitations(G) + "</b> citations</span></div>" +
    '<nav class="ps-tools" aria-label="Game menu">' +
    '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="help">How to play</button>' +
    '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="codex">Codex</button>' +
    '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="log">Log</button>' +
    '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="leave">Leave</button>' +
    '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="title">Menu</button>' +
    "</nav></header>";
}

// ---- The main box: last turn, then this turn's choices ----------------------------------------

const HAPPENED_ICON = { good: "✓", bad: "!", news: "•", stage: "→" };

// The few things worth seeing from last turn; everything else is in the log.
function recapHtml(G, report) {
  if (!report) return "";
  const deltas = report.deltas.map(function (d) {
    const diff = Math.round(shownStat(d.stat, d.to) - shownStat(d.stat, d.from));
    if (!diff) return "";
    const good = d.to > d.from;
    return '<span class="ps-delta ' + (good ? "ps-delta-good" : "ps-delta-bad") + '">' + esc(d.label) + " " + (diff > 0 ? "+" : "−") + Math.abs(diff) + "</span>";
  }).join("");
  const items = [];
  report.projects.forEach(function (p) {
    if (!p.from) return;
    items.push({ kind: p.to === "Ready to submit" || p.to === "Submitted" || p.to === "Published" ? "good" : "stage", text: p.short + ": " + p.from + " → " + p.to });
  });
  report.news.forEach(function (e) {
    if (e.kind === "good" || e.kind === "bad" || e.kind === "news") items.push({ kind: e.kind, text: e.text });
  });
  const tip = report.news.find(function (e) { return e.kind === "tip"; });
  const flavor = report.news.find(function (e) { return e.kind === "flavor"; });
  const shown = items.slice(0, 4);
  const more = items.length - shown.length;
  return '<section class="ps-recap" aria-live="polite">' +
    '<div class="ps-recap-head"><span class="ps-kicker">Last turn · ' + esc(absToLabel(G, report.turn).replace(/^Y\d+ /, "")) + "</span>" +
    (report.plan && report.plan.label ? '<span class="ps-recap-did">You: ' + esc(report.plan.label) + "</span>" : "") + "</div>" +
    (deltas ? '<div class="ps-deltas">' + deltas + "</div>" : "") +
    (shown.length ? '<ul class="ps-happened">' + shown.map(function (it) {
      return '<li class="ps-h-' + it.kind + '"><span aria-hidden="true">' + HAPPENED_ICON[it.kind] + "</span>" + esc(it.text) + "</li>";
    }).join("") + "</ul>" : "") +
    (tip ? '<p class="ps-recap-tip">' + esc(tip.text) + ' <a href="' + esc(tip.url) + '" target="_blank" rel="noopener">' + esc(tip.title) + " →</a></p>" : "") +
    (!shown.length && flavor ? '<p class="ps-recap-flavor">' + esc(flavor.text) + "</p>" : "") +
    (more > 0 ? '<button class="ps-linkbtn" data-action="log">' + more + " more in the log</button>" : "") +
    "</section>";
}

const ORDER = ["deadline", "opportunity", "project", "milestone", "core"];

function optionHtml(a, n) {
  return '<button class="ps-opt ps-opt-' + a.kind + '" data-action="do" data-id="' + esc(a.id) + '">' +
    (n <= 9 ? '<span class="ps-key" aria-hidden="true">' + n + "</span>" : "") +
    '<span class="ps-opt-main"><span class="ps-opt-label">' + esc(a.label) +
    (a.kind === "opportunity" ? ' <span class="ps-pill">only this turn</span>' : "") + "</span>" +
    (a.desc ? '<span class="ps-opt-desc">' + esc(a.desc) + "</span>" : "") + "</span>" +
    arrowsHtml(a.arrows) + "</button>";
}

// Choices in display order: deadlines, this-turn-only, projects, milestones, everyday.
export function orderedActions(plan) {
  const out = [];
  ORDER.forEach(function (k) { plan.actions.forEach(function (a) { if (a.kind === k) out.push(a); }); });
  return out;
}

function planStageHtml(G, ui) {
  const plan = ui.plan;
  const fx = plan.days;
  const parts = fx.parts;
  const fixed = [];
  if (parts.courses) fixed.push("classes");
  if (parts.ta) fixed.push("TA duty");
  if (parts.defense) fixed.push("defense prep");
  if (parts.family) fixed.push("family");
  let sub = "";
  if (plan.internship) sub = "You're at your internship.";
  else if (plan.onLeave) sub = "You're on leave. Research can wait.";
  else if (fixed.length) sub = fixed.join(", ").replace(/^./, function (c) { return c.toUpperCase(); }) + " take part of the time.";
  if (fx.sick) sub += " You're sick: fewer days.";
  if (fx.burnout) sub += " You're burned out: half speed.";
  const first = G.state.turn <= 1 ? '<p class="ps-hint">Pick one thing to focus on for these two weeks. Then whatever happens this turn shows up here, one card at a time. Keep Energy up, Stress down and Health up.</p>' : "";
  const opts = orderedActions(plan);
  return recapHtml(G, ui.report) +
    '<section class="ps-plan" aria-labelledby="ps-plan-q">' +
    '<h2 id="ps-plan-q" class="ps-plan-q">What will you focus on these two weeks?</h2>' +
    (sub ? '<p class="ps-plan-sub">' + esc(sub) + "</p>" : "") + first +
    '<div class="ps-opts">' + opts.map(function (a, i) { return optionHtml(a, i + 1); }).join("") + "</div>" +
    "</section>";
}

// ---- Right column: projects, status, coming up -----------------------------------------------

function stepsHtml(p) {
  const stages = PROJECT_TYPES[p.type].stages;
  if (p.revise) return '<ol class="ps-steps"><li class="ps-step-done">' + (p.ready ? "Revised" : "Draft") + '</li><li class="' + (p.ready ? "ps-step-done" : "ps-step-now") + '">Revising</li></ol>';
  return '<ol class="ps-steps">' + stages.map(function (st, i) {
    let cls = "";
    if (i < p.stageIdx || (p.ready && i === p.stageIdx)) cls = "ps-step-done";
    else if (i === p.stageIdx) cls = st.kind === "wait" ? "ps-step-wait" : "ps-step-now";
    return '<li class="' + cls + '"' + (st.kind === "wait" ? ' title="Takes calendar time, not work"' : "") + ">" + esc(STEP[st.id] || STAGE_LABELS[st.id]) + "</li>";
  }).join("") + "</ol>";
}

function projectCard(G, p, locked) {
  const info = stageInfo(G, p);
  const s = G.state;
  let where;
  if (p.target && p.target.rrPaper) where = "Revision due in " + weeksText(Math.max(0, p.target.turn - s.turn));
  else if (p.target && p.target.journalPaper) where = "Revision goes back when it's done";
  else if (p.target) where = deadlineLabel(G, p) + " in " + weeksText(Math.max(0, p.target.turn - s.turn));
  else where = "No target yet";
  let state;
  if (info.ready) state = "Ready to submit";
  else if (info.wait) state = info.label + ": " + info.hint;
  else if (p.pause > 0) state = info.label + ": " + info.hint;
  else state = info.label + " · " + info.hint.replace(" to finish in a full turn of work", " each turn") + (info.stuck ? " · " + plural(info.stuck, "try") + " so far" : "");
  let targetCtl = "";
  if (!(p.target && (p.target.rrPaper || p.target.journalPaper))) {
    const venues = venuesFor(G, p, { includeJournals: true });
    targetCtl = '<label class="ps-meta">Aim for <select class="ps-select" data-action="target" data-id="' + esc(p.id) + '"' + (locked ? " disabled" : "") + ">" +
      (p.target ? "" : '<option value="" selected disabled>Choose a venue</option>') +
      venues.map(function (v) {
        return '<option value="' + esc(v.id) + '"' + (p.target && p.target.venueId === v.id ? " selected" : "") + ">" + esc(v.short || v.name) + " (" + esc(v.tier) + ")</option>";
      }).join("") + "</select></label>";
  }
  return '<article class="ps-proj' + (info.ready ? " ps-proj-ready" : "") + '">' +
    '<div class="ps-proj-head"><b title="' + esc(p.title) + '">' + esc(p.short) + "</b><span>" + esc(where) + "</span></div>" +
    '<div class="ps-proj-kind">' + esc(PROJECT_TYPES[p.type].label) + " · " + esc(FIELD_LABELS[fieldOf(p)]) + "</div>" +
    stepsHtml(p) +
    '<div class="ps-proj-state">' + esc(state) + "</div>" +
    '<details class="ps-proj-more"><summary>Target and options</summary><div class="ps-row">' + targetCtl +
    '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="shelve" data-id="' + esc(p.id) + '"' + (locked ? " disabled" : "") + ">Shelve project</button></div></details>" +
    "</article>";
}

function projectsHtml(G, ui) {
  const s = G.state;
  const active = s.projects.filter(function (p) { return p.status === "active"; });
  const under = s.papers.filter(function (p) { return p.status === "under_review"; });
  const pubs = s.papers.filter(function (p) { return p.status === "accepted"; });
  const plan = ui.plan;
  const canNew = plan && plan.canStartProject && !ui.modal;
  let html = '<section class="ps-panel ps-panel-projects"><div class="ps-panel-head"><h3>Projects</h3>' +
    (canNew ? '<button class="ps-btn ps-btn-sm" data-action="new-project" title="Doesn’t use up the turn, but it’s a big new commitment">+ New ' +
      arrowsHtml([{ stat: "sanity", dir: "down", strength: plan.newProjectStress >= 10 ? 2 : 1 }]) + "</button>" : "") + "</div>";
  html += active.length ? active.map(function (p) { return projectCard(G, p, !!ui.modal); }).join("") :
    '<p class="ps-empty">' + (s.advisor ? "No active projects. Start one with + New." : "Choose an advisor first.") + "</p>";
  if (under.length) {
    html += '<div class="ps-sub">Under review</div><ul class="ps-mini">' + under.map(function (p) {
      return "<li><b>" + esc(p.venueName) + "</b> " + esc(p.short) + (p.firstAuthor ? "" : " (co-author)") + '<span class="ps-muted"> · decision in ' + weeksText(Math.max(0, p.decisionTurn - s.turn)) + "</span></li>";
    }).join("") + "</ul>";
  }
  if (pubs.length) {
    html += '<details class="ps-pubs"><summary>Published (' + pubs.length + ")</summary><ul class=\"ps-mini\">" + pubs.map(function (p) {
      return "<li><b>" + esc(p.venueName) + "</b> " + esc(p.short) + '<span class="ps-muted"> · ' + (p.firstAuthor ? "first author" : "co-author") + " · " + plural(Math.round(p.citations || 0) + (p.bonusCites || 0), "citation") + "</span></li>";
    }).join("") + "</ul></details>";
  }
  return html + "</section>";
}

// Every tag explained in words: the advisor, your traits, and anything temporary.
function statusHtml(G) {
  const s = G.state;
  const D = G.D;
  const rows = [];
  s.statuses.forEach(function (st) {
    const def = D.statusById[st.id];
    if (!def) return;
    const timed = ["coursework", "ta", "fellowship"].indexOf(st.id) < 0 && st.turns < 20;
    rows.push("<li><b>" + esc(def.name) + "</b><span>" + esc(def.desc) + (timed ? " (" + weeksText(st.turns) + " left)" : "") + "</span></li>");
  });
  const traits = (s.player.traits || []).map(function (id) {
    const t = D.traitById[id];
    return t ? '<span class="ps-trait" title="' + esc(t.up + (t.down ? " / " + t.down : "")) + '">' + esc(t.name) + "</span>" : "";
  }).join("");
  const adv = s.advisor ? '<div class="ps-advisor">Advisor: <b>' + esc(s.advisor.nick) + "</b> " +
    '<span class="ps-muted">Prof. ' + esc(s.advisor.surname) + ", “" + esc(s.advisor.tagline) + "”</span></div>" : '<div class="ps-advisor ps-muted">No advisor yet.</div>';
  return '<section class="ps-panel"><div class="ps-panel-head"><h3>You</h3></div>' + adv +
    (rows.length ? '<ul class="ps-statuses">' + rows.join("") + "</ul>" : "") +
    (traits ? '<div class="ps-traits">' + traits + "</div>" : "") + "</section>";
}

function comingHtml(G) {
  const s = G.state;
  const ev = [];
  s.projects.forEach(function (p) {
    if (p.status !== "active" || !p.target || p.target.turn === null || p.target.turn === undefined) return;
    ev.push({ turn: p.target.turn, text: (p.target.rrPaper ? "Revision due: " : deadlineLabel(G, p) + " deadline: ") + p.short });
  });
  s.papers.forEach(function (p) {
    if (p.status === "under_review") {
      if (p.rebuttal && !p.reviews && p.reviewsTurn >= s.turn) ev.push({ turn: p.reviewsTurn, text: "Reviews: " + p.short });
      ev.push({ turn: p.decisionTurn, text: "Decision: " + p.short });
    }
    if (p.status === "accepted" && p.conferenceTurn && p.conferenceTurn >= s.turn) ev.push({ turn: p.conferenceTurn, text: p.venueName + " conference" });
  });
  const m = s.milestones;
  const qy = m.quals === "failed_once" ? m.qualsYear + 1 : m.qualsYear;
  if (m.quals !== "passed" && s.advisor) ev.push({ turn: absTurn(qy, G.D.config.quals_turn || 18), text: "Quals" });
  if (m.proposalAt && m.proposal === "pending") ev.push({ turn: m.proposalAt, text: "Thesis proposal" });
  if (m.defenseAt) ev.push({ turn: m.defenseAt, text: "Defense" });
  const upcoming = ev.filter(function (e) { return e.turn >= s.turn && e.turn < s.turn + span(10); }).sort(function (a, b) { return a.turn - b.turn; }).slice(0, 4);
  if (!upcoming.length) return "";
  return '<section class="ps-panel"><div class="ps-panel-head"><h3>Coming up</h3></div><ul class="ps-cal">' + upcoming.map(function (e) {
    return "<li><b>" + (e.turn === s.turn ? "This turn" : "In " + weeksText(e.turn - s.turn)) + "</b><span>" + esc(e.text) + "</span></li>";
  }).join("") + "</ul></section>";
}

// ---- Log (opened from the top bar) --------------------------------------------------------------

const KIND_CLASS = { good: "ps-news-good", bad: "ps-news-bad", news: "ps-news", tip: "ps-tip", achievement: "ps-ach", flavor: "ps-flavor" };

export function logHtml(G) {
  const s = G.state;
  const recent = s.log.slice(-120);
  const byTurn = {};
  const order = [];
  recent.forEach(function (e) {
    if (!byTurn[e.turn]) { byTurn[e.turn] = []; order.push(e.turn); }
    byTurn[e.turn].push(e);
  });
  order.reverse();
  const body = order.map(function (t) {
    return '<div class="ps-log-turn">' + esc(absToLabel(G, t)) + "</div>" + byTurn[t].map(function (e) {
      if (e.kind === "tip") return '<p class="ps-tip">' + esc(e.text) + ' <a href="' + esc(e.url) + '" target="_blank" rel="noopener">Read: ' + esc(e.title) + " →</a></p>";
      return '<p class="' + (KIND_CLASS[e.kind] || "") + '">' + esc(e.text) + "</p>";
    }).join("");
  }).join("");
  return '<div class="ps-spread"><h3 id="ps-dialog-title">Log</h3><button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="close-log">Close</button></div>' +
    '<div class="ps-log">' + (body || '<p class="ps-muted">Your story starts here.</p>') + "</div>";
}

// ---- The whole screen -----------------------------------------------------------------------

// promptInner: the current event or update, shown in the main box instead of the turn's choices.
export function gameHtml(G, ui, promptInner, promptCls) {
  const stage = promptInner
    ? '<div class="ps-dialog ' + (promptCls || "") + '" role="region" aria-labelledby="ps-dialog-title">' + promptInner + "</div>"
    : (ui.plan ? planStageHtml(G, ui) : "");
  return '<div class="ps-game">' + topBarHtml(G) +
    '<div class="ps-main">' +
    '<main class="ps-stage">' + stage + "</main>" +
    '<aside class="ps-side">' + projectsHtml(G, ui) + statusHtml(G) + comingHtml(G) + "</aside>" +
    "</div></div>";
}
