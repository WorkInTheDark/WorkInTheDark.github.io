// The game screen: a compact window that sits inside the page, like the original game's box.
// A top strip (date, bars, score), a scene in the middle (this turn's choices, or whatever is
// happening), and a tray of project trackers at the bottom.
import { esc, bar, plural, arrowsHtml, shownStat } from "./common.js";
import {
  yearOf, turnDates, absTurn, WEEKS_PER_TURN, PROJECT_TYPES, STAGE_LABELS, FIELD_LABELS, fieldOf, stageInfo,
  deadlineLabel, venuesFor, totalCitations, firstAuthorPubs
} from "../engine/index.js";

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
  if (a.id.indexOf("p:") === 0 || a.id.indexOf("intern_weekend:") === 0) {
    const p = G.state.projects.find(function (x) { return x.id === a.id.slice(a.id.indexOf(":") + 1); });
    if (p && p.ready) return "✨";
    return p ? KIND_ICON[p.type] : "\u{1F52C}";
  }
  return {
    read: "\u{1F4DA}", recharge: "\u{1F6CC}", intern_all: "\u{1F4BC}", intern_pace: "\u{1F33F}", apply_internship: "\u{1F4EE}",
    apply_fellowship: "\u{1F4DD}", proposal: "\u{1F3A4}", defense: "\u{1F393}", job_market: "\u{1F4BC}"
  }[a.id] || "•";
}

// ---- Top strip --------------------------------------------------------------------------------

function meter(icon, label, value, cls, low) {
  return '<div class="ps-meter" title="' + label + " " + Math.round(value) + '"><span class="ps-meter-icon" aria-hidden="true">' + icon + "</span>" +
    '<span class="ps-sr">' + label + "</span>" + bar(value, cls, low) + "<b>" + Math.round(value) + "</b></div>";
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
    '<div class="ps-hud-btns"><button class="ps-icon-btn" data-action="leave" title="Leave the PhD" aria-label="Leave the PhD">\u{1F6AA}</button>' +
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
    '<span class="ps-tile-body"><span class="ps-tile-label">' + esc(a.label) + "</span>" +
    (a.desc ? '<span class="ps-tile-desc">' + esc(a.desc) + "</span>" : "") +
    arrowsHtml(a.arrows) + "</span>" +
    (n <= 9 ? '<span class="ps-tile-key" aria-hidden="true">' + n + "</span>" : "") + "</button>";
}

// Last turn in one strip: bar changes and the one or two things worth knowing.
function recapHtml(G, report) {
  if (!report) return "";
  const icon = { energy: "⚡", sanity: "\u{1F623}", health: "❤️" };
  const deltas = report.deltas.filter(function (d) { return icon[d.stat]; }).map(function (d) {
    const diff = Math.round(shownStat(d.stat, d.to) - shownStat(d.stat, d.from));
    if (!diff) return "";
    return '<span class="ps-delta ' + (d.to > d.from ? "ps-delta-good" : "ps-delta-bad") + '">' + icon[d.stat] + (diff > 0 ? "+" : "−") + Math.abs(diff) + "</span>";
  }).join("");
  const items = [];
  report.projects.forEach(function (p) {
    if (p.from === "new") items.push({ cls: "stage", text: "New: " + p.short });
    else if (p.from) items.push({ cls: "stage", text: p.short + " → " + p.to });
  });
  report.news.forEach(function (e) { if (e.kind === "good" || e.kind === "bad") items.push({ cls: e.kind, text: e.text }); });
  // a quiet turn still gets its one-liner
  const flavor = report.news.find(function (e) { return e.kind === "flavor"; });
  if (!items.length && flavor) items.push({ cls: "flavor", text: flavor.text });
  const tip = report.news.find(function (e) { return e.kind === "tip" && e.url; });
  return '<div class="ps-recap">' + deltas + items.slice(0, 2).map(function (it) {
    return '<span class="ps-recap-item ps-recap-' + it.cls + '" title="' + esc(it.text) + '">' + esc(it.text) + "</span>";
  }).join("") + "</div>" +
    (tip ? '<p class="ps-recap-tip">\u{1F4AC} ' + esc(tip.text) + ' <a href="' + esc(tip.url) + '" target="_blank" rel="noopener">PhD 101: ' + esc(tip.title) + " →</a></p>" : "");
}

function planHtml(G, ui) {
  const opts = orderedActions(ui.plan);
  return '<div class="ps-plan ps-enter">' + recapHtml(G, ui.report) +
    '<div class="ps-scene-head"><h2 class="ps-scene-title">' + (ui.plan.internship ? "Internship weeks" : ui.plan.onLeave ? "On leave" : "Your next two weeks") + "</h2>" +
    (G.state.turn <= 1 ? '<span class="ps-scene-hint">Pick one. Keep ⚡ up, \u{1F623} down, ❤️ up.</span>' : "") + "</div>" +
    '<div class="ps-tiles">' + opts.map(function (a, i) { return tileHtml(G, a, i + 1); }).join("") + "</div></div>";
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
    '<ol class="ps-path">' + (p.revise ? '<li class="ps-path-now">Revising</li>' : stages.map(function (st, i) {
      const cls = i < p.stageIdx || (p.ready && i === p.stageIdx) ? "ps-path-done" : i === p.stageIdx ? (st.kind === "wait" ? "ps-path-wait" : "ps-path-now") : "";
      return '<li class="' + cls + '">' + esc(STAGE_LABELS[st.id]) + (st.kind === "wait" ? " ⏳" : "") + "</li>";
    }).join("")) + "</ol>" +
    '<p class="ps-inspect-state">' + esc(info.ready ? "Ready to submit." : info.label + ": " + info.hint + "." + (info.stuck ? " " + plural(info.stuck, "try") + " so far." : "")) + (when ? " " + esc(when) + "." : "") + "</p>" +
    '<div class="ps-inspect-ctl">' + targetCtl + '<button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="shelve" data-id="' + esc(p.id) + '">Shelve</button></div>' +
    '<div class="ps-foot"><button class="ps-btn ps-btn-primary" data-action="close-inspect">Back</button></div></div>';
}

// ---- Tray: project trackers and what's affecting you ------------------------------------------

function trackerHtml(G, p, locked) {
  const s = G.state;
  const info = stageInfo(G, p);
  const stages = p.revise ? [{ id: "revise", kind: "work" }] : PROJECT_TYPES[p.type].stages;
  const idx = p.revise ? 0 : p.stageIdx;
  const dots = stages.map(function (st, i) {
    const cls = i < idx || (p.ready && i === idx) ? "ps-dot-done" : i === idx ? (st.kind === "wait" ? "ps-dot-wait" : "ps-dot-now") : "";
    return '<i class="' + cls + '" title="' + esc(STAGE_LABELS[st.id] || st.id) + '"></i>';
  }).join("");
  const due = p.target && p.target.turn !== null && p.target.turn !== undefined ? (p.target.rrPaper ? "R&R" : deadlineLabel(G, p)) + " " + weeksShort(p.target.turn - s.turn) : "";
  const state = info.ready ? "Ready ✨" : info.wait ? info.label + " ⏳" : info.label;
  return '<button class="ps-tracker' + (info.ready ? " ps-tracker-ready" : "") + '" data-action="inspect" data-id="' + esc(p.id) + '"' + (locked ? " disabled" : "") +
    ' title="' + esc(p.title + " — " + (info.ready ? "ready to submit" : info.label + ", " + info.hint)) + '">' +
    '<span class="ps-tracker-name"><span aria-hidden="true">' + KIND_ICON[p.type] + "</span> " + esc(p.short) + "</span>" +
    '<span class="ps-dots" aria-label="Stage ' + info.n + " of " + info.of + '">' + dots + "</span>" +
    '<span class="ps-tracker-foot"><span>' + esc(state) + "</span>" + (due ? "<span>" + esc(due) + "</span>" : "") + "</span></button>";
}

function statusChips(G) {
  const s = G.state;
  const D = G.D;
  const chips = [];
  if (s.advisor) chips.push('<span class="ps-chip ps-chip-adv" title="' + esc("Prof. " + s.advisor.surname + ": " + s.advisor.tagline) + '">\u{1F9D1}‍\u{1F3EB} ' + esc(s.advisor.nick.replace(/^the /, "")) + "</span>");
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
  next.filter(function (x) { return x[1] >= s.turn && x[1] - s.turn <= 8; }).forEach(function (x) {
    chips.push('<span class="ps-chip ps-chip-soon"' + (prepTip[x[0]] ? ' title="' + esc(prepTip[x[0]]) + '"' : "") + ">\u{1F393} " + x[0] + " " + weeksShort(x[1] - s.turn) + "</span>");
  });
  const under = s.papers.filter(function (p) { return p.status === "under_review"; });
  if (under.length) {
    chips.push('<span class="ps-chip" title="' + esc(under.map(function (p) { return p.venueName + ": " + p.short + " (decision in " + weeksShort(p.decisionTurn - s.turn) + ")"; }).join("\n")) + '">\u{1F4E8} ' + under.length + " under review</span>");
  }
  return chips.join("");
}

function trayHtml(G, ui) {
  const s = G.state;
  const active = s.projects.filter(function (p) { return p.status === "active"; });
  const canNew = ui.plan && ui.plan.canStartProject && !ui.modal;
  return '<footer class="ps-tray">' +
    '<div class="ps-chips">' + statusChips(G) + "</div>" +
    '<div class="ps-trackers">' + active.map(function (p) { return trackerHtml(G, p, !!ui.modal); }).join("") +
    (canNew ? '<button class="ps-tracker ps-tracker-new" data-action="new-project" title="Doesn’t use the turn. Adds Stress.">+ New project ' +
      arrowsHtml([{ stat: "sanity", dir: "down", strength: ui.plan.newProjectStress >= 10 ? 2 : 1 }]) + "</button>" : "") +
    (!active.length && !canNew ? '<span class="ps-tray-empty">No projects yet.</span>' : "") +
    "</div></footer>";
}

// ---- The whole screen -------------------------------------------------------------------------

export function gameHtml(G, ui, promptInner, promptCls) {
  let scene;
  if (promptInner) scene = '<div class="ps-card ps-dialog ps-enter ' + (promptCls || "") + '" role="region" aria-labelledby="ps-dialog-title">' + promptInner + "</div>";
  else if (ui.inspect && G.state.projects.some(function (p) { return p.id === ui.inspect && p.status === "active"; })) scene = inspectHtml(G, G.state.projects.find(function (p) { return p.id === ui.inspect; }));
  else scene = ui.plan ? planHtml(G, ui) : "";
  return '<div class="ps-game">' + hudHtml(G) + '<main class="ps-scene">' + scene + "</main>" + trayHtml(G, ui) + "</div>";
}
