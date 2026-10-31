// The game screen: a compact window that sits inside the page, like the original game's box.
// A top strip (date, bars, score) with a progress band under it (project trackers and what's
// affecting you), a scene in the middle (this turn's choices, or whatever is happening), and a
// quiet footer with PhD 101 pointers.
import { esc, rich, bar, arrowsHtml, shownStat, fullButtonHtml } from "./common.js";
import {
  yearOf, turnDates, turnStartLabel, absTurn, WEEKS_PER_TURN, PROJECT_TYPES, STAGE_LABELS, FIELD_LABELS, fieldOf, stageInfo,
  deadlineLabel, venuesFor, totalCitations, firstAuthorPubs, qualsPassChance, chanceWord, defenseOpensAt
} from "../engine/index.js";
import { isAcceptance } from "./prompts.js";
import { t, T_ } from "../engine/i18n.js";
import { tripBarHtml } from "./trip.js";

const KIND_ICON = { empirical: "\u{1F9EA}", study: "\u{1F5E3}️", system: "\u{1F6E0}️", dataset: "\u{1F5C2}️", position: "\u{1F9ED}" };
const TIER = { top: T_("top"), mid: T_("mid"), workshop: T_("workshop"), journal: T_("journal") };
const STATUS_ICON = {
  coursework: "\u{1F4D8}", ta: "\u{1F34E}", fellowship: "\u{1F396}️", sick: "\u{1F912}", burnout: "\u{1FAAB}", deadline_mode: "⏰",
  post_rejection_blues: "\u{1F327}️", jet_lagged: "\u{1F634}", in_the_zone: "✨", in_love: "\u{1F496}", on_leave: "\u{1F3D6}️",
  on_internship: "\u{1F4BC}", quals_prep: "\u{1F4DA}", proposal_prep: "\u{1F3A4}", defense_prep: "\u{1F393}", job_market: "\u{1F4BC}",
  at_conference: "✈️", injured: "\u{1FA79}"
};

function weeksShort(turns) {
  return turns <= 0 ? t("now") : t("{n}w", { n: turns * WEEKS_PER_TURN });
}

function actionIcon(G, a) {
  if (a.kind === "opportunity") return "\u{1F39F}️";
  if (a.id.indexOf("crunch:") === 0) return "\u{1F525}";
  if (a.id.indexOf("refine:") === 0) return "✨";
  if (a.id.indexOf("leave:") === 0) return ((G.D.leaveById || {})[a.id.slice(6)] || {}).icon || "\u{1F33F}";
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

function hudHtml(G, ui) {
  const s = G.state;
  const pending = s.papers.filter(function (p) { return p.status === "under_review" || p.status === "revise_resubmit"; }).length;
  return '<header class="ps-hud">' +
    '<div class="ps-cal-badge" title="' + esc(turnDates(s.turn)) + '"><span>' + esc(t("Year {n}", { n: yearOf(s.turn) })) + "</span><b>" + esc(turnStartLabel(s.turn)) + "</b></div>" +
    '<div class="ps-meters">' +
    meter("⚡", t("Energy"), s.stats.energy, "ps-bar-energy") +
    meter("\u{1F623}", t("Stress"), shownStat("sanity", s.stats.sanity), "ps-bar-sanity", s.stats.sanity < 25) +
    meter("❤️", t("Health"), s.stats.health, "ps-bar-health") +
    "</div>" +
    '<div class="ps-score"><span title="' + esc(pending ? t("First-author papers ({n} under review)", { n: pending }) : t("First-author papers")) + '">\u{1F4C4} <b>' + firstAuthorPubs(G) + "</b>" + (pending ? "<i>+" + pending + "</i>" : "") + "</span>" +
    '<span title="' + esc(t("Citations")) + '">✦ <b>' + totalCitations(G) + "</b></span></div>" +
    '<div class="ps-hud-btns"><button class="ps-icon-btn" data-action="achievements" title="' + esc(t("Achievements")) + '" aria-label="' + esc(t("Achievements")) + '">\u{1F3C6}</button>' +
    '<button class="ps-icon-btn" data-action="leave" title="' + esc(t("Leave the PhD")) + '" aria-label="' + esc(t("Leave the PhD")) + '">\u{1F6AA}</button>' +
    (ui && !ui.standalone ? fullButtonHtml(ui.full) : "") +
    '<button class="ps-icon-btn" data-action="title" title="' + esc(t("Menu")) + '" aria-label="' + esc(t("Menu")) + '">☰</button></div>' +
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
  const name = { energy: t("Energy"), sanity: t("Stress"), health: t("Health") };
  const deltas = report.deltas.filter(function (d) { return name[d.stat]; }).map(function (d) {
    const diff = Math.round(shownStat(d.stat, d.to) - shownStat(d.stat, d.from));
    if (!diff) return "";
    return '<span class="ps-delta ' + (d.to > d.from ? "ps-delta-good" : "ps-delta-bad") + '">' + esc(name[d.stat]) + " " + (diff > 0 ? "+" : "−") + Math.abs(diff) + "</span>";
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

// Nothing on your desk to work on: every project is out for review, waiting, or there are none.
function nothingInProgress(plan) {
  return !plan.actions.some(function (a) { return a.id.indexOf("p:") === 0; });
}

function idleHintHtml(G, ui) {
  if (!ui.plan.canStartProject || !nothingInProgress(ui.plan)) return "";
  const inReview = G.state.projects.some(function (p) { return p.status === "submitted"; });
  return '<p class="ps-idle-hint"><span aria-hidden="true">\u2191</span> ' +
    esc(inReview ? t("Your paper is out for review and nothing else is in progress. Start something new while you wait?") : t("Nothing is in progress right now. Start a new project?")) + "</p>";
}

function planHtml(G, ui) {
  const opts = orderedActions(ui.plan);
  return '<div class="ps-plan ps-enter">' + recapHtml(G, ui.report) + idleHintHtml(G, ui) +
    '<div class="ps-scene-head"><h2 class="ps-scene-title">' + esc(ui.plan.internship ? t("Internship weeks") : ui.plan.onLeave ? t("On leave") : t("Your next two weeks")) + "</h2>" +
    (G.state.turn <= 1 ? '<span class="ps-scene-hint">' + esc(t("Pick one. Keep Energy up, Stress down, Health up.")) + "</span>" : "") + "</div>" +
    sideHtml(ui) + '<div class="ps-tiles">' + opts.map(function (a, i) { return tileHtml(G, a, i + 1); }).join("") + "</div></div>";
}

// An optional evening or weekend pick that goes with whichever focus you choose. It sits above the
// choices so players notice it (playtest feedback, 2026-10-22), and says it doesn't replace them.
function sideHtml(ui) {
  const side = (ui.plan && ui.plan.side) || [];
  if (!side.length) return "";
  return '<div class="ps-side"><span class="ps-side-label">' + esc(t("This weekend, if you like:")) +
    ' <span class="ps-side-note">' + esc(t("(optional, on top of your pick below)")) + "</span></span>" + side.map(function (o) {
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
    const pick = '<select class="ps-select" data-action="target" data-id="' + esc(p.id) + '">' +
      (p.target ? "" : '<option value="" selected disabled>' + esc(t("Choose a venue")) + "</option>") +
      venuesFor(G, p, { includeJournals: true }).map(function (v) {
        return '<option value="' + esc(v.id) + '"' + (p.target && p.target.venueId === v.id ? " selected" : "") + ">" + esc(v.short || v.name) + " (" + esc(TIER[v.tier] ? t(TIER[v.tier]) : v.tier) + ")</option>";
      }).join("") + "</select>";
    targetCtl = '<label class="ps-field">' + t("Aim for {venue}", { venue: pick }) + "</label>";
  }
  // Always an even number of weeks (two per turn), so there's no singular.
  let when = "";
  if (p.target && p.target.turn !== null && p.target.turn !== undefined) {
    const weeks = Math.max(0, p.target.turn - s.turn) * WEEKS_PER_TURN;
    when = p.target.rrPaper ? t("Revision due in {n} weeks.", { n: weeks }) : t("{deadline} deadline in {n} weeks.", { deadline: deadlineLabel(G, p), n: weeks });
  }
  const stuck = info.stuck ? " " + (info.stuck === 1 ? t("1 try so far.") : t("{n} tries so far.", { n: info.stuck })) : "";
  return '<div class="ps-inspect ps-enter"><div class="ps-card-kicker">' + KIND_ICON[p.type] + " " + esc(t(PROJECT_TYPES[p.type].label)) + " · " + esc(t(FIELD_LABELS[fieldOf(p)])) + "</div>" +
    "<h3>" + esc(p.title) + "</h3>" +
    '<ol class="ps-path">' + stages.map(function (st, i) {
      const cls = p.revise || i < p.stageIdx || (p.ready && i === p.stageIdx) ? "ps-path-done" : i === p.stageIdx ? (st.kind === "wait" ? "ps-path-wait" : "ps-path-now") : "";
      return '<li class="' + cls + '">' + esc(t(STAGE_LABELS[st.id])) + (st.kind === "wait" ? " ⏳" : "") + "</li>";
    }).join("") + (p.revise ? '<li class="' + (p.ready ? "ps-path-done" : "ps-path-now") + '">' + esc(t("Revise")) + "</li>" : "") + "</ol>" +
    historyHtml(G, p) +
    '<p class="ps-inspect-state">' + esc(info.ready ? t("Ready to submit.") : t("{stage}: {hint}.", { stage: info.label, hint: info.hint }) + stuck) + (when ? " " + esc(when) : "") + "</p>" +
    '<div class="ps-inspect-ctl">' + targetCtl + '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="shelve" data-id="' + esc(p.id) + '">' + esc(t("Shelve")) + "</button></div>" +
    '<div class="ps-foot"><button class="ps-btn ps-btn-primary" data-action="close-inspect">' + esc(t("Back")) + "</button></div></div>";
}

// Every submission of this project so far, newest first.
function historyHtml(G, p) {
  const OUT = { rejected: t("rejected"), accepted: t("accepted"), under_review: t("under review"), revise_resubmit: t("revise and resubmit") };
  const subs = G.state.papers.filter(function (x) { return x.projectId === p.id && x.firstAuthor; }).reverse();
  if (!subs.length) return "";
  return '<ul class="ps-history">' + subs.map(function (x) {
    const scores = x.reviews ? " (" + x.reviews.map(function (r) { return r.score; }).join(", ") + ")" : "";
    const outcome = x.deskReject && x.status === "rejected" ? t("desk rejected") : OUT[x.status] || x.status;
    return '<li class="ps-history-' + esc(x.status) + '">' + esc(x.venueName) + ": " + esc(outcome) + esc(scores) + "</li>";
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
    return '<i class="' + cls + '" title="' + esc(t(STAGE_LABELS[st.id] || st.id)) + '"></i>';
  }).join("");
  const due = p.target && p.target.turn !== null && p.target.turn !== undefined ? (p.target.rrPaper ? t("R&R") : deadlineLabel(G, p)) + " " + weeksShort(p.target.turn - s.turn) : "";
  const tries = p.revise && p.submissions ? " · " + t("try {n}", { n: p.submissions + 1 }) : "";
  const ready = p.refineTurns ? t("Refined") + " ✨" + (p.refineTurns > 1 ? "×" + p.refineTurns : "") : t("Ready") + " ✨";
  const stage = info.label;
  const state = (info.ready ? ready : info.wait ? stage + " ⏳" : stage) + tries;
  return '<button class="ps-tracker' + (info.ready ? " ps-tracker-ready" : "") + (moved ? " ps-tracker-moved" : "") + '" data-action="inspect" data-id="' + esc(p.id) + '"' + (locked ? " disabled" : "") +
    ' title="' + esc(info.ready ? t("{title} — ready to submit", { title: p.title }) : t("{title} — {stage}, {hint}", { title: p.title, stage: stage, hint: info.hint })) + '">' +
    '<span class="ps-tracker-name"><span aria-hidden="true">' + KIND_ICON[p.type] + "</span> " + esc(p.short) + "</span>" +
    '<span class="ps-dots" aria-label="' + esc(t("Stage {n} of {total}", { n: info.n, total: info.of })) + '">' + dots + "</span>" +
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
  const state = pp.reviews ? t("Reviews: {scores}", { scores: pp.reviews.map(function (r) { return r.score; }).join(" ") }) : pp.round > 1 ? t("Revision sent") : t("Under review");
  return '<div class="ps-tracker ps-tracker-review' + (moved ? " ps-tracker-moved" : "") + '" title="' + esc(t("{title} — {venue}, decision in {when}", { title: p.title, venue: pp.venueName, when: weeksShort(left) })) + '">' +
    '<span class="ps-tracker-name"><span aria-hidden="true">\u{1F4E8}</span> ' + esc(p.short) + "</span>" +
    '<span class="ps-mail"><span class="ps-stamp">' + esc(pp.venueName) + '</span><span class="ps-wait" aria-hidden="true"><i style="width:' + pct + '%"></i></span></span>' +
    '<span class="ps-tracker-foot"><span>' + esc(state) + "</span><span>" + esc(left > 0 ? t("decision {when}", { when: weeksShort(left) }) : t("decision now")) + "</span></span></div>";
}

function statusChips(G) {
  const s = G.state;
  const D = G.D;
  const chips = [];
  if (s.advisor) chips.push('<span class="ps-chip ps-chip-adv" title="' + esc(s.advisor.label + ": " + s.advisor.tagline) + '">\u{1F9D1}‍\u{1F3EB} ' + esc(t("Prof. {name}", { name: s.advisor.surname })) + "</span>");
  // English keys: translated where they're shown.
  const PREP = { quals_prep: T_("Quals"), proposal_prep: T_("Proposal"), defense_prep: T_("Defense") };
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
  if (opens !== null && opens > s.turn) chips.push('<span class="ps-chip" title="' + esc(t("Defense prep can start a year after the proposal.")) + '">\u{1F393} ' + esc(t("Defense opens in {when}", { when: weeksShort(opens - s.turn) })) + "</span>");
  next.filter(function (x) { return x[1] >= s.turn && x[1] - s.turn <= 8; }).forEach(function (x) {
    const odds = x[0] === "Quals" ? " \u00b7 " + t("odds {chance}", { chance: chanceWord(qualsPassChance(G, 0)) }) : "";
    chips.push('<span class="ps-chip ps-chip-soon"' + (prepTip[x[0]] ? ' title="' + esc(prepTip[x[0]]) + '"' : "") + ">\u{1F393} " + esc(t(x[0]) + " " + weeksShort(x[1] - s.turn) + odds) + "</span>");
  });
  return chips.join("");
}

// PhD 101 pointers from senior labmates and events: a quiet line at the bottom of the window.
function tipShelfHtml(G) {
  const s = G.state;
  const recent = (s.tipShelf || []).filter(function (tip) { return s.turn - tip.turn <= 6; }).slice(0, 2);
  if (!recent.length) return "";
  return '<footer class="ps-tipshelf">' + recent.map(function (tip) {
    return '<a class="ps-tip" href="' + esc(tip.url) + '" target="_blank" rel="noopener" title="' + esc(tip.note || "") + '">' +
      '<span class="ps-tip-badge">\u{1F4D6} ' + esc(t("PhD 101")) + "</span><b>" + esc(tip.title) + "</b>" +
      (tip.note ? '<span class="ps-tip-note">' + rich(tip.note) + "</span>" : "") + '<span aria-hidden="true">\u2192</span></a>';
  }).join("") + "</footer>";
}

// Every achievement: the ones you have, and the rest (secret ones stay hidden).
function achievementsHtml(G) {
  const all = G.D.achievements || [];
  const got = (G.meta && G.meta.achievements) || {};
  const run = G.state.runAchievements || {};
  const list = all.slice().sort(function (a, b) { return (got[b.id] ? 1 : 0) - (got[a.id] ? 1 : 0); });
  return '<div class="ps-overlay ps-overlay-update"><div class="ps-card ps-dialog ps-rise ps-rarity-system ps-ach-panel" role="dialog" aria-modal="true" aria-labelledby="ps-ach-title">' +
    '<div class="ps-spread"><h3 id="ps-ach-title">\u{1F3C6} ' + esc(t("Achievements \u00b7 {n} / {total}", { n: Object.keys(got).length, total: all.length })) + "</h3>" +
    '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="close-panel">' + esc(t("Close")) + "</button></div>" +
    '<ul class="ps-ach-list">' + list.map(function (a) {
      const have = !!got[a.id];
      const hidden = !have && a.secret;
      return '<li class="' + (have ? "ps-ach-have" : "ps-ach-locked") + '"><span class="ps-ach-badge" aria-hidden="true">' + (have ? "\u{1F3C6}" : "\u{1F512}") + "</span>" +
        "<span><b>" + esc(hidden ? t("Secret achievement") : a.name) + (run[a.id] ? ' <span class="ps-tagchip">' + esc(t("this run")) + "</span>" : "") + "</b>" +
        '<span class="ps-ach-desc">' + esc(hidden ? t("Keep playing to find it.") : a.desc || "") + "</span></span></li>";
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
    inReview.map(function (p) { return reviewTrackerHtml(G, p, moved[p.id]); }).join("") + newSlotHtml(G, ui);
  return '<section class="ps-band" aria-label="' + esc(t("Your progress")) + '">' +
    (trackers ? '<div class="ps-trackers">' + trackers + "</div>" : '<span class="ps-tray-empty">' + esc(t("No projects yet.")) + "</span>") +
    (chips ? '<div class="ps-chips">' + chips + "</div>" : "") + "</section>";
}

// Starting a project lives with the projects: an open slot after the trackers, while you plan the
// turn (it doesn't use the turn). It lights up when nothing is in progress.
function newSlotHtml(G, ui) {
  if (!ui.plan || !ui.plan.canStartProject) return "";
  const hot = nothingInProgress(ui.plan);
  return '<button class="ps-newslot' + (hot ? " ps-newslot-hot" : "") + '" data-action="new-project"' + (ui.modal ? " disabled" : "") +
    ' title="' + esc(t("Doesn’t use the turn. Adds Stress.")) + '">' +
    '<span class="ps-newslot-name">' + esc(t("+ New project")) + "</span>" +
    '<span class="ps-newslot-foot">' + esc(t("Doesn’t use the turn")) + " " +
    arrowsHtml([{ stat: "sanity", dir: "down", strength: ui.plan.newProjectStress >= 10 ? 2 : 1 }]) + "</span></button>";
}

// ---- The whole screen -------------------------------------------------------------------------

// ---- Pop-ups: whatever comes up during the turn, over the game ---------------------------------

// Where you are in the turn: the dates, the focus you picked, and the cards so far.
function turnStripHtml(G, ui) {
  const s = G.state;
  const planned = s.plan && s.stage !== "start_items" && s.stage !== "turn_start" && s.stage !== "plan";
  const focus = planned ? actionIcon(G, { id: s.plan.action, kind: s.plan.action.indexOf("opp:") === 0 ? "opportunity" : "" }) + " " + s.plan.label : t("Start of the turn");
  const trail = ui.trail && ui.trail.turn === s.turn ? ui.trail.items : [];
  const dots = trail.map(function (it, i) {
    return '<i class="' + (i < trail.length - 1 ? "ps-trail-done" : "ps-trail-now") + (it.event ? " ps-trail-event" : "") + '" title="' + esc(it.title) + '"></i>';
  }).join("");
  return '<div class="ps-turnstrip"><span class="ps-turnstrip-date">\u{1F4C5} ' + esc(turnDates(s.turn)) + "</span>" +
    '<span class="ps-turnstrip-focus">' + (planned ? t("This turn: {focus}", { focus: "<b>" + rich(focus) + "</b>" }) : "<b>" + rich(focus) + "</b>") + "</span>" +
    (dots ? '<span class="ps-trail" aria-label="' + esc(t("Card {n} this turn", { n: trail.length })) + '">' + dots + "</span>" : "") + "</div>";
}

function popupHtml(G, ui, promptInner, promptCls) {
  const p = ui.modal && ui.modal.prompt;
  const isEvent = p && p.type === "event";
  const party = isAcceptance(p);
  const anim = ui.modal && ui.modal.fresh && !ui.modal.result ? (isEvent || party ? " ps-pop" : " ps-rise") : "";
  // Away at a conference for the week (trip.js): your badge and the week instead of the turn strip. The
  // conference card already sits on the week's carpet, so it reads as the way in.
  const trip = !!G.state.trip;
  const carpet = trip || (p && p.type === "sys" && p.sys === "conference");
  return '<div class="ps-overlay ' + (isEvent ? "ps-overlay-event ps-overlay-" + esc(p.rarity || "common") : party ? "ps-overlay-update ps-overlay-celebrate" : "ps-overlay-update") + (carpet ? " ps-overlay-trip" : "") + '">' +
    (trip ? tripBarHtml(G) : turnStripHtml(G, ui)) +
    '<div class="ps-card ps-dialog' + anim + " " + (promptCls || "") + '" role="dialog" aria-modal="true" aria-labelledby="ps-dialog-title">' + promptInner + "</div></div>";
}

export function gameHtml(G, ui, promptInner, promptCls) {
  let scene;
  if (promptInner) scene = ui.plan ? planHtml(G, ui) : "";
  else if (ui.inspect && G.state.projects.some(function (p) { return p.id === ui.inspect && p.status === "active"; })) scene = inspectHtml(G, G.state.projects.find(function (p) { return p.id === ui.inspect; }));
  else scene = ui.plan ? planHtml(G, ui) : "";
  return '<div class="ps-game">' + hudHtml(G, ui) + bandHtml(G, ui) + '<main class="ps-scene"' + (promptInner ? ' aria-hidden="true"' : "") + ">" + scene + "</main>" + tipShelfHtml(G) +
    (promptInner ? popupHtml(G, ui, promptInner, promptCls) : ui.panel === "ach" ? achievementsHtml(G) : "") + "</div>";
}
