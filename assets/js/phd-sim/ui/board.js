// The public leaderboard: submitting a finished run from the end screen, and the board screen (today's
// daily PhD and all time). The server is a Cloudflare Worker (tools/phd-sim/leaderboard). It takes the
// result with the run's share code and its recorded choices, which it keeps so a replay check could be
// added later. Without a server address on the page (data-board), none of this shows.
import { esc, papersText, citationsText } from "./common.js";
import { encodeResult } from "./share.js";
import { t, T_ } from "../engine/i18n.js";
import { runRecord, resultOf } from "../engine/replay.js";
import { playerId, loadNick, saveNick } from "../engine/save.js";
import { dailyDay } from "../engine/util.js";
import { chartHtml, endingsHtml } from "./chart.js";

async function api(base, path, body) {
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctl ? setTimeout(function () { ctl.abort(); }, 20000) : null;
  try {
    const r = await fetch(base + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl && ctl.signal }
      : { signal: ctl && ctl.signal });
    const j = await r.json().catch(function () { return { ok: false, reason: "server_error" }; });
    return j;
  } catch (e) {
    return { ok: false, reason: "network" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const REASONS = {
  invalid: T_("This run couldn’t be added to the leaderboard."),
  duplicate: T_("This run is already on the leaderboard."),
  bad_nick: T_("That nickname can’t be used. Try another one."),
  rate_limited: T_("Too many submissions for now. Try again in an hour."),
  daily_out_of_range: T_("A daily PhD can go on the leaderboard up to a week after its day."),
  banned: T_("This browser can’t submit to the leaderboard."),
  network: T_("The leaderboard can’t be reached right now. Try again later."),
  server_error: T_("The leaderboard had a problem. Try again later.")
};

// ---- Submitting from the end screen ------------------------------------------------------------

export async function submitRun(app) {
  const s = app.finished;
  const pid = playerId();
  if (!s || !s.ending || !pid || (app.boardSubmit && app.boardSubmit.state === "sending")) return;
  const input = app.root.querySelector("#ps-nick");
  const nick = input ? input.value.trim() : loadNick();
  saveNick(nick);
  app.boardSubmit = { state: "sending" };
  app.keepScroll = true;
  app.render();
  const out = await api(app.board, "/api/submit", { pid: pid, nick: nick, lang: app.lang, result: resultOf(s.ending), code: encodeResult(s.ending, app.D),
    record: s.inputs ? runRecord(s) : null });
  app.boardSubmit = out.ok ? { state: "done", out: out } : { state: "error", reason: out.reason };
  app.boardData = null; // the board changed
  app.keepScroll = true;
  app.render();
}

function placeLine(r, daily) {
  if (!r || !r.rank) return "";
  return daily ? t("Today’s daily PhD: #{rank} of {n}", { rank: r.rank, n: r.of }) : t("All time: #{rank} of {n}", { rank: r.rank, n: r.of });
}

export function boardSectionHtml(app) {
  if (!app.board || !app.finished) return "";
  const s = app.finished;
  const head = '<div class="ps-section ps-board-submit"><h3 class="ps-section-title">' + esc(t("Leaderboard")) + "</h3>";
  if (!playerId()) return head + '<p class="ps-muted ps-small">' + esc(t("Your browser is blocking storage, so this run can’t go on the leaderboard.")) + "</p></div>";
  const st = app.boardSubmit || {};
  if (st.state === "done") {
    const o = st.out;
    const lines = [placeLine(o.ranks.daily, true), placeLine(o.ranks.all, false)].filter(Boolean);
    const kept = !o.best.all && !(o.ranks.daily && o.best.daily);
    return head + '<p class="ps-board-done">✔️ ' + esc(t("On the leaderboard.")) + "</p>" +
      (lines.length ? '<p class="ps-small">' + lines.map(esc).join(" · ") + "</p>" : "") +
      (kept ? '<p class="ps-muted ps-small">' + esc(t("Your earlier best still stands; each board shows your best run.")) + "</p>" : "") +
      '<div class="ps-share-row"><button class="ps-btn ps-btn-sm ps-btn-primary" data-action="board">' + esc(t("See the leaderboard")) + "</button></div></div>";
  }
  const sending = st.state === "sending";
  return head + '<p class="ps-small">' + esc(s.daily ? t("This was today’s daily PhD: it goes on today’s board and the all-time board.") : t("Put this run on the all-time board.")) + " " +
    esc(t("Only your nickname and this run’s numbers are shown.")) + "</p>" +
    '<div class="ps-board-form"><input class="ps-input" id="ps-nick" maxlength="20" autocomplete="nickname" placeholder="' + esc(t("Nickname (optional)")) + '" value="' + esc(loadNick() || "") + '"' + (sending ? " disabled" : "") + ">" +
    '<button class="ps-btn ps-btn-primary" data-action="board-submit"' + (sending ? " disabled" : "") + ">" + esc(sending ? t("Submitting…") : t("Submit")) + "</button></div>" +
    (st.state === "error" ? '<p class="ps-note ps-small">' + esc(t(REASONS[st.reason] || REASONS.server_error)) + "</p>" : "") + "</div>";
}

// ---- The board screen --------------------------------------------------------------------------

// The id other players see for you (the server's "pub"), so the chart can mark your runs.
async function publicId(pid) {
  try {
    const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("pub:" + pid));
    return Array.from(new Uint8Array(d), function (b) { return b.toString(16).padStart(2, "0"); }).join("").slice(0, 10);
  } catch (e) { return null; }
}

export async function loadBoards(app) {
  const pid = playerId();
  const me = pid ? "&me=" + pid : "";
  const day = dailyDay();
  app.boardData = { loading: true, day: day };
  app.chart = app.chart || { hidden: {}, ending: null, sel: null };
  app.chart.hover = null;
  app.render();
  const [daily, all, runs, myPub] = await Promise.all([
    api(app.board, "/api/board?kind=daily&day=" + day + "&limit=50" + me),
    api(app.board, "/api/board?kind=all&limit=10" + me),
    api(app.board, "/api/runs?limit=2000"),
    pid ? publicId(pid) : null
  ]);
  app.boardData = { day: day, daily: daily, all: all, runs: runs, myPub: myPub, error: !daily.ok && !all.ok ? (daily.reason || "network") : null };
  if (app.screen === "board") app.render();
}

// Opens a run from the chart: its share code comes from the server, then the result card shows it.
export async function openRun(app, id) {
  const out = await api(app.board, "/api/run?id=" + encodeURIComponent(id));
  if (out.ok && out.run && out.run.code) { app.fromBoard = { nick: out.run.nick || "" }; location.hash = "r=" + out.run.code; }
}

function rowHtml(app, e, mine) {
  const end = app.D.endingById[e.ending];
  const name = e.nick ? esc(e.nick) : '<span class="ps-muted">' + esc(t("Anonymous")) + "</span>";
  return '<button class="ps-board-row' + (mine ? " ps-board-me" : "") + '" data-action="board-open" data-id="' + esc(e.code || "") + '" data-nick="' + esc(e.nick || "") + '" title="' + esc(t("Open this PhD")) + '">' +
    '<span class="ps-board-rank">' + e.rank + "</span>" +
    '<span class="ps-board-who"><b>' + name + "</b><small>" + esc(end ? end.name : e.ending) + " · " + esc(papersText(e.pubs)) + " · " + esc(citationsText(e.cites)) + "</small></span>" +
    '<span class="ps-board-score"><b>' + esc(e.score) + "</b>" + (e.beats ? "<small>" + esc(t("top {n}%", { n: Math.max(1, 100 - e.beats) })) + "</small>" : "") + "</span></button>";
}

function listHtml(app, b, emptyText) {
  if (!b || !b.ok) return '<p class="ps-muted ps-small">' + esc(t(REASONS[(b && b.reason) || "network"] || REASONS.network)) + "</p>";
  const mine = b.me && b.me.pub;
  let html = b.entries.length ? b.entries.map(function (e) { return rowHtml(app, e, e.pub === mine); }).join("") : '<p class="ps-muted ps-small">' + esc(emptyText) + "</p>";
  // Your own place, when you're further down than the list goes.
  if (b.me && !b.entries.some(function (e) { return e.pub === mine; })) html += '<div class="ps-board-gap">…</div>' + rowHtml(app, b.me, true);
  return html;
}

export function boardScreenHtml(app) {
  const d = app.boardData || { loading: true };
  const head = '<div class="ps-spread"><h2>' + esc(t("Leaderboard")) + '</h2><button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="board-close">' + esc(t("Back")) + "</button></div>";
  if (d.loading) return head + '<p class="ps-muted">' + esc(t("Loading the leaderboard…")) + "</p>";
  if (d.error) return head + '<p class="ps-note">' + esc(t(REASONS[d.error] || REASONS.network)) + "</p>";
  const count = function (b) { return b && b.ok ? " · " + (b.total === 1 ? t("1 player") : t("{n} players", { n: b.total })) : ""; };
  const runCount = d.runs && d.runs.ok ? " · " + (d.runs.total === 1 ? t("1 run") : t("{n} runs", { n: d.runs.total })) : "";
  return head + '<div class="ps-board">' +
    '<section class="ps-section"><h3 class="ps-section-title">' + esc(t("Today’s daily PhD")) + " · " + esc(d.day) + esc(count(d.daily)) + "</h3>" +
    '<p class="ps-muted ps-small">' + esc(t("Everyone gets the same game today; only the choices differ. A new one starts at midnight US Eastern Time (noon or 1 pm in Beijing, depending on daylight saving).")) + "</p>" +
    listHtml(app, d.daily, t("No one is on today’s board yet.")) +
    '<div class="ps-share-row"><button class="ps-btn ps-btn-sm" data-action="setup-daily">' + esc(t("Play today’s daily PhD")) + "</button></div></section>" +
    // All time: every run in the chart, how they ended, then the top ten players by their best run.
    '<section class="ps-section"><h3 class="ps-section-title">' + esc(t("All time")) + esc(count(d.all)) + esc(runCount) + "</h3>" +
    chartHtml(app) +
    (d.runs && d.runs.ok && d.runs.rows.length ? '<h4 class="ps-board-sub">' + esc(t("How PhDs ended")) + "</h4>" + endingsHtml(app) : "") +
    '<h4 class="ps-board-sub">' + esc(t("Top 10 (each player’s best run)")) + "</h4>" +
    listHtml(app, d.all, t("No one is on the board yet.")) + "</section>" +
    '<p class="ps-muted ps-small">' + esc(t("Ranked by research record: papers, top venues, h-index, citations and letters. The lists keep each player’s best run; the chart shows every run.")) + "</p></div>";
}
