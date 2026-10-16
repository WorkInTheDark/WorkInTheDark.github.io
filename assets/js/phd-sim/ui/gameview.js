// The main game screen: header, stats and skills, the turn planner, last turn's report, projects, calendar and log.
import { esc, bar, plural, arrowsHtml } from "./common.js";
import {
  ACTIVITIES, ACTIVITY_BY_ID, STAT_LABELS, yearOf, tOf, PROJECT_TYPES, STAGE_LABELS, currentStage, stageNeed,
  writingCompletion, deadlineLabel, venuesForType, absToLabel, totalCitations, hIndex, firstAuthorPubs, hasStatus
} from "../engine/index.js";

function dateLine(G) {
  const s = G.state;
  const t = tOf(s.turn);
  const row = G.D.calendar[t - 1] || {};
  const sem = { fall: "Fall", spring: "Spring", summer: "Summer", break: "Winter break" }[row.semester] || "";
  return '<div class="ps-date">Year ' + yearOf(s.turn) + " · " + esc(row.dates || "") + " <small>· " + esc(sem) + (row.note ? " · " + esc(row.note) : "") + "</small></div>";
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
    '<div class="ps-meter"><div class="ps-meter-label"><span>Sanity</span><b>' + Math.round(s.stats.sanity) + "</b></div>" + bar(s.stats.sanity, "ps-bar-sanity") + "</div>" +
    '<div class="ps-num"><b>' + totalCitations(G) + "</b>citations · h " + hIndex(G) + "</div>" +
    '<div class="ps-num"><b>' + pubs + (pending ? '<small class="ps-muted"> +' + pending + "</small>" : "") + "</b>papers</div>" +
    "</div>" +
    '<div class="ps-skills" aria-label="Skills">' + ["taste", "coding", "writing", "presenting", "knowledge"].map(function (k) {
      return '<div class="ps-skill"><div class="ps-meter-label"><span>' + esc(STAT_LABELS[k]) + "</span><b>" + Math.round(s.stats[k]) + "</b></div>" + bar(s.stats[k], "ps-bar-skill") + "</div>";
    }).join("") + "</div>" +
    '<div class="ps-chips">' + adv + chips + "</div>" +
    "</section>";
}

function projectCard(G, p) {
  const st = currentStage(G, p);
  const need = stageNeed(G, p);
  const stages = PROJECT_TYPES[p.type].stages;
  let progressText, pct;
  if (st.kind === "wait") {
    progressText = STAGE_LABELS[st.id] + ": waiting, about " + plural(Math.max(1, p.wait), "turn") + " left";
    pct = 0;
  } else {
    pct = Math.min(100, Math.round((p.progress / need) * 100));
    progressText = STAGE_LABELS[st.id] + " " + pct + "%" + (p.pause > 0 ? " (paused " + plural(p.pause, "turn") + ")" : "");
  }
  const stageNo = p.revise ? "" : " · stage " + (p.stageIdx + 1) + " of " + stages.length;
  let target = "";
  if (p.target && p.target.rrPaper) target = "Revision due in " + plural(Math.max(0, p.target.turn - G.state.turn), "turn");
  else if (p.target && p.target.journalPaper) target = "Revision goes back when it's done";
  else {
    const venues = venuesForType(G, p.type, { includeJournals: true });
    const opts = venues.map(function (v) {
      const sel = p.target && p.target.venueId === v.id ? " selected" : "";
      return '<option value="' + esc(v.id) + '"' + sel + ">" + esc(v.short || v.name) + " (" + esc(v.tier) + ")</option>";
    }).join("");
    const ttd = p.target ? p.target.turn - G.state.turn : null;
    const none = p.target ? "" : '<option value="" selected disabled>Choose a venue</option>';
    target = '<label class="ps-meta">Target <select class="ps-select" data-action="target" data-id="' + esc(p.id) + '">' + none + opts + "</select></label>" +
      (p.target ? ' <span class="ps-meta">' + esc(deadlineLabel(G, p)) + " deadline " + (ttd === 0 ? "<b>this turn</b>" : "in " + plural(ttd, "turn")) + "</span>" : "");
  }
  const wc = writingCompletion(G, p);
  const ready = (st.id === "writing" || st.id === "revise") ? ' <span class="ps-tag">' + (wc >= 0.5 ? "submittable" : "drafting") + "</span>" : "";
  return '<div class="ps-card ps-project">' +
    '<div class="ps-spread"><h4>' + esc(p.short) + "</h4>" +
    '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="shelve" data-id="' + esc(p.id) + '" aria-label="Shelve this project">Shelve</button></div>' +
    '<div class="ps-meta">' + esc(PROJECT_TYPES[p.type].label) + stageNo + ready + "</div>" +
    '<div class="ps-progress" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="Stage progress"><span style="width:' + pct + '%"></span></div>' +
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
    '<p class="ps-muted ps-small">' + (s.advisor ? "No active projects. Start one from your choices this turn." : "Choose an advisor first.") + "</p>";
  html += "</div>";
  if (under.length) {
    html += '<div class="ps-section"><h3 class="ps-section-title">Under review</h3><div class="ps-card">' + under.map(function (p) {
      const left = Math.max(0, p.decisionTurn - s.turn);
      return '<div class="ps-paper"><span class="ps-tag">' + esc(p.venueName) + "</span>" + esc(p.short) +
        (p.firstAuthor ? "" : ' <span class="ps-muted">(co-author)</span>') +
        '<div class="ps-meta">' + (p.status === "revise_resubmit" ? "Revision in progress" : "Decision in " + plural(left, "turn")) + "</div></div>";
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

function slotsUsed(sel) {
  return Object.keys(sel.picks).reduce(function (n, k) { return n + sel.picks[k]; }, 0);
}

export function planHtml(G, plan, sel) {
  const fx = plan.days;
  const parts = fx.parts;
  const fixed = [];
  if (parts.courses) fixed.push("classes");
  if (parts.ta) fixed.push("TA duty");
  if (parts.defense) fixed.push("defense prep");
  if (parts.family) fixed.push("family");
  if (fx.adj < 0) fixed.push("other commitments");
  const used = slotsUsed(sel);
  const left = plan.slots - used;
  let head;
  if (plan.internship) head = "You're at your internship this turn. Weekdays belong to it; your weekends are still yours.";
  else head = "Choose <b>" + plan.slots + "</b> thing" + (plan.slots === 1 ? "" : "s") + " to do these two weeks" +
    (fixed.length ? " (the rest goes to " + esc(fixed.join(", ")) + ")" : "") + "." +
    (fx.sick ? " You're sick, so you have less time." : "") + (fx.burnout ? " You're burned out: fewer choices, no weekend work." : "") +
    (plan.onLeave ? " You're on leave: research can wait." : "");
  let html = '<div class="ps-section ps-plan"><div class="ps-spread"><h3 class="ps-section-title">This turn</h3>' +
    '<div class="ps-pips" aria-label="' + used + " of " + plan.slots + ' choices made">' +
    Array.from({ length: plan.slots }).map(function (_, i) { return '<span class="ps-pip' + (i < used ? " ps-pip-on" : "") + '"></span>'; }).join("") + "</div></div>";
  html += '<div class="ps-card"><p class="ps-small" style="margin-bottom:.6rem">' + head + "</p>";
  if (plan.slots > 0) {
    html += '<div class="ps-actions-grid">' + plan.actions.map(function (a) {
      const n = sel.picks[a.id] || 0;
      const full = left <= 0 || n >= a.max;
      return '<div class="ps-act' + (n ? " ps-act-on" : "") + (a.kind === "project" ? " ps-act-project" : "") + (a.kind === "apply" ? " ps-act-apply" : "") + '">' +
        '<button class="ps-act-main" data-action="pick" data-id="' + esc(a.id) + '"' + (full ? " disabled" : "") + ' aria-label="' + esc(a.label + (n ? ", chosen " + n + " times" : "")) + '">' +
        '<span class="ps-act-label">' + esc(a.label) + "</span>" +
        '<span class="ps-act-desc">' + esc(a.desc) + "</span>" + arrowsHtml(a.arrows) + "</button>" +
        (n ? '<div class="ps-act-count"><button class="ps-step" data-action="unpick" data-id="' + esc(a.id) + '" aria-label="One less: ' + esc(a.label) + '">\u2212</button><b>\u00d7' + n + "</b></div>" : "") +
        "</div>";
    }).join("") + "</div>";
  }
  if (plan.weekend.allowed) {
    html += '<label class="ps-weekend">Weekends: <select class="ps-select" data-action="weekend"><option value="off">Off (recover)</option>' +
      plan.weekend.targets.map(function (t) { return '<option value="' + esc(t.id) + '"' + (sel.weekend === t.id ? " selected" : "") + ">Work: " + esc(t.label.replace(/^Work on /, "")) + "</option>"; }).join("") +
      "</select> <span class=\"ps-meta\">Weekend work adds progress but costs Energy, Sanity and Health.</span></label>";
  }
  if (plan.extras.length || plan.canStartProject) {
    html += '<div class="ps-extras"><div class="ps-section-title" style="margin-top:.6rem">Also this turn</div>';
    plan.extras.forEach(function (x) {
      const on = !!sel.extras[x.id];
      html += '<div class="ps-extra"><label><input type="checkbox" data-action="extra" data-id="' + esc(x.id) + '"' + (on ? " checked" : "") + "> <b>" + esc(x.label) + "</b></label>" +
        '<div class="ps-meta">' + esc(x.desc) + "</div>" +
        (x.kind === "submit" && on ? '<label class="ps-meta"><input type="checkbox" data-action="preprint" data-id="' + esc(x.id) + '"' + (sel.extras[x.id].preprint !== false ? " checked" : "") + "> Post a preprint too (citations start early)</label>" : "") +
        "</div>";
    });
    if (plan.canStartProject) html += '<button class="ps-btn ps-btn-sm" data-action="new-project">+ Start a new project</button>';
    html += "</div>";
  }
  html += '<div class="ps-plan-foot">' +
    (plan.last ? '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="repeat-last">Same as last turn</button>' : "<span></span>") +
    '<div class="ps-row">' + (left > 0 && plan.slots > 0 ? '<span class="ps-meta">' + left + " unused \u2192 rest</span>" : "") +
    '<button class="ps-btn ps-btn-primary" data-action="end-turn">End turn \u25b8</button></div></div>';
  html += "</div></div>";
  return html;
}

const KIND_CLASS = { good: "ps-news-good", bad: "ps-news-bad", news: "ps-news", tip: "ps-tip", achievement: "ps-ach", flavor: "ps-flavor" };

export function reportHtml(G, report) {
  if (!report) return "";
  const deltas = report.deltas.map(function (d) {
    const diff = d.to - d.from;
    return '<span class="ps-delta ' + (diff > 0 ? "ps-delta-good" : "ps-delta-bad") + '">' + esc(d.label) + " " + d.from + " \u2192 " + d.to + "</span>";
  }).join("");
  const projects = report.projects.map(function (p) {
    return '<div class="ps-small"><b>' + esc(p.short) + ":</b> " + esc(p.from) + " \u2192 " + esc(p.to) + "</div>";
  }).join("");
  const news = report.news.filter(function (e) { return e.kind !== "line" || /\bdone\b|Next:/.test(e.text) === false; }).map(function (e) {
    if (e.kind === "tip") return '<p class="ps-tip ps-small">' + esc(e.text) + ' <a href="' + esc(e.url) + '" target="_blank" rel="noopener">Read: ' + esc(e.title) + " \u2192</a></p>";
    return '<p class="ps-small ' + (KIND_CLASS[e.kind] || "") + '">' + esc(e.text) + "</p>";
  }).join("");
  return '<div class="ps-section ps-report" aria-live="polite"><h3 class="ps-section-title">Last turn: ' + esc(absToLabel(G, report.turn)) + "</h3>" +
    '<div class="ps-card">' + (deltas ? '<div class="ps-deltas">' + deltas + "</div>" : "") + projects + news + "</div></div>";
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
  if (m.quals !== "passed") ev.push({ turn: (qy - 1) * 26 + 17, text: "Quals" });
  if (m.proposalAt && m.proposal === "pending") ev.push({ turn: m.proposalAt, text: "Thesis proposal" });
  if (m.defenseAt) ev.push({ turn: m.defenseAt, text: "Defense" });
  const upcoming = ev.filter(function (e) { return e.turn >= s.turn && e.turn < s.turn + 10; }).sort(function (a, b) { return a.turn - b.turn; }).slice(0, 7);
  return '<div class="ps-section"><h3 class="ps-section-title">Coming up</h3><div class="ps-card ps-cal">' +
    (upcoming.length ? upcoming.map(function (e) {
      const d = e.turn - s.turn;
      return "<div><b>" + (d === 0 ? "This turn" : "In " + plural(d, "turn")) + "</b><span>" + esc(e.text) + "</span></div>";
    }).join("") : '<span class="ps-muted">Nothing scheduled in the next few turns.</span>') + "</div></div>";
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
  if (G.state.turn > 1) return "";
  return '<div class="ps-section"><div class="ps-note"><b>How a turn works.</b> Each turn is two weeks. Pick what to do with it, then end the turn. ' +
    "Your bars, skills and projects change, and sometimes something happens. Watch Energy (it powers work) and Sanity (at zero you burn out).</div></div>";
}

export function gameHtml(G, ui) {
  return '<div class="ps-top">' + dateLine(G) +
    '<div class="ps-row"><button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="codex">Codex</button>' +
    '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="help">How to play</button>' +
    '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="leave">Leave the PhD</button>' +
    '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="title">Menu</button></div></div>' +
    hudHtml(G) +
    '<div class="ps-layout"><div>' + introHtml(G) + reportHtml(G, ui.report) + (ui.plan ? planHtml(G, ui.plan, ui.sel) : "") + boardHtml(G) + "</div>" +
    "<div>" + calendarHtml(G) + logHtml(G) + "</div></div>";
}
