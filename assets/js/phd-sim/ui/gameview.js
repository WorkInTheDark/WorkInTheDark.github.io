// The main game screen: header, stats bar, projects, routine planner, calendar and log.
import { esc, bar, plural } from "./common.js";
import {
  ACTIVITIES, ACTIVITY_BY_ID, yearOf, tOf, PROJECT_TYPES, STAGE_LABELS, currentStage, stageNeed,
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
  const days = (G.state.routine.days["p:" + p.id] || 0);
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
    '<div class="ps-meta">' + esc(PROJECT_TYPES[p.type].label) + stageNo + " · " + plural(days, "day") + "/turn" + ready + "</div>" +
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
  let html = '<div class="ps-section"><div class="ps-spread"><h3 class="ps-section-title">Projects</h3>' +
    '<button class="ps-btn ps-btn-sm" data-action="new-project"' + (canNew ? "" : " disabled") + ">+ New project</button></div>";
  html += active.length ? active.map(function (p) { return projectCard(G, p); }).join("") :
    '<p class="ps-muted ps-small">' + (s.advisor ? "No active projects. Start one." : "Choose an advisor first.") + "</p>";
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

export function plannerHtml(G) {
  const s = G.state;
  const fx = G.fixedDays();
  const r = s.routine.days;
  const parts = fx.parts;
  const fixedBits = [];
  if (parts.courses) fixedBits.push("Courses " + parts.courses);
  if (parts.ta) fixedBits.push("TA " + parts.ta);
  if (parts.meetings) fixedBits.push("Meetings " + parts.meetings);
  if (parts.defense) fixedBits.push("Defense prep " + parts.defense);
  if (parts.family) fixedBits.push("Family " + parts.family);
  if (parts.internship) fixedBits.push("Internship 10");
  const rows = [];
  s.projects.filter(function (p) { return p.status === "active"; }).forEach(function (p) {
    rows.push({ key: "p:" + p.id, label: p.short, desc: STAGE_LABELS[currentStage(G, p).id] });
  });
  ACTIVITIES.forEach(function (a) {
    if (a.id === "mentor" && !s.mentee && !s.flags.has_undergrad_mentee) return;
    rows.push({ key: a.id, label: a.label, desc: a.desc });
  });
  const planned = Object.keys(r).reduce(function (n, k) { return n + (G.validKey(k) ? r[k] : 0); }, 0);
  const over = planned > fx.free;
  const paused = hasStatus(G, "on_internship") || hasStatus(G, "on_leave");
  let html = '<div class="ps-section"><h3 class="ps-section-title">Your routine (repeats every turn)</h3><div class="ps-card">';
  html += '<div class="ps-meta">10 weekdays' + (fixedBits.length ? " − fixed: " + esc(fixedBits.join(", ")) : "") +
    (fx.adj ? " · " + (fx.adj > 0 ? "+" : "−") + Math.abs(fx.adj) + " from events" : "") + (fx.sick ? " · sick −5" : "") +
    (fx.burnout ? " · burnout halves the rest" : "") + "</div>";
  html += '<div class="ps-plan-sum' + (over ? " ps-over" : "") + '" aria-live="polite">' + (paused ? "Your routine is paused this turn." :
    "Planned <b>" + planned + "</b> of <b>" + fx.free + "</b> free days" + (over ? ": extra days get squeezed out." : planned < fx.free ? ". Unplanned days become rest." : ".")) + "</div>";
  rows.forEach(function (row) {
    const n = r[row.key] || 0;
    html += '<div class="ps-plan-row"><div><b>' + esc(row.label) + '</b><span class="ps-meta">' + esc(row.desc || "") + "</span></div>" +
      '<div class="ps-stepper"><button class="ps-step" data-action="dec" data-key="' + esc(row.key) + '" aria-label="One day less on ' + esc(row.label) + '">−</button>' +
      "<output>" + n + '</output><button class="ps-step" data-action="inc" data-key="' + esc(row.key) + '" aria-label="One day more on ' + esc(row.label) + '">+</button></div></div>';
  });
  const otOpts = [{ key: "read", label: "Reading" }, { key: "career", label: "Career prep" }]
    .concat(s.projects.filter(function (p) { return p.status === "active"; }).map(function (p) { return { key: "p:" + p.id, label: p.short }; }));
  html += '<div class="ps-plan-row"><div><b>Weekend overtime</b><span class="ps-meta">Work days on weekends. Costs Energy, Sanity and Health.</span>' +
    '<label class="ps-meta">On <select class="ps-select" data-action="ot-target">' + otOpts.map(function (o) {
      return '<option value="' + esc(o.key) + '"' + (s.routine.overtimeTarget === o.key ? " selected" : "") + ">" + esc(o.label) + "</option>";
    }).join("") + "</select></label></div>" +
    '<div class="ps-stepper"><button class="ps-step" data-action="ot-dec" aria-label="Less weekend overtime">−</button><output>' + (s.routine.overtime || 0) +
    '</output><button class="ps-step" data-action="ot-inc" aria-label="More weekend overtime">+</button></div></div>';
  html += "</div></div>";
  return html;
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
      return '<p class="' + (e.kind === "flavor" ? "ps-flavor" : e.kind === "achievement" ? "ps-ach" : "") + '">' + esc(e.text) + "</p>";
    }).join("");
  }).join("");
  return '<div class="ps-section"><h3 class="ps-section-title">Log</h3><div class="ps-card ps-log" aria-live="polite">' +
    (body || '<p class="ps-muted">Your story starts here.</p>') + "</div></div>";
}

export function gameHtml(G, ui) {
  return '<div class="ps-top">' + dateLine(G) +
    '<div class="ps-row"><button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="codex">Codex</button>' +
    '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="help">How to play</button>' +
    '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="leave">Leave the PhD</button>' +
    '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="title">Menu</button></div></div>' +
    hudHtml(G) +
    '<div class="ps-actions"><button class="ps-btn" data-action="next"' + (ui.busy ? " disabled" : "") + '>Next turn</button>' +
    '<button class="ps-btn ps-btn-primary" data-action="auto"' + (ui.busy ? " disabled" : "") + ">" + (ui.busy && ui.mode === "auto" ? "Playing…" : "Continue ▸▸") + "</button>" +
    (ui.busy && ui.mode === "auto" ? '<button class="ps-btn" data-action="pause">Pause</button>' : "") + "</div>" +
    '<div class="ps-layout"><div>' + boardHtml(G) + plannerHtml(G) + "</div><div>" + calendarHtml(G) + logHtml(G) + "</div></div>";
}
