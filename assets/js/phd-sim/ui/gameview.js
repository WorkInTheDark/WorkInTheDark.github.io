// The game screen: a compact window that sits inside the page, like the original game's box.
// A top strip (date, bars, score) with a progress band under it (project trackers and what's
// affecting you), a scene in the middle (this turn's choices, or whatever is happening), and a
// quiet footer with PhD 101 pointers.
import { esc, rich, bar, plural, arrowsHtml, shownStat } from "./common.js";
import {
  yearOf, turnDates, absTurn, WEEKS_PER_TURN, PROJECT_TYPES, STAGE_LABELS, FIELD_LABELS, fieldOf, stageInfo,
  deadlineLabel, venuesFor, totalCitations, firstAuthorPubs, qualsPassChance, chanceWord, defenseOpensAt
} from "../engine/index.js";
import { isAcceptance } from "./prompts.js";

const KIND_ICON = { empirical: "\u{1F9EA}", study: "\u{1F5E3}️", system: "\u{1F6E0}️", dataset: "\u{1F5C2}️", position: "\u{1F9ED}" };
const STATUS_ICON = {
  coursework: "\u{1F4D8}", ta: "\u{1F34E}", fellowship: "\u{1F396}️", sick: "\u{1F912}", burnout: "\u{1FAAB}", deadline_mode: "⏰",
  post_rejection_blues: "\u{1F327}️", jet_lagged: "\u{1F634}", in_the_zone: "✨", in_love: "\u{1F496}", on_leave: "\u{1F3D6}️",
  on_internship: "\u{1F4BC}", quals_prep: "\u{1F4DA}", proposal_prep: "\u{1F3A4}", defense_prep: "\u{1F393}", job_market: "\u{1F4BC}",
  at_conference: "✈️", injured: "\u{1FA79}"
};

function weeksShort(turns) {
  return turns <= 0 ? "now" : turns * WEEKS_PER_TURN + "w";
}

function actionIcon(G, a) {
  if (a.kind === "opportunity") return "\u{1F39F}️";
  if (a.id.indexOf("crunch:") === 0) return "\u{1F525}";
  if (a.id.indexOf("refine:") === 0) return "✨";
  if (a.id.indexOf("p:") === 0 || a.id.indexOf("intern_weekend:") === 0) {
    const p = G.state.projects.find(function (x) { return x.id === a.id.slice(a.id.indexOf(":") + 1); });
    if (p && p.ready) return "✨";
    return p ? KIND_ICON[p.type] : "\u{1F52C}";
  }
  return {
    read: "\u{1F4DA}", recharge: "\u{1F6CC}", intern_all: "\u{1F4BC}", intern_pace: "\u{1F33F}", apply_internship: "\u{1F4EE}",
    apply_fellowship: "\u{1F4DD}", proposal: "\u{1F3A4}", defense: "\u{1F393}", job_market: "\u{1F4BC}", quals_prep: "\u{1F4DD}"
  }[a.id] || "•";
}

// ---- Top strip --------------------------------------------------------------------------------

// A gauge with its name spelled out: "⚡ Energy  80" above the bar.
function meter(icon, label, value, cls, low) {
  return '<div class="ps-meter" title="' + label + " " + Math.round(value) + '"><span class="ps-meter-name"><span aria-hidden="true">' + icon + "</span> " + label + "</span>" +
    "<b>" + Math.round(value) + "</b>" + bar(value, cls, low) + "</div>";
}

function hudHtml(G) {
  const s = G.state;
  const t = s.turn % 26;
  const start = turnDates(s.turn).split(/[– ]/);
  const pending = s.papers.filter(function (p) { return p.status === "under_review" || p.status === "revise_resubmit"; }).length;
  return '<header class="ps-hud">' +
    '<div class="ps-cal-badge" title="' + esc(turnDates(s.turn)) + '"><span>Year ' + yearOf(s.turn) + "</span><b>" + esc(start[0] + " " + start[1]) + "</b></div>" +
    '<div class="ps-meters">' +
    meter("⚡", "Energy", s.stats.energy, "ps-bar-energy") +
    meter("\u{1F623}", "Stress", shownStat("sanity", s.stats.sanity), "ps-bar-sanity", s.stats.sanity < 25) +
    meter("❤️", "Health", s.stats.health, "ps-bar-health") +
    "</div>" +
    '<div class="ps-score"><span title="First-author papers' + (pending ? " (" + pending + " under review)" : "") + '">\u{1F4C4} <b>' + firstAuthorPubs(G) + "</b>" + (pending ? "<i>+" + pending + "</i>" : "") + "</span>" +
    '<span title="Citations">✦ <b>' + totalCitations(G) + "</b></span></div>" +
    '<div class="ps-hud-btns"><button class="ps-icon-btn" data-action="achievements" title="Achievements" aria-label="Achievements">\u{1F3C6}</button>' +
    '<button class="ps-icon-btn" data-action="leave" title="Leave the PhD" aria-label="Leave the PhD">\u{1F6AA}</button>' +
    '<button class="ps-icon-btn" data-action="title" title="Menu" aria-label="Menu">☰</button></div>' +
    "</header>";
}

// ---- Scene: this turn's choices --------------------------------------------------------------

const ORDER = ["deadline", "opportunity", "project", "milestone", "core"];
export function orderedActions(plan) {
  const out = [];
  ORDER.forEach(function (k) { plan.actions.forEach(function (a) { if (a.kind === k) out.push(a); }); });
  return out;
}

function tileHtml(G, a, n) {
  return '<button class="ps-tile ps-tile-' + a.kind + '" data-action="do" data-id="' + esc(a.id) + '">' +
    '<span class="ps-tile-icon" aria-hidden="true">' + actionIcon(G, a) + "</span>" +
    '<span class="ps-tile-body"><span class="ps-tile-label">' + rich(a.label) + "</span>" +
    (a.desc ? '<span class="ps-tile-desc">' + esc(a.desc) + "</span>" : "") +
    arrowsHtml(a.arrows) + "</span>" +
    (n <= 9 ? '<span class="ps-tile-key" aria-hidden="true">' + n + "</span>" : "") + "</button>";
}

// Last turn in one strip: bar changes and the one or two things worth knowing.
function recapHtml(G, report) {
  if (!report) return "";
  const name = { energy: "Energy", sanity: "Stress", health: "Health" };
  const deltas = report.deltas.filter(function (d) { return name[d.stat]; }).map(function (d) {
    const diff = Math.round(shownStat(d.stat, d.to) - shownStat(d.stat, d.from));
    if (!diff) return "";
    return '<span class="ps-delta ' + (d.to > d.from ? "ps-delta-good" : "ps-delta-bad") + '">' + name[d.stat] + " " + (diff > 0 ? "+" : "−") + Math.abs(diff) + "</span>";
  }).join("");
  // Project changes show on their trackers in the tray, not here.
  const items = [];
  report.news.forEach(function (e) { if (e.kind === "good" || e.kind === "bad") items.push({ cls: e.kind, text: e.text }); });
  // a quiet turn still gets its one-liner
  const flavor = report.news.find(function (e) { return e.kind === "flavor"; });
  if (!items.length && flavor) items.push({ cls: "flavor", text: flavor.text });
  return '<div class="ps-recap">' + deltas + items.slice(0, 2).map(function (it) {
    return '<span class="ps-recap-item ps-recap-' + it.cls + '" title="' + esc(it.text) + '">' + rich(it.text) + "</span>";
  }).join("") + "</div>";
}

function planHtml(G, ui) {
  const opts = orderedActions(ui.plan);
  // Starting a project is an action, so it sits with the turn's choices (it doesn't use the turn).
  const canNew = ui.plan.canStartProject && !ui.modal;
  return '<div class="ps-plan ps-enter">' + recapHtml(G, ui.report) +
    '<div class="ps-scene-head"><h2 class="ps-scene-title">' + (ui.plan.internship ? "Internship weeks" : ui.plan.onLeave ? "On leave" : "Your next two weeks") + "</h2>" +
    (G.state.turn <= 1 ? '<span class="ps-scene-hint">Pick one. Keep Energy up, Stress down, Health up.</span>' : "") +
    (canNew ? '<button class="ps-btn ps-btn-sm ps-newproj" data-action="new-project" title="Doesn’t use the turn. Adds Stress.">+ New project ' +
      arrowsHtml([{ stat: "sanity", dir: "down", strength: ui.plan.newProjectStress >= 10 ? 2 : 1 }]) + "</button>" : "") + "</div>" +
    '<div class="ps-tiles">' + opts.map(function (a, i) { return tileHtml(G, a, i + 1); }).join("") + "</div>" + sideHtml(ui) + "</div>";
}

// An optional evening or weekend pick that goes with whichever focus you choose.
function sideHtml(ui) {
  const side = (ui.plan && ui.plan.side) || [];
  if (!side.length) return "";
  return '<div class="ps-side"><span class="ps-side-label">This weekend, if you like:</span>' + side.map(function (o) {
    const on = ui.sidePick === o.id;
    return '<button class="ps-side-pick' + (on ? " ps-side-on" : "") + '" data-action="side" data-id="' + esc(o.id) + '" aria-pressed="' + on + '" title="' + esc(o.desc || "") + '">' +
      (on ? "\u2713 " : "") + esc(o.label) + " " + arrowsHtml(o.arrows) + "</button>";
  }).join("") + "</div>";
}

// ---- Scene: a project up close (open by clicking its tracker) ---------------------------------

function inspectHtml(G, p) {
  const s = G.state;
  const info = stageInfo(G, p);
  const stages = PROJECT_TYPES[p.type].stages;
  let targetCtl = "";
  if (!(p.target && (p.target.rrPaper || p.target.journalPaper))) {
    targetCtl = '<label class="ps-field">Aim for <select class="ps-select" data-action="target" data-id="' + esc(p.id) + '">' +
      (p.target ? "" : '<option value="" selected disabled>Choose a venue</option>') +
      venuesFor(G, p, { includeJournals: true }).map(function (v) {
        return '<option value="' + esc(v.id) + '"' + (p.target && p.target.venueId === v.id ? " selected" : "") + ">" + esc(v.short || v.name) + " (" + esc(v.tier) + ")</option>";
      }).join("") + "</select></label>";
  }
  const when = p.target && p.target.turn !== null && p.target.turn !== undefined ? (p.target.rrPaper ? "Revision due in " : deadlineLabel(G, p) + " deadline in ") + plural(Math.max(0, p.target.turn - s.turn) * WEEKS_PER_TURN, "week") : "";
  return '<div class="ps-inspect ps-enter"><div class="ps-card-kicker">' + KIND_ICON[p.type] + " " + esc(PROJECT_TYPES[p.type].label) + " · " + esc(FIELD_LABELS[fieldOf(p)]) + "</div>" +
    "<h3>" + esc(p.title) + "</h3>" +
    '<ol class="ps-path">' + stages.map(function (st, i) {
      const cls = p.revise || i < p.stageIdx || (p.ready && i === p.stageIdx) ? "ps-path-done" : i === p.stageIdx ? (st.kind === "wait" ? "ps-path-wait" : "ps-path-now") : "";
      return '<li class="' + cls + '">' + esc(STAGE_LABELS[st.id]) + (st.kind === "wait" ? " ⏳" : "") + "</li>";
    }).join("") + (p.revise ? '<li class="' + (p.ready ? "ps-path-done" : "ps-path-now") + '">Revise</li>' : "") + "</ol>" +
    historyHtml(G, p) +
    '<p class="ps-inspect-state">' + esc(info.ready ? "Ready to submit." : info.label + ": " + info.hint + "." + (info.stuck ? " " + plural(info.stuck, "try") + " so far." : "")) + (when ? " " + esc(when) + "." : "") + "</p>" +
    '<div class="ps-inspect-ctl">' + targetCtl + '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="shelve" data-id="' + esc(p.id) + '">Shelve</button></div>' +
    '<div class="ps-foot"><button class="ps-btn ps-btn-primary" data-action="close-inspect">Back</button></div></div>';
}

// Every submission of this project so far, newest first.
function historyHtml(G, p) {
  const OUT = { rejected: "rejected", accepted: "accepted", under_review: "under review", revise_resubmit: "revise and resubmit" };
  const subs = G.state.papers.filter(function (x) { return x.projectId === p.id && x.firstAuthor; }).reverse();
  if (!subs.length) return "";
  return '<ul class="ps-history">' + subs.map(function (x) {
    const scores = x.reviews ? " (" + x.reviews.map(function (r) { return r.score; }).join(", ") + ")" : "";
    return '<li class="ps-history-' + esc(x.status) + '">' + esc(x.venueName) + ": " + esc((x.deskReject ? "desk " : "") + (OUT[x.status] || x.status)) + esc(scores) + "</li>";
  }).join("") + "</ul>";
}

// ---- Tray: project trackers and what's affecting you ------------------------------------------

function trackerHtml(G, p, locked, moved) {
  const s = G.state;
  const info = stageInfo(G, p);
  const base = PROJECT_TYPES[p.type].stages;
  // A rejected paper keeps its finished stages and gets one more: Revise.
  const stages = p.revise ? base.concat([{ id: "revise", kind: "work" }]) : base;
  const idx = p.revise ? base.length : p.stageIdx;
  const dots = stages.map(function (st, i) {
    const cls = i < idx || (p.ready && i === idx) ? "ps-dot-done" : i === idx ? (st.kind === "wait" ? "ps-dot-wait" : "ps-dot-now") : "";
    return '<i class="' + cls + '" title="' + esc(STAGE_LABELS[st.id] || st.id) + '"></i>';
  }).join("");
  const due = p.target && p.target.turn !== null && p.target.turn !== undefined ? (p.target.rrPaper ? "R&R" : deadlineLabel(G, p)) + " " + weeksShort(p.target.turn - s.turn) : "";
  const tries = p.revise && p.submissions ? " · try " + (p.submissions + 1) : "";
  const ready = p.refineTurns ? "Refined ✨" + (p.refineTurns > 1 ? "×" + p.refineTurns : "") : "Ready ✨";
  const state = (info.ready ? ready : info.wait ? info.label + " ⏳" : info.label) + tries;
  return '<button class="ps-tracker' + (info.ready ? " ps-tracker-ready" : "") + (moved ? " ps-tracker-moved" : "") + '" data-action="inspect" data-id="' + esc(p.id) + '"' + (locked ? " disabled" : "") +
    ' title="' + esc(p.title + " — " + (info.ready ? "ready to submit" : info.label + ", " + info.hint)) + '">' +
    '<span class="ps-tracker-name"><span aria-hidden="true">' + KIND_ICON[p.type] + "</span> " + esc(p.short) + "</span>" +
    '<span class="ps-dots" aria-label="Stage ' + info.n + " of " + info.of + '">' + dots + "</span>" +
    '<span class="ps-tracker-foot"><span>' + esc(state) + "</span>" + (due ? "<span>" + esc(due) + "</span>" : "") + "</span></button>";
}

// A submitted paper waits in the tray like a letter in the mail: the venue, and a bar that fills
// until the decision.
function reviewTrackerHtml(G, p, moved) {
  const s = G.state;
  const pp = s.papers.find(function (x) { return x.id === p.paperId; });
  if (!pp) return "";
  const total = Math.max(1, pp.decisionTurn - pp.submittedTurn);
  const pct = Math.round(100 * Math.min(1, Math.max(0, (s.turn - pp.submittedTurn) / total)));
  const left = pp.decisionTurn - s.turn;
  const state = pp.reviews ? "Reviews: " + pp.reviews.map(function (r) { return r.score; }).join(" ") : pp.round > 1 ? "Revision sent" : "Under review";
  return '<div class="ps-tracker ps-tracker-review' + (moved ? " ps-tracker-moved" : "") + '" title="' + esc(p.title + " — " + pp.venueName + ", decision in " + weeksShort(left)) + '">' +
    '<span class="ps-tracker-name"><span aria-hidden="true">\u{1F4E8}</span> ' + esc(p.short) + "</span>" +
    '<span class="ps-mail"><span class="ps-stamp">' + esc(pp.venueName) + '</span><span class="ps-wait" aria-hidden="true"><i style="width:' + pct + '%"></i></span></span>' +
    '<span class="ps-tracker-foot"><span>' + esc(state) + "</span><span>" + (left > 0 ? "decision " + weeksShort(left) : "decision now") + "</span></span></div>";
}

function statusChips(G) {
  const s = G.state;
  const D = G.D;
  const chips = [];
  if (s.advisor) chips.push('<span class="ps-chip ps-chip-adv" title="' + esc(s.advisor.label + ": " + s.advisor.tagline) + '">\u{1F9D1}‍\u{1F3EB} Prof. ' + esc(s.advisor.surname) + "</span>");
  const PREP = { quals_prep: "Quals", proposal_prep: "Proposal", defense_prep: "Defense" };
  const prepTip = {};
  s.statuses.forEach(function (st) {
    const def = D.statusById[st.id];
    if (!def) return;
    // prep shows on the milestone's own countdown chip instead
    if (PREP[st.id]) { prepTip[PREP[st.id]] = def.desc; return; }
    const timed = ["coursework", "ta", "fellowship"].indexOf(st.id) < 0 && st.turns < 20;
    chips.push('<span class="ps-chip" title="' + esc(def.desc) + '">' + (STATUS_ICON[st.id] || "•") + " " + esc(def.name) + (timed ? " " + weeksShort(st.turns) : "") + "</span>");
  });
  const m = s.milestones;
  const qy = m.quals === "failed_once" ? m.qualsYear + 1 : m.qualsYear;
  const next = [];
  if (m.quals !== "passed" && s.advisor) next.push(["Quals", absTurn(qy, G.D.config.quals_turn || 18)]);
  if (m.proposalAt && m.proposal === "pending") next.push(["Proposal", m.proposalAt]);
  if (m.defenseAt) next.push(["Defense", m.defenseAt]);
  // After the proposal, a countdown to when defense prep can start.
  const opens = !m.defensePrepStart ? defenseOpensAt(G) : null;
  if (opens !== null && opens > s.turn) chips.push('<span class="ps-chip" title="Defense prep can start a year after the proposal.">\u{1F393} Defense opens in ' + weeksShort(opens - s.turn) + "</span>");
  next.filter(function (x) { return x[1] >= s.turn && x[1] - s.turn <= 8; }).forEach(function (x) {
    const odds = x[0] === "Quals" ? " \u00b7 odds " + chanceWord(qualsPassChance(G, 0)) : "";
    chips.push('<span class="ps-chip ps-chip-soon"' + (prepTip[x[0]] ? ' title="' + esc(prepTip[x[0]]) + '"' : "") + ">\u{1F393} " + x[0] + " " + weeksShort(x[1] - s.turn) + odds + "</span>");
  });
  return chips.join("");
}

// PhD 101 pointers from senior labmates and events: a quiet line at the bottom of the window.
function tipShelfHtml(G) {
  const s = G.state;
  const recent = (s.tipShelf || []).filter(function (t) { return s.turn - t.turn <= 6; }).slice(0, 2);
  if (!recent.length) return "";
  return '<footer class="ps-tipshelf">' + recent.map(function (t) {
    return '<a class="ps-tip" href="' + esc(t.url) + '" target="_blank" rel="noopener" title="' + esc(t.note || "") + '">' +
      '<span class="ps-tip-badge">\u{1F4D6} PhD 101</span><b>' + esc(t.title) + "</b>" +
      (t.note ? '<span class="ps-tip-note">' + rich(t.note) + "</span>" : "") + '<span aria-hidden="true">\u2192</span></a>';
  }).join("") + "</footer>";
}

// Every achievement: the ones you have, and the rest (secret ones stay hidden).
function achievementsHtml(G) {
  const all = G.D.achievements || [];
  const got = (G.meta && G.meta.achievements) || {};
  const run = G.state.runAchievements || {};
  const list = all.slice().sort(function (a, b) { return (got[b.id] ? 1 : 0) - (got[a.id] ? 1 : 0); });
  return '<div class="ps-overlay ps-overlay-update"><div class="ps-card ps-dialog ps-rise ps-rarity-system ps-ach-panel" role="dialog" aria-modal="true" aria-labelledby="ps-ach-title">' +
    '<div class="ps-spread"><h3 id="ps-ach-title">\u{1F3C6} Achievements \u00b7 ' + Object.keys(got).length + " / " + all.length + "</h3>" +
    '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="close-panel">Close</button></div>' +
    '<ul class="ps-ach-list">' + list.map(function (a) {
      const have = !!got[a.id];
      const hidden = !have && a.secret;
      return '<li class="' + (have ? "ps-ach-have" : "ps-ach-locked") + '"><span class="ps-ach-badge" aria-hidden="true">' + (have ? "\u{1F3C6}" : "\u{1F512}") + "</span>" +
        "<span><b>" + esc(hidden ? "Secret achievement" : a.name) + (run[a.id] ? ' <span class="ps-tagchip">this run</span>' : "") + "</b>" +
        '<span class="ps-ach-desc">' + esc(hidden ? "Keep playing to find it." : a.desc || "") + "</span></span></li>";
    }).join("") + "</ul></div></div>";
}

// The progress band under the top strip: where each project stands, and what's affecting you.
// It's status, not a choice, so it hangs off the dashboard rather than sitting with the tiles.
function bandHtml(G, ui) {
  const s = G.state;
  const active = s.projects.filter(function (p) { return p.status === "active"; });
  const inReview = s.projects.filter(function (p) { return p.status === "submitted"; });
  // Trackers that changed last turn get a short glow (only on the turn's planning screen).
  const moved = {};
  if (ui.report && ui.plan) ui.report.projects.forEach(function (x) { if (x.from && x.id) moved[x.id] = true; });
  const chips = statusChips(G);
  const trackers = active.map(function (p) { return trackerHtml(G, p, !!ui.modal, moved[p.id]); }).join("") +
    inReview.map(function (p) { return reviewTrackerHtml(G, p, moved[p.id]); }).join("");
  return '<section class="ps-band" aria-label="Your progress">' +
    (trackers ? '<div class="ps-trackers">' + trackers + "</div>" : '<span class="ps-tray-empty">No projects yet.</span>') +
    (chips ? '<div class="ps-chips">' + chips + "</div>" : "") + "</section>";
}

// ---- The whole screen -------------------------------------------------------------------------

// ---- Pop-ups: whatever comes up during the turn, over the game ---------------------------------

// Where you are in the turn: the dates, the focus you picked, and the cards so far.
function turnStripHtml(G, ui) {
  const s = G.state;
  const planned = s.plan && s.stage !== "start_items" && s.stage !== "turn_start" && s.stage !== "plan";
  const focus = planned ? actionIcon(G, { id: s.plan.action, kind: s.plan.action.indexOf("opp:") === 0 ? "opportunity" : "" }) + " " + s.plan.label : "Start of the turn";
  const trail = ui.trail && ui.trail.turn === s.turn ? ui.trail.items : [];
  const dots = trail.map(function (it, i) {
    return '<i class="' + (i < trail.length - 1 ? "ps-trail-done" : "ps-trail-now") + (it.event ? " ps-trail-event" : "") + '" title="' + esc(it.title) + '"></i>';
  }).join("");
  return '<div class="ps-turnstrip"><span class="ps-turnstrip-date">\u{1F4C5} ' + esc(turnDates(s.turn)) + "</span>" +
    '<span class="ps-turnstrip-focus">' + (planned ? "This turn: " : "") + "<b>" + rich(focus) + "</b></span>" +
    (dots ? '<span class="ps-trail" aria-label="Card ' + trail.length + ' this turn">' + dots + "</span>" : "") + "</div>";
}

function popupHtml(G, ui, promptInner, promptCls) {
  const p = ui.modal && ui.modal.prompt;
  const isEvent = p && p.type === "event";
  const party = isAcceptance(p);
  const anim = ui.modal && ui.modal.fresh && !ui.modal.result ? (isEvent || party ? " ps-pop" : " ps-rise") : "";
  return '<div class="ps-overlay ' + (isEvent ? "ps-overlay-event ps-overlay-" + esc(p.rarity || "common") : party ? "ps-overlay-update ps-overlay-celebrate" : "ps-overlay-update") + '">' +
    turnStripHtml(G, ui) +
    '<div class="ps-card ps-dialog' + anim + " " + (promptCls || "") + '" role="dialog" aria-modal="true" aria-labelledby="ps-dialog-title">' + promptInner + "</div></div>";
}

export function gameHtml(G, ui, promptInner, promptCls) {
  let scene;
  if (promptInner) scene = ui.plan ? planHtml(G, ui) : "";
  else if (ui.inspect && G.state.projects.some(function (p) { return p.id === ui.inspect && p.status === "active"; })) scene = inspectHtml(G, G.state.projects.find(function (p) { return p.id === ui.inspect; }));
  else scene = ui.plan ? planHtml(G, ui) : "";
  return '<div class="ps-game">' + hudHtml(G) + bandHtml(G, ui) + '<main class="ps-scene"' + (promptInner ? ' aria-hidden="true"' : "") + ">" + scene + "</main>" + tipShelfHtml(G) +
    (promptInner ? popupHtml(G, ui, promptInner, promptCls) : ui.panel === "ach" ? achievementsHtml(G) : "") + "</div>";
}
