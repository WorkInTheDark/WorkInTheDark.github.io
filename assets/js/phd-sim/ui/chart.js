// The all-time leaderboard as a picture (Arthur, 2026-10-23): every submitted run as a dot, years in the
// PhD across and research score up, colored by how the PhD ended. Hover a dot (or reach it with the
// keyboard) for a box with that run's details, tap a dot to pick it, tap a group to hide or show it, tap
// an ending in the breakdown to pick those runs out. Plain HTML and CSS, no library.
import { esc, papersText, citationsText, yearsText } from "./common.js";
import { t } from "../engine/i18n.js";

const COLORS = ["#3f74d6", "#e0773a", "#8a5ad6", "#2a9d8f", "#8f8a82"];
const MAX_YEARS = 8;

// Ending groups in the order the endings list them (academia, industry, startup, other, leaving), so
// the colors are the same in both languages.
function groups(D) {
  const names = [], byEnding = {};
  D.endings.forEach(function (e) {
    let i = names.indexOf(e.group);
    if (i < 0) { names.push(e.group); i = names.length - 1; }
    byEnding[e.id] = i;
  });
  return { names: names, byEnding: byEnding };
}

// The score axis follows the runs (Arthur, 2026-10-23): it ends at the first round number above the
// best run, so every dot sits where its score is, with a step that gives at most seven grid lines.
const STEPS = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
function scoreAxis(scores) {
  const top = Math.max(10, Math.max.apply(null, scores) * 1.02);
  const step = STEPS.find(function (s) { return top / s <= 7; }) || 2000;
  return { max: Math.ceil(top / step) * step, step: step };
}

function groupOf(g, ending) { return g.byEnding[ending] === undefined ? g.names.length - 1 : g.byEnding[ending]; }

// Where a run's dot sits, in percent of the plot.
function place(r, yMax) {
  return { x: Math.min(MAX_YEARS, Math.max(0, r[1])) / MAX_YEARS * 100, y: Math.min(yMax, Math.max(0, r[2])) / yMax * 100 };
}

// rows: [id, years, score, ending, graduated, papers, citations, player, day, title, h-index]
// (title and h-index came later, so a row may stop at day).
export function chartHtml(app) {
  const d = app.boardData, runs = d.runs;
  if (!runs || !runs.ok) return "";
  if (!runs.rows.length) return '<p class="ps-muted ps-small">' + esc(t("No runs yet.")) + "</p>";
  const D = app.D, g = groups(D), st = app.chart;
  const axis = scoreAxis(runs.rows.map(function (r) { return r[2]; }));
  const yMax = axis.max, step = axis.step;
  const counts = g.names.map(function () { return 0; });
  runs.rows.forEach(function (r) { counts[groupOf(g, r[3])]++; });

  let grid = "";
  for (let v = 0; v <= yMax; v += step) grid += '<i class="ps-chart-grid" style="bottom:' + (100 * v / yMax) + '%"><span>' + v + "</span></i>";
  let xt = "";
  for (let y = 0; y <= MAX_YEARS; y++) xt += '<span style="left:' + (100 * y / MAX_YEARS) + '%">' + y + "</span>";

  const mine = d.myPub;
  // Your runs and the picked run are drawn last, on top.
  const order = runs.rows.slice().sort(function (a, b) {
    const ka = (a[0] === st.sel ? 2 : a[7] === mine ? 1 : 0), kb = (b[0] === st.sel ? 2 : b[7] === mine ? 1 : 0);
    return ka - kb;
  });
  const dots = order.map(function (r) {
    const gi = groupOf(g, r[3]);
    if (st.hidden[gi]) return "";
    const end = D.endingById[r[3]];
    const nick = runs.players[r[7]] || t("Anonymous");
    const at = place(r, yMax);
    const cls = "ps-dot ps-g" + gi + (r[7] === mine ? " ps-dot-mine" : "") + (r[0] === st.sel ? " ps-dot-sel" : "") + (st.ending && st.ending !== r[3] ? " ps-dot-dim" : "");
    const label = nick + " · " + (end ? end.name : r[3]) + " · " + r[2];
    return '<button class="' + cls + '" style="left:' + at.x.toFixed(2) + "%;bottom:" + at.y.toFixed(2) + '%" data-action="chart-dot" data-id="' + esc(r[0]) + '" aria-label="' + esc(label) + '"></button>';
  }).join("");

  const legend = g.names.map(function (name, i) {
    return '<button class="ps-legend-item' + (st.hidden[i] ? " ps-legend-off" : "") + '" data-action="chart-group" data-i="' + i + '" aria-pressed="' + !st.hidden[i] + '">' +
      '<i class="ps-g' + i + '"></i>' + esc(name) + " <small>" + counts[i] + "</small></button>";
  }).join("") + (mine && runs.rows.some(function (r) { return r[7] === mine; }) ? '<span class="ps-legend-item ps-legend-static"><i class="ps-dot-mine-key"></i>' + esc(t("Your runs")) + "</span>" : "");

  return '<div class="ps-chart" role="group" aria-label="' + esc(t("Each dot is one run. Tap one for details; tap a group below to hide or show it.")) + '">' +
    '<div class="ps-chart-ylabel">' + esc(t("Research score")) + "</div>" +
    '<div class="ps-chart-plot">' + grid + dots + (st.hover ? tipHtml(app, st.hover) : "") + "</div>" +
    '<div class="ps-chart-x">' + xt + "</div>" +
    '<div class="ps-chart-xlabel">' + esc(t("Years")) + "</div></div>" +
    '<div class="ps-legend">' + legend + "</div>" + pickedHtml(app);
}

// The hover box: who played the run under the mouse, how it ended, its title and numbers. It sits above
// the dot, or below it when the dot is high up, and leans inward near the sides so it stays in the chart.
function tipHtml(app, id) {
  const runs = app.boardData.runs, D = app.D, g = groups(D);
  const r = runs.rows.find(function (x) { return x[0] === id; });
  if (!r || app.chart.hidden[groupOf(g, r[3])]) return "";
  const at = place(r, scoreAxis(runs.rows.map(function (x) { return x[2]; })).max);
  const end = D.endingById[r[3]];
  const title = r[9] && (D.titles || []).find(function (ti) { return ti.id === r[9]; });
  const nick = runs.players[r[7]];
  const below = at.y > 45;
  const cls = "ps-hoverbox " + (at.x < 33 ? "ps-hb-l" : at.x > 67 ? "ps-hb-r" : "ps-hb-c");
  const style = "left:" + at.x.toFixed(2) + "%;" + (below ? "top:calc(" + (100 - at.y).toFixed(2) + "% + 12px)" : "bottom:calc(" + at.y.toFixed(2) + "% + 12px)");
  const facts = [yearsText(r[1]), papersText(r[5]), citationsText(r[6])].concat(typeof r[10] === "number" ? [t("h-index") + " " + r[10]] : []);
  return '<div class="' + cls + '" style="' + style + '" aria-hidden="true">' +
    "<div><b>" + esc(nick || t("Anonymous")) + "</b>" + (r[7] === app.boardData.myPub ? ' <span class="ps-tag">' + esc(t("You")) + "</span>" : "") + "</div>" +
    '<div class="ps-hb-end"><i class="ps-g' + groupOf(g, r[3]) + '"></i>' + esc(end ? end.name : r[3]) + "</div>" +
    (title ? '<div class="ps-hb-title">' + esc(title.name) + "</div>" : "") +
    "<div>" + esc(t("Research score")) + " <b>" + esc(r[2]) + "</b></div>" +
    '<small class="ps-hb-facts">' + facts.map(function (f) { return "<span>" + esc(f) + "</span>"; }).join(" · ") + "</small>" +
    (r[8] ? "<small>" + esc(t("daily PhD {date}", { date: r[8] })) + "</small>" : "") +
    '<small class="ps-hb-hint">' + esc(t("Click the dot for more")) + "</small></div>";
}

// Shows the hover box for a run (or hides it, with null) without drawing the whole board again.
export function hoverDot(app, id) {
  const st = app.chart;
  if (!st || !app.boardData || !app.boardData.runs || st.hover === id) return;
  st.hover = id;
  const plot = app.root.querySelector(".ps-chart-plot");
  if (!plot) return;
  const old = plot.querySelector(".ps-hoverbox");
  if (old) old.remove();
  if (id) plot.insertAdjacentHTML("beforeend", tipHtml(app, id));
}

// The run you tapped: who, how it ended, the numbers, and a way into its result card.
function pickedHtml(app) {
  const st = app.chart, runs = app.boardData.runs;
  const r = st.sel && runs.rows.find(function (x) { return x[0] === st.sel; });
  if (!r) return '<p class="ps-muted ps-small ps-chart-hint">' + esc(t("Each dot is one run. Tap one for details; tap a group below to hide or show it.")) + "</p>";
  const end = app.D.endingById[r[3]];
  const nick = runs.players[r[7]];
  return '<div class="ps-picked"><div><b>' + (nick ? esc(nick) : '<span class="ps-muted">' + esc(t("Anonymous")) + "</span>") + "</b>" +
    (r[7] === app.boardData.myPub ? ' <span class="ps-tag">' + esc(t("You")) + "</span>" : "") +
    "<small>" + esc(end ? end.name : r[3]) + (r[8] ? " · " + esc(t("daily PhD {date}", { date: r[8] })) : "") + "</small>" +
    "<small>" + esc(t("Research score")) + " " + esc(r[2]) + " · " + esc(yearsText(r[1])) + " · " + esc(papersText(r[5])) + " · " + esc(citationsText(r[6])) + "</small></div>" +
    '<button class="ps-btn ps-btn-sm" data-action="chart-open" data-id="' + esc(r[0]) + '">' + esc(t("Open this PhD")) + "</button></div>";
}

// How everyone's PhDs ended: the most common endings as bars, colored by group. Tapping one picks
// those runs out in the chart (tap again to show all).
export function endingsHtml(app) {
  const runs = app.boardData.runs;
  if (!runs || !runs.ok || !runs.rows.length) return "";
  const D = app.D, g = groups(D), st = app.chart;
  const n = {};
  runs.rows.forEach(function (r) { n[r[3]] = (n[r[3]] || 0) + 1; });
  const ids = Object.keys(n).sort(function (a, b) { return n[b] - n[a]; });
  const shown = ids.slice(0, 8), rest = ids.slice(8).reduce(function (s, id) { return s + n[id]; }, 0);
  const top = n[ids[0]];
  const bar = function (id, count, label, gi, clickable) {
    const on = st.ending === id;
    return '<' + (clickable ? 'button data-action="chart-ending" data-id="' + esc(id) + '" aria-pressed="' + on + '"' : "div") + ' class="ps-endbar' + (on ? " ps-endbar-on" : "") + (st.ending && !on ? " ps-endbar-dim" : "") + '">' +
      '<span class="ps-endbar-name">' + esc(label) + "</span>" +
      '<span class="ps-endbar-track"><i class="ps-g' + gi + '" style="width:' + Math.max(2, 100 * count / top).toFixed(1) + '%"></i></span>' +
      '<span class="ps-endbar-n">' + count + "</span></" + (clickable ? "button" : "div") + ">";
  };
  return '<div class="ps-endbars">' + shown.map(function (id) {
    const end = D.endingById[id];
    return bar(id, n[id], end ? end.name : id, groupOf(g, id), true);
  }).join("") + (rest ? bar("", rest, t("Other endings"), g.names.length - 1, false) : "") + "</div>" +
    (st.ending ? '<div class="ps-share-row"><button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="chart-ending" data-id="">' + esc(t("Show all endings")) + "</button></div>" : "");
}
