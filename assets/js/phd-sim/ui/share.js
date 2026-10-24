// Sharing a finished PhD without a server: the result travels in the link itself (#r=…), and whoever
// opens it sees a read-only card. Only ids and numbers go in the link; every name and sentence on the
// card comes from the game's own data, so a hand-made link can't put new words on the page.
import { esc, langSwitchHtml, citationsText } from "./common.js";
import { t, language } from "../engine/i18n.js";
import { dailyDay } from "../engine/util.js";
import { detailsHtml, HIDDEN_SHOWN } from "./result.js";

const NUMS = ["y", "p", "c", "h", "r", "b"];
// Since 2026-10-23 a link also carries the other numbers, the hidden numbers, the epilogue, the advisor
// and the papers (playtest feedback: a shared result said too little). Older links simply lack them.
const MORE = { ap: "allPubs", sb: "submissions", cf: "conferences", ot: "overtime", ev: "events", sc: "score" };
const STATUS = ["accepted", "rejected", "under_review", "revise_resubmit"];
const MAX_PAPERS = 12;
const own = function (o, k) { return !!o && typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k); };

// Achievements travel as a bitmask over their order in achievements.yml (hex, 4 per character),
// which keeps a link with twenty achievements about 200 characters long.
function achMask(ids, D) {
  const bits = D.achievements.map(function (a) { return ids.indexOf(a.id) >= 0 ? 1 : 0; });
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) hex += (bits[i] | (bits[i + 1] || 0) << 1 | (bits[i + 2] || 0) << 2 | (bits[i + 3] || 0) << 3).toString(16);
  return hex.replace(/0+$/, "");
}

function achFromMask(hex, D) {
  const out = [];
  if (typeof hex !== "string" || !/^[0-9a-f]{0,64}$/.test(hex)) return out;
  for (let i = 0; i < hex.length; i++) {
    const v = parseInt(hex[i], 16);
    for (let b = 0; b < 4; b++) if (v & (1 << b) && D.achievements[i * 4 + b]) out.push(D.achievements[i * 4 + b].id);
  }
  return out;
}

export function encodeResult(e, D) {
  const n = e.numbers;
  const r = { v: 1, e: e.id, t: e.title.id, g: e.graduated ? 1 : 0, y: n.years, p: n.pubs, c: n.citations, h: n.h, r: n.rejections, b: n.burnouts, m: achMask(e.achievements, D) };
  if (n.beats !== null && n.beats !== undefined) r.k = n.beats;
  if (e.daily) r.d = e.daily;
  Object.keys(MORE).forEach(function (k) { if (typeof n[MORE[k]] === "number") r[k] = n[MORE[k]]; });
  if (n.stats) r.s = HIDDEN_SHOWN.map(function (k) { return Math.round(n.stats[k] || 0); });
  if (e.ref && e.ref.epilogue && e.ref.epilogue.length) r.x = e.ref.epilogue;
  if (e.advisor && e.advisor.ref) r.a = e.advisor.ref;
  // Each paper: [venue, cycle, Findings, topic, title list, title index, status, citations, first author].
  let papers = (e.papers || []).filter(function (p) { return p.ref && STATUS.indexOf(p.status) >= 0; });
  if (papers.length > MAX_PAPERS) papers = papers.slice().sort(function (a, b) { return b.cites - a.cites; }).slice(0, MAX_PAPERS);
  if (papers.length) r.pp = papers.map(function (p) { return p.ref.concat([STATUS.indexOf(p.status), p.cites, p.first ? 1 : 0]); });
  const bytes = new TextEncoder().encode(JSON.stringify(r));
  let bin = "";
  bytes.forEach(function (b) { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Back from the link: anything unknown or out of range is dropped, so the card shows only real game content.
export function decodeResult(token, D) {
  try {
    const bin = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
    const r = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, function (ch) { return ch.charCodeAt(0); })));
    if (!r || r.v !== 1) return null;
    const ending = D.endingById[r.e];
    if (!ending) return null;
    const title = (D.titles || []).find(function (ti) { return ti.id === r.t; });
    const out = { ending: ending, title: title || null, graduated: r.g === 1, achievements: [] };
    NUMS.forEach(function (k) {
      const v = Number(r[k]);
      out[k] = Number.isFinite(v) && v >= 0 && v < 1e6 ? Math.round(v * 10) / 10 : 0;
    });
    const k = Number(r.k);
    out.beats = Number.isFinite(k) && k >= 0 && k <= 99 ? Math.round(k) : null;
    out.daily = typeof r.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.d) ? r.d : null;
    out.achievements = achFromMask(r.m, D);
    const num = function (v) { v = Number(v); return Number.isFinite(v) && v >= 0 && v < 1e6 ? Math.round(v * 10) / 10 : null; };
    out.more = {};
    Object.keys(MORE).forEach(function (key) { if (r[key] !== undefined) out.more[MORE[key]] = num(r[key]); });
    out.stats = null;
    if (Array.isArray(r.s)) {
      out.stats = {};
      HIDDEN_SHOWN.forEach(function (key, i) { const v = Number(r.s[i]); if (Number.isFinite(v)) out.stats[key] = Math.max(0, Math.min(100, Math.round(v))); });
    }
    // Words come only from the game's data: epilogue lines by their place in epilogues.yml, the advisor
    // by type and surname list, papers by venue and their topic's title lists.
    out.epilogue = (Array.isArray(r.x) ? r.x.slice(0, 5) : []).map(function (i) { return Number.isInteger(i) ? D.epilogues[i] : null; })
      .filter(function (x) { return x && typeof x.text === "string" && x.text.indexOf("{") < 0; }).map(function (x) { return x.text; });
    out.advisor = null;
    if (Array.isArray(r.a) && own(D.archetypeById, r.a[0]) && typeof D.archetypeById[r.a[0]].label === "string") {
      const last = (D.names && D.names.last) || [];
      const surname = Number.isInteger(r.a[1]) && r.a[1] >= 0 ? last[r.a[1]] : null;
      out.advisor = { label: D.archetypeById[r.a[0]].label, name: typeof surname === "string" ? t("Prof. {name}", { name: surname }) : "" };
    }
    out.papers = (Array.isArray(r.pp) ? r.pp.slice(0, MAX_PAPERS) : []).map(function (a) {
      if (!Array.isArray(a) || a.length < 9 || !own(D.venueById, a[0])) return null;
      const cycle = (D.venueById[a[0]].cycles || [])[a[1]];
      const status = STATUS[a[6]];
      if (!cycle || typeof cycle.name !== "string" || !status) return null;
      const pool = own(D.topicById, a[3]) && D.topicById[a[3]].titles && own(D.topicById[a[3]].titles, a[4]) ? D.topicById[a[3]].titles[a[4]] : null;
      const title = Array.isArray(pool) && Number.isInteger(a[5]) && a[5] >= 0 && typeof pool[a[5]] === "string" ? pool[a[5]] : "";
      const cites = Number(a[7]);
      return { venue: cycle.name + (a[2] === 1 ? " Findings" : ""), title: title, status: status, cites: Number.isInteger(cites) && cites >= 0 && cites < 1e7 ? cites : 0, first: a[8] === 1 };
    }).filter(Boolean);
    return out;
  } catch (err) {
    return null;
  }
}

// A decoded link as an ending, in the shape the end screen uses, for detailsHtml and the poster.
function sharedEnding(r) {
  const text = r.ending.text && r.ending.text.indexOf("{") < 0 ? r.ending.text : r.ending.offer || "";
  const numbers = { years: r.y, pubs: r.p, citations: r.c, h: r.h, rejections: r.r, burnouts: r.b, beats: r.beats, stats: r.stats };
  Object.keys(r.more || {}).forEach(function (k) { numbers[k] = r.more[k]; });
  return { text: text, epilogue: r.epilogue || [], numbers: numbers, papers: r.papers || [], achievements: r.achievements, advisor: r.advisor };
}

export function readSharedFromLocation(D) {
  const m = /[#&]r=([A-Za-z0-9_-]+)/.exec(location.hash || "");
  return m ? decodeResult(m[1], D) : null;
}

export function shareUrl(e, D) {
  return location.origin + location.pathname + "#r=" + encodeResult(e, D);
}

// As a label, or with `sentence` set, as a sentence with its full stop.
export function beatsLine(k, sentence) {
  if (k === null || k === undefined || !(k > 0)) return "";
  return sentence ? t("Better than {n}% of simulated PhDs.", { n: k }) : t("Better than {n}% of simulated PhDs", { n: k });
}

// The post that goes with the link (short enough for X with the link attached).
export function shareText(e) {
  const n = e.numbers;
  const beats = beatsLine(n.beats, true);
  const v = { years: n.years, pubs: n.pubs, citations: n.citations, rejections: n.rejections };
  const counts = n.pubs === 1
    ? (n.rejections === 1 ? t("{years} years, 1 first-author paper, {citations} citations, 1 rejection.", v) : t("{years} years, 1 first-author paper, {citations} citations, {rejections} rejections.", v))
    : (n.rejections === 1 ? t("{years} years, {pubs} first-author papers, {citations} citations, 1 rejection.", v) : t("{years} years, {pubs} first-author papers, {citations} citations, {rejections} rejections.", v));
  // Chinese runs sentences together without spaces.
  const gap = language() === "zh" ? "" : " ";
  return t("My PhD Simulator run: {ending}, “{title}.”", { ending: e.name, title: e.title.name }) + gap + counts + (beats ? gap + beats : "");
}

export function shareTargets(e, D) {
  const url = shareUrl(e, D);
  const text = shareText(e);
  return {
    url: url,
    text: text,
    x: "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(url),
    bluesky: "https://bsky.app/intent/compose?text=" + encodeURIComponent(text + " " + url),
    linkedin: "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(url)
  };
}

// The share row on the end screen. The device share sheet only shows where the browser has one.
export function shareRowHtml(e, D, canNativeShare) {
  const tg = shareTargets(e, D);
  const link = function (href, label) { return '<a class="ps-btn ps-btn-sm" href="' + esc(href) + '" target="_blank" rel="noopener">' + label + "</a>"; };
  return '<div class="ps-section ps-share"><h3 class="ps-section-title">' + esc(t("Share your PhD")) + '</h3><div class="ps-share-row">' +
    (canNativeShare ? '<button class="ps-btn ps-btn-sm ps-btn-primary" data-action="share-native">' + esc(t("Share…")) + "</button>" : "") +
    link(tg.x, "X") + link(tg.bluesky, "Bluesky") + link(tg.linkedin, "LinkedIn") +
    '<button class="ps-btn ps-btn-sm" data-action="copy-link">' + esc(t("Copy link")) + "</button>" +
    '<button class="ps-btn ps-btn-sm" data-action="save-image">' + esc(t("Save image")) + "</button></div>" +
    '<p class="ps-muted ps-small">' + esc(t("The link carries your result, so whoever opens it sees this card. Nothing is stored on the site.")) + "</p></div>";
}

// The read-only card someone sees when they open a shared link.
export function sharedHtml(app) {
  const r = app.shared;
  const D = app.D;
  const today = dailyDay();
  const from = app.fromBoard;
  const kicker = from ? (from.nick ? t("{name}’s PhD, from the leaderboard", { name: from.nick }) : t("A PhD from the leaderboard")) : t("Someone shared their PhD");
  return '<div class="ps-end ps-shared">' + (app.storageOk ? '<div class="ps-end-lang">' + langSwitchHtml() + "</div>" : "") +
    '<div class="ps-end-head"><div class="ps-kicker">' + esc(kicker) +
    (r.daily ? " · " + esc(t("daily PhD {date}", { date: r.daily })) : "") + "</div>" +
    "<h2>" + esc(r.ending.name) + "</h2>" +
    (r.title ? '<div class="ps-end-title">' + esc(r.title.name) + "</div>" + (r.title.desc ? '<div class="ps-muted ps-small">' + esc(r.title.desc) + "</div>" : "") : "") + "</div>" +
    (beatsLine(r.beats) ? '<p class="ps-share-beats">' + esc(beatsLine(r.beats, true)) + "</p>" : "") +
    detailsHtml(sharedEnding(r), D, false) +
    '<div class="ps-foot" style="justify-content:center">' +
    (app.fromBoard ? '<button class="ps-btn" data-action="board-back">' + esc(t("Back to the leaderboard")) + "</button>" : "") +
    (r.daily === today ? '<button class="ps-btn" data-action="shared-daily">' + esc(t("Play the same daily PhD")) + "</button>" : "") +
    '<button class="ps-btn ps-btn-primary" data-action="shared-play">' + esc(t("Play your own PhD")) + "</button></div></div>";
}

// The card as a PNG, once the game's rounded font is ready (a canvas can't wait for it on its own).
export function cardBlob(e, D, done) {
  const draw = function () { drawPoster(e, D).toBlob(done, "image/png"); };
  if (document.fonts && document.fonts.load) document.fonts.load('600 40px "Fredoka"').then(draw, draw);
  else draw();
}

// Text that wraps: Chinese can break between any two characters, other text at spaces. Closing
// punctuation stays at the end of its line. With maxLines, the last line ends in "…".
const CJK = "\\u3000-\\u303f\\u3400-\\u9fff\\uf900-\\ufaff\\uff00-\\uffef";
const TOKEN = new RegExp("[" + CJK + "]|[^\\s" + CJK + "]+\\s*|\\s+", "g");
function wrapLines(x, text, maxW, maxLines) {
  const lines = [];
  let line = "";
  (String(text || "").match(TOKEN) || []).forEach(function (tok) {
    const next = line + tok;
    if (!line || x.measureText(next.trimEnd()).width <= maxW || /^[，。、；：！？）」』”’,.;:!?)]/.test(tok)) { line = next; return; }
    lines.push(line.trimEnd());
    line = tok.trimStart();
  });
  if (line.trim()) lines.push(line.trimEnd());
  if (maxLines && lines.length > maxLines) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && x.measureText(last + "…").width > maxW) last = last.slice(0, -1);
    lines.length = maxLines;
    lines[maxLines - 1] = last.trimEnd() + "…";
  }
  return lines;
}

// The image for Save image and the share sheet: a tall poster, 1080 wide, with the whole result on it,
// made for WeChat Moments and Instagram (playtest feedback, 2026-10-23). Its height follows what's on it.
export function drawPoster(e, D) {
  const W = 1080, PAD = 64, IN = W - 2 * PAD;
  const display = '"Fredoka", ui-rounded, system-ui, sans-serif';
  const body = 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
  const C = { bg: "#f6efe0", ink: "#2b2620", muted: "#857c6e", card: "#fffdf7", line: "#e4d9c3", accent: "#d65a32", good: "#2f8a55", track: "#ece3d1", navy: "#283454", navyInk: "#f6efe0", navyMuted: "#aeb6cf" };
  const n = e.numbers || {};
  const site = location.host + location.pathname.replace(/index\.html$/, "");
  const big = document.createElement("canvas");
  big.width = W; big.height = 5000;
  const x = big.getContext("2d");
  x.fillStyle = C.bg; x.fillRect(0, 0, W, big.height);
  x.textBaseline = "alphabetic";
  const text = function (s, left, top, font, color, align) {
    x.font = font; x.fillStyle = color; x.textAlign = align || "left"; x.fillText(s, left, top); x.textAlign = "left";
  };
  // Wrapped text with its first baseline at top; returns the height it took.
  const para = function (s, top, font, color, lineH, maxLines) {
    x.font = font;
    const lines = wrapLines(x, s, IN, maxLines);
    lines.forEach(function (l, i) { text(l, PAD, top + i * lineH, font, color); });
    return lines.length * lineH;
  };
  const card = function (top, h) { x.fillStyle = C.card; x.strokeStyle = C.line; x.lineWidth = 3; roundRect(x, PAD, top, IN, h, 22); x.fill(); x.stroke(); };
  const heading = function (s, top) { text(s.toUpperCase(), PAD, top, "700 24px " + body, C.muted); return top + 22; };

  // The band on top.
  x.fillStyle = C.navy; x.fillRect(0, 0, W, 112);
  text("\u{1F393} " + t("PhD Simulator"), PAD, 72, "600 42px " + display, C.navyInk);
  text(site, W - PAD, 70, "500 26px " + body, C.navyMuted, "right");
  let y = 184;

  // Who you became.
  const kicker = ((e.graduated ? t("Graduated") : t("Left the PhD")) + (e.group ? " · " + e.group : "")).toUpperCase() + (e.daily ? " · " + t("daily PhD {date}", { date: e.daily }) : "");
  y += para(kicker, y, "600 26px " + body, C.muted, 36, 2);
  y += 30;
  y += para(e.name, y + 40, "600 66px " + display, C.ink, 78, 3);
  if (e.title) {
    y += para(e.title.name, y + 40, "600 40px " + display, C.accent, 50, 2);
    if (e.title.desc) y += para(e.title.desc, y + 34, "500 28px " + body, C.muted, 38, 3) + 6;
  }
  const beats = beatsLine(n.beats, true);
  if (beats) y += para(beats, y + 50, "600 34px " + display, C.good, 44, 2) + 8;
  y += 34;

  // The story and the epilogue.
  x.font = "500 30px " + body;
  const story = e.text ? wrapLines(x, e.text, IN - 64) : [];
  x.font = "500 26px " + body;
  const epi = (e.epilogue || []).map(function (l) { return wrapLines(x, l, IN - 64); });
  if (story.length || epi.length) {
    const h = 40 + story.length * 44 + epi.reduce(function (s, ls) { return s + 14 + ls.length * 38; }, 0) + 28;
    card(y, h);
    let ty = y + 40 + 30;
    story.forEach(function (l) { text(l, PAD + 32, ty, "500 30px " + body, C.ink); ty += 44; });
    epi.forEach(function (ls) { ty += 14; ls.forEach(function (l) { text(l, PAD + 32, ty, "500 26px " + body, C.muted); ty += 38; }); });
    y += h + 44;
  }

  // The numbers, four to a row.
  const cells = [[t("Years"), n.years], [t("First-author papers"), n.pubs], [t("All papers"), n.allPubs], [t("Citations"), n.citations], [t("h-index"), n.h],
    [t("Submissions"), n.submissions], [t("Rejections"), n.rejections], [t("Conferences"), n.conferences], [t("Overtime days"), n.overtime], [t("Burnouts"), n.burnouts],
    [t("Events"), n.events], [t("Achievements"), (e.achievements || []).length]].filter(function (c) { return c[1] !== null && c[1] !== undefined; });
  y = heading(t("Your PhD in numbers"), y) + 16;
  const cw = (IN - 3 * 16) / 4, ch = 132;
  cells.forEach(function (cell, i) {
    const cx = PAD + (i % 4) * (cw + 16), cy = y + Math.floor(i / 4) * (ch + 16);
    x.fillStyle = C.card; x.strokeStyle = C.line; x.lineWidth = 3; roundRect(x, cx, cy, cw, ch, 18); x.fill(); x.stroke();
    text(String(cell[1]), cx + cw / 2, cy + 62, "600 48px " + display, C.ink, "center");
    x.font = "500 22px " + body;
    wrapLines(x, cell[0], cw - 20, 2).forEach(function (l, j) { text(l, cx + cw / 2, cy + 96 + j * 26, "500 22px " + body, C.muted, "center"); });
  });
  y += Math.ceil(cells.length / 4) * (ch + 16) + 36;

  // The hidden numbers, two columns of bars.
  const L = e.statLabels || {};
  const stats = (n.stats ? HIDDEN_SHOWN.filter(function (k) { return n.stats[k] !== undefined && n.stats[k] !== null; }) : []);
  if (stats.length) {
    y = heading(t("The hidden numbers, revealed"), y) + 18;
    const colW = (IN - 48) / 2;
    stats.forEach(function (k, i) {
      const cx = PAD + (i % 2) * (colW + 48), cy = y + Math.floor(i / 2) * 70;
      const v = Math.max(0, Math.min(100, n.stats[k]));
      text(t(L[k] || k), cx, cy + 24, "500 26px " + body, C.ink);
      text(String(v), cx + colW, cy + 24, "700 26px " + body, C.ink, "right");
      x.fillStyle = C.track; roundRect(x, cx, cy + 38, colW, 14, 7); x.fill();
      x.fillStyle = v >= 60 ? C.good : v >= 35 ? "#d9a33a" : C.accent; roundRect(x, cx, cy + 38, Math.max(14, colW * v / 100), 14, 7); x.fill();
    });
    y += Math.ceil(stats.length / 2) * 70 + 24;
  }

  if (e.advisor) {
    const line = e.advisor.name ? t("Advisor: {name} ({type}).", { name: e.advisor.name, type: e.advisor.label }) : t("Advisor: {type}.", { type: e.advisor.label });
    y += para(line, y + 10, "500 26px " + body, C.muted, 36, 2) + 30;
  }

  // The most cited papers that got in.
  const best = (e.papers || []).filter(function (p) { return p.status === "accepted" && p.title; }).sort(function (a, b) { return b.cites - a.cites; }).slice(0, 3);
  if (best.length) {
    y = heading(t("Papers"), y) + 18;
    best.forEach(function (p) {
      x.font = "700 22px " + body;
      const tagW = x.measureText(p.venue).width + 24;
      x.fillStyle = "#f9e3d8"; roundRect(x, PAD, y, tagW, 34, 8); x.fill();
      text(p.venue, PAD + 12, y + 24, "700 22px " + body, C.accent);
      x.font = "600 28px " + body;
      const lines = wrapLines(x, p.title, IN - tagW - 16, 2);
      lines.forEach(function (l, j) { text(l, PAD + tagW + 16, y + 26 + j * 38, "600 28px " + body, C.ink); });
      const meta = citationsText(p.cites) + (p.first ? "" : " · " + t("co-author"));
      text(meta, PAD + tagW + 16, y + 26 + lines.length * 38, "500 22px " + body, C.muted);
      y += 26 + lines.length * 38 + 30;
    });
    y += 12;
  }

  // Achievements as chips.
  const ach = (e.achievements || []).map(function (id) { return D.achievementById[id]; }).filter(Boolean);
  if (ach.length) {
    y = heading(t("Achievements"), y) + 18;
    let cx = PAD, cy = y;
    x.font = "600 24px " + body;
    ach.slice(0, 12).concat(ach.length > 12 ? [{ name: "+" + (ach.length - 12) }] : []).forEach(function (a) {
      const w = Math.min(IN, x.measureText(a.name).width + 32);
      if (cx + w > PAD + IN) { cx = PAD; cy += 56; }
      x.fillStyle = "#f9e3d8"; roundRect(x, cx, cy, w, 44, 22); x.fill();
      text(a.name, cx + 16, cy + 30, "600 24px " + body, C.accent);
      cx += w + 12;
    });
    y = cy + 44 + 40;
  }

  // The band at the bottom: where to play.
  y += 10;
  x.fillStyle = C.navy; x.fillRect(0, y, W, 150);
  text(t("A game about doing a PhD in NLP and HCI. Play your own."), PAD, y + 62, "500 28px " + body, C.navyMuted);
  text(site, PAD, y + 112, "600 36px " + display, C.navyInk);
  y += 150;

  const c = document.createElement("canvas");
  c.width = W; c.height = Math.min(big.height, y);
  c.getContext("2d").drawImage(big, 0, 0);
  return c;
}

function roundRect(x, l, t, w, h, r) {
  x.beginPath();
  x.moveTo(l + r, t); x.lineTo(l + w - r, t); x.quadraticCurveTo(l + w, t, l + w, t + r);
  x.lineTo(l + w, t + h - r); x.quadraticCurveTo(l + w, t + h, l + w - r, t + h);
  x.lineTo(l + r, t + h); x.quadraticCurveTo(l, t + h, l, t + h - r);
  x.lineTo(l, t + r); x.quadraticCurveTo(l, t, l + r, t); x.closePath();
}
