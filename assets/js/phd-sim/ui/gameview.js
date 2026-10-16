// The main game screen: header and bars, this turn's focus choices, last turn's report, projects, calendar and log.
import { esc, bar, plural, arrowsHtml, shownStat } from "./common.js";
import {
  yearOf, tOf, turnDates, absTurn, span, WEEKS_PER_TURN, PROJECT_TYPES, STAGE_LABELS, FIELD_LABELS, fieldOf, currentStage, stageInfo,
  deadlineLabel, venuesFor, absToLabel, totalCitations, hIndex, firstAuthorPubs
} from "../engine/index.js";

function dateLine(G) {
  const s = G.state;
  const t = tOf(s.turn);
  const row = G.D.calendar[t - 1] || {};
  const sem = { fall: "Fall", spring: "Spring", summer: "Summer", break: "Winter break" }[row.semester] || "";
  const note = row.note || "";
  return '<div class="ps-date">Year ' + yearOf(s.turn) + " · " + esc(turnDates(s.turn)) + " <small>· " + esc(sem) + (note ? " · " + esc(note) : "") + "</small></div>";
}

export function hudHtml(G) {
  const s = G.state;
  const D = G.D;
  const pubs = firstAuthorPubs(G);
  const pending = s.papers.filter(function (p) { return p.status === "under_review" || p.status === "revise_resubmit"; }).length;
  const chips = s.statuses.filter(function (st) { return D.statusById[st.id]; }).map(function (st) {
    const def = D.statusById[st.id];
    const timed = ["coursework", "ta", "fellowship"].indexOf(st.id) < 0 && st.turns < 20;
    return '<span class="ps-chip" title="' + esc(def.desc) + '">' + esc(def.name) + (timed ? " · " + st.turns : "") + "</span>";
  }).join("");
  const adv = s.advisor ? '<span class="ps-chip ps-chip-accent" title="' + esc("Prof. " + s.advisor.first + " " + s.advisor.surname + " · " + s.advisor.label) + '">Advisor: ' +
    esc(s.advisor.nick) + "</span>" : "";
  return '<section class="ps-hud" aria-label="Your stats">' +
    '<div class="ps-stats">' +
    '<div class="ps-meter"><div class="ps-meter-label"><span>Energy</span><b>' + Math.round(s.stats.energy) + "</b></div>" + bar(s.stats.energy, "ps-bar-energy") + "</div>" +
    '<div class="ps-meter"><div class="ps-meter-label"><span>Stress</span><b>' + Math.round(shownStat("sanity", s.stats.sanity)) + "</b></div>" + bar(shownStat("sanity", s.stats.sanity), "ps-bar-sanity", s.stats.sanity < 25) + "</div>" +
    '<div class="ps-meter"><div class="ps-meter-label"><span>Health</span><b>' + Math.round(s.stats.health) + "</b></div>" + bar(s.stats.health, "ps-bar-health") + "</div>" +
    '<div class="ps-num"><b>' + totalCitations(G) + "</b>citations · h " + hIndex(G) + "</div>" +
    '<div class="ps-num"><b>' + pubs + (pending ? '<small class="ps-muted"> +' + pending + "</small>" : "") + "</b>papers</div>" +
    "</div>" +
    '<div class="ps-chips">' + adv + chips + "</div>" +
    "</section>";
}

// Where a project stands: its stages in order, the finished ones ticked, the current one in bold.
function stagePath(G, p) {
  const stages = PROJECT_TYPES[p.type].stages;
  if (p.revise) return "<b>Revising</b> for the next deadline";
  return stages.map(function (st, i) {
    const name = esc(STAGE_LABELS[st.id]);
    if (i < p.stageIdx) return '<span class="ps-muted">\u2713 ' + name + "</span>";
    if (i === p.stageIdx) return "<b>" + name + "</b>";
    return '<span class="ps-muted">' + name + "</span>";
  }).join(" \u2192 ");
}

function projectCard(G, p) {
  const info = stageInfo(G, p);
  const progressText = (info.ready ? "Ready to submit" : "Stage " + info.n + " of " + info.of + ": " + info.label + " (" + info.hint + ")");
  let target = "";
  if (p.target && p.target.rrPaper) target = "Revision due in " + plural(Math.max(0, p.target.turn - G.state.turn) * WEEKS_PER_TURN, "week");
  else if (p.target && p.target.journalPaper) target = "Revision goes back when it's done";
  else {
    const venues = venuesFor(G, p, { includeJournals: true });
    const opts = venues.map(function (v) {
      const sel = p.target && p.target.venueId === v.id ? " selected" : "";
      return '<option value="' + esc(v.id) + '"' + sel + ">" + esc(v.short || v.name) + " (" + esc(v.tier) + ")</option>";
    }).join("");
    const ttd = p.target ? p.target.turn - G.state.turn : null;
    const none = p.target ? "" : '<option value="" selected disabled>Choose a venue</option>';
    target = '<label class="ps-meta">Target <select class="ps-select" data-action="target" data-id="' + esc(p.id) + '">' + none + opts + "</select></label>" +
      (p.target ? ' <span class="ps-meta">' + esc(deadlineLabel(G, p)) + " deadline " + (ttd === 0 ? "<b>this turn</b>" : "in " + plural(ttd * WEEKS_PER_TURN, "week")) + "</span>" : "");
  }
  const ready = info.ready ? ' <span class="ps-tag">ready</span>' : "";
  return '<div class="ps-card ps-project">' +
    '<div class="ps-spread"><h4>' + esc(p.short) + "</h4>" +
    '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="shelve" data-id="' + esc(p.id) + '" aria-label="Shelve this project">Shelve</button></div>' +
    '<div class="ps-meta">' + esc(PROJECT_TYPES[p.type].label) + " \u00b7 " + esc(FIELD_LABELS[fieldOf(p)]) + ready + "</div>" +
    '<div class="ps-small" style="margin:.3rem 0">' + stagePath(G, p) + "</div>" +
    '<div class="ps-meta">' + esc(progressText) + "</div>" +
    '<div class="ps-row" style="margin-top:.35rem">' + target + "</div>" +
    "</div>";
}

export function boardHtml(G) {
  const s = G.state;
  const active = s.projects.filter(function (p) { return p.status === "active"; });
  const under = s.papers.filter(function (p) { return p.status === "under_review" || p.status === "revise_resubmit"; });
  const pubs = s.papers.filter(function (p) { return p.status === "accepted"; });
  const canNew = !!s.advisor && active.length < (G.D.config.progress.max_active_projects || 4);
  let html = '<div class="ps-section"><h3 class="ps-section-title">Projects</h3>';
  html += active.length ? active.map(function (p) { return projectCard(G, p); }).join("") :
    '<p class="ps-muted ps-small">' + (s.advisor ? "No active projects. Start one with the button above." : "Choose an advisor first.") + "</p>";
  html += "</div>";
  if (under.length) {
    html += '<div class="ps-section"><h3 class="ps-section-title">Under review</h3><div class="ps-card">' + under.map(function (p) {
      const left = Math.max(0, p.decisionTurn - s.turn);
      return '<div class="ps-paper"><span class="ps-tag">' + esc(p.venueName) + "</span>" + esc(p.short) +
        (p.firstAuthor ? "" : ' <span class="ps-muted">(co-author)</span>') +
        '<div class="ps-meta">' + (p.status === "revise_resubmit" ? "Revision in progress" : "Decision in " + plural(left * WEEKS_PER_TURN, "week")) + "</div></div>";
    }).join("") + "</div></div>";
  }
  if (pubs.length) {
    html += '<details class="ps-section"><summary class="ps-section-title">Publications (' + pubs.length + ")</summary><div class=\"ps-card\">" + pubs.map(function (p) {
      return '<div class="ps-paper"><span class="ps-tag">' + esc(p.venueName) + "</span>" + esc(p.title) +
        '<div class="ps-meta">' + (p.firstAuthor ? "First author" : "Co-author") + " · " + plural(Math.round(p.citations || 0) + (p.bonusCites || 0), "citation") + "</div></div>";
    }).join("") + "</div></details>";
  }
  return html;
}

const GROUPS = [
  { kind: "deadline", title: "Deadline" },
  { kind: "opportunity", title: "Only this turn" },
  { kind: "project", title: "Research" },
  { kind: "milestone", title: "Milestones" },
  { kind: "core", title: "Anytime" }
];

function actionButton(a) {
  return '<div class="ps-act' + (a.kind === "project" || a.kind === "deadline" ? " ps-act-project" : "") + (a.kind === "opportunity" ? " ps-act-apply" : "") + '">' +
    '<button class="ps-act-main" data-action="do" data-id="' + esc(a.id) + '">' +
    '<span class="ps-act-label">' + esc(a.label) + "</span>" +
    (a.desc ? '<span class="ps-act-desc">' + esc(a.desc) + "</span>" : "") + arrowsHtml(a.arrows) + "</button></div>";
}

// The turn's focus: one click. The turn's updates and events come right after.
export function planHtml(G, plan) {
  const fx = plan.days;
  const parts = fx.parts;
  const fixed = [];
  if (parts.courses) fixed.push("classes");
  if (parts.ta) fixed.push("TA duty");
  if (parts.defense) fixed.push("defense prep");
  if (parts.family) fixed.push("family");
  let head;
  if (plan.internship) head = "You're at your internship. How will you spend these two weeks?";
  else if (plan.onLeave) head = "You're on leave. Research can wait.";
  else head = "What will you focus on these two weeks?" + (fixed.length ? " (" + esc(fixed.join(", ")) + " take part of them.)" : "");
  if (fx.sick) head += " You're sick, so you'll get less done.";
  if (fx.burnout) head += " You're burned out: half speed, and no weekend work.";
  let html = '<div class="ps-section ps-plan"><h3 class="ps-section-title">This turn</h3><div class="ps-card">' +
    '<p class="ps-small" style="margin-bottom:.6rem">' + head + "</p>";
  GROUPS.forEach(function (g) {
    const list = plan.actions.filter(function (a) { return a.kind === g.kind; });
    if (!list.length) return;
    html += '<div class="ps-meta" style="margin:.5rem 0 .3rem"><b>' + g.title + "</b></div>" +
      '<div class="ps-actions-grid">' + list.map(actionButton).join("") + "</div>";
  });
  if (plan.canStartProject) {
    html += '<div style="margin-top:.7rem"><button class="ps-btn ps-btn-sm" data-action="new-project">+ Start a new project</button> ' +
      '<span class="ps-meta">Doesn\u2019t use up the turn, but it\u2019s a big new commitment.</span> ' +
      arrowsHtml([{ stat: "sanity", dir: "down", strength: plan.newProjectStress >= 10 ? 2 : 1 }]) + "</div>";
  }
  html += "</div></div>";
  return html;
}

const KIND_CLASS = { good: "ps-news-good", bad: "ps-news-bad", news: "ps-news", tip: "ps-tip", achievement: "ps-ach", flavor: "ps-flavor" };

export function reportHtml(G, report) {
  if (!report) return "";
  const deltas = report.deltas.map(function (d) {
    const diff = d.to - d.from;
    const good = diff > 0;
    return '<span class="ps-delta ' + (good ? "ps-delta-good" : "ps-delta-bad") + '">' + esc(d.label) + " " + shownStat(d.stat, d.from) + " \u2192 " + shownStat(d.stat, d.to) + "</span>";
  }).join("");
  const projects = report.projects.map(function (p) {
    return '<div class="ps-small"><b>' + esc(p.short) + ":</b> " + (p.from ? esc(p.from) + " \u2192 " : "") + esc(p.to) + "</div>";
  }).join("");
  const news = report.news.filter(function (e) { return e.kind !== "line" || /\bdone\b|Next:/.test(e.text) === false; }).map(function (e) {
    if (e.kind === "tip") return '<p class="ps-tip ps-small">' + esc(e.text) + ' <a href="' + esc(e.url) + '" target="_blank" rel="noopener">Read: ' + esc(e.title) + " \u2192</a></p>";
    return '<p class="ps-small ' + (KIND_CLASS[e.kind] || "") + '">' + esc(e.text) + "</p>";
  }).join("");
  const did = report.plan && report.plan.label ? '<p class="ps-small"><b>You:</b> ' + esc(report.plan.label) + "</p>" : "";
  return '<div class="ps-section ps-report" aria-live="polite"><h3 class="ps-section-title">Last turn: ' + esc(absToLabel(G, report.turn)) + "</h3>" +
    '<div class="ps-card">' + did + (deltas ? '<div class="ps-deltas">' + deltas + "</div>" : "") + projects + news + "</div></div>";
}

export function calendarHtml(G) {
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
  const upcoming = ev.filter(function (e) { return e.turn >= s.turn && e.turn < s.turn + span(10); }).sort(function (a, b) { return a.turn - b.turn; }).slice(0, 7);
  return '<div class="ps-section"><h3 class="ps-section-title">Coming up</h3><div class="ps-card ps-cal">' +
    (upcoming.length ? upcoming.map(function (e) {
      const d = e.turn - s.turn;
      return "<div><b>" + (d === 0 ? "This turn" : "In " + plural(d * WEEKS_PER_TURN, "week")) + "</b><span>" + esc(e.text) + "</span></div>";
    }).join("") : '<span class="ps-muted">Nothing scheduled in the next few weeks.</span>') + "</div></div>";
}

export function logHtml(G) {
  const s = G.state;
  const recent = s.log.slice(-60);
  const byTurn = {};
  const order = [];
  recent.forEach(function (e) {
    if (!byTurn[e.turn]) { byTurn[e.turn] = []; order.push(e.turn); }
    byTurn[e.turn].push(e);
  });
  order.reverse();
  const body = order.slice(0, 8).map(function (t) {
    return '<div class="ps-log-turn">' + esc(absToLabel(G, t)) + "</div>" + byTurn[t].map(function (e) {
      if (e.kind === "tip") {
        return '<p class="ps-tip">' + esc(e.text) + ' <a href="' + esc(e.url) + '" target="_blank" rel="noopener">Read: ' + esc(e.title) + " →</a></p>";
      }
      return '<p class="' + (KIND_CLASS[e.kind] || "") + '">' + esc(e.text) + "</p>";
    }).join("");
  }).join("");
  return '<div class="ps-section"><h3 class="ps-section-title">Log</h3><div class="ps-card ps-log" aria-live="polite">' +
    (body || '<p class="ps-muted">Your story starts here.</p>') + "</div></div>";
}

export function introHtml(G) {
  if (G.state.turn > 2) return "";
  return '<div class="ps-section"><div class="ps-note"><b>How a turn works.</b> A turn is two weeks. Pick what to focus on, then deal with what comes up: usually one event, sometimes updates like reviews, now and then a side activity. ' +
    "Then the two weeks play out. Balance Energy (it powers work), Stress (at 100 you burn out) and Health (low means sick weeks).</div></div>";
}

export function gameHtml(G, ui) {
  return '<div class="ps-top">' + dateLine(G) +
    '<div class="ps-row"><button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="codex">Codex</button>' +
    '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="help">How to play</button>' +
    '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="leave">Leave the PhD</button>' +
    '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="title">Menu</button></div></div>' +
    hudHtml(G) +
    '<div class="ps-layout"><div>' + introHtml(G) + reportHtml(G, ui.report) + (ui.plan ? planHtml(G, ui.plan) : "") + boardHtml(G) + "</div>" +
    "<div>" + calendarHtml(G) + logHtml(G) + "</div></div>";
}
