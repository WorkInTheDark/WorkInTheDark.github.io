// Sharing a finished PhD without a server: the result travels in the link itself (#r=…), and whoever
// opens it sees a read-only card. Only ids and numbers go in the link; every name and sentence on the
// card comes from the game's own data, so a hand-made link can't put new words on the page.
import { esc } from "./common.js";

const NUMS = ["y", "p", "c", "h", "r", "b"];

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
    const title = (D.titles || []).find(function (t) { return t.id === r.t; });
    const out = { ending: ending, title: title || null, graduated: r.g === 1, achievements: [] };
    NUMS.forEach(function (k) {
      const v = Number(r[k]);
      out[k] = Number.isFinite(v) && v >= 0 && v < 1e6 ? Math.round(v * 10) / 10 : 0;
    });
    const k = Number(r.k);
    out.beats = Number.isFinite(k) && k >= 0 && k <= 99 ? Math.round(k) : null;
    out.daily = typeof r.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.d) ? r.d : null;
    out.achievements = achFromMask(r.m, D);
    return out;
  } catch (err) {
    return null;
  }
}

export function readSharedFromLocation(D) {
  const m = /[#&]r=([A-Za-z0-9_-]+)/.exec(location.hash || "");
  return m ? decodeResult(m[1], D) : null;
}

export function shareUrl(e, D) {
  return location.origin + location.pathname + "#r=" + encodeResult(e, D);
}

export function beatsLine(k) {
  return k !== null && k !== undefined && k > 0 ? "Better than " + k + "% of simulated PhDs" : "";
}

// The post that goes with the link (short enough for X with the link attached).
export function shareText(e) {
  const n = e.numbers;
  const beats = beatsLine(n.beats);
  return "My PhD Simulator run: " + e.name + ", “" + e.title.name + ".” " + n.years + " years, " +
    n.pubs + " first-author paper" + (n.pubs === 1 ? "" : "s") + ", " + n.citations + " citations, " +
    n.rejections + " rejection" + (n.rejections === 1 ? "" : "s") + "." + (beats ? " " + beats + "." : "");
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
  const t = shareTargets(e, D);
  const link = function (href, label) { return '<a class="ps-btn ps-btn-sm" href="' + esc(href) + '" target="_blank" rel="noopener">' + label + "</a>"; };
  return '<div class="ps-section ps-share"><h3 class="ps-section-title">Share your PhD</h3><div class="ps-share-row">' +
    (canNativeShare ? '<button class="ps-btn ps-btn-sm ps-btn-primary" data-action="share-native">Share…</button>' : "") +
    link(t.x, "X") + link(t.bluesky, "Bluesky") + link(t.linkedin, "LinkedIn") +
    '<button class="ps-btn ps-btn-sm" data-action="copy-link">Copy link</button>' +
    '<button class="ps-btn ps-btn-sm" data-action="save-image">Save image</button></div>' +
    '<p class="ps-muted ps-small">The link carries your result, so whoever opens it sees this card. Nothing is stored on the site.</p></div>';
}

// The read-only card someone sees when they open a shared link.
export function sharedHtml(app) {
  const r = app.shared;
  const D = app.D;
  const today = new Date().toISOString().slice(0, 10);
  const blurb = r.ending.text && r.ending.text.indexOf("{") < 0 ? r.ending.text : r.ending.offer || "";
  const nums = [["Years", r.y], ["First-author papers", r.p], ["Citations", r.c], ["h-index", r.h], ["Rejections", r.r], ["Burnouts", r.b]];
  return '<div class="ps-end ps-shared"><div class="ps-end-head"><div class="ps-kicker">Someone shared their PhD' +
    (r.daily ? " · daily PhD " + esc(r.daily) : "") + "</div>" +
    "<h2>" + esc(r.ending.name) + "</h2>" +
    (r.title ? '<div class="ps-end-title">' + esc(r.title.name) + "</div>" + (r.title.desc ? '<div class="ps-muted ps-small">' + esc(r.title.desc) + "</div>" : "") : "") + "</div>" +
    (blurb ? '<div class="ps-card ps-section"><p class="ps-text">' + esc(blurb) + "</p></div>" : "") +
    (beatsLine(r.beats) ? '<p class="ps-share-beats">' + esc(beatsLine(r.beats)) + ".</p>" : "") +
    '<div class="ps-section"><div class="ps-numbers">' +
    nums.map(function (x) { return "<div><b>" + esc(x[1]) + "</b>" + esc(x[0]) + "</div>"; }).join("") + "</div></div>" +
    (r.achievements.length ? '<div class="ps-section"><h3 class="ps-section-title">Achievements</h3><div class="ps-chips">' + r.achievements.map(function (id) {
      const a = D.achievementById[id];
      return '<span class="ps-chip ps-chip-accent" title="' + esc(a.desc || "") + '">' + esc(a.name) + "</span>";
    }).join("") + "</div></div>" : "") +
    '<div class="ps-foot" style="justify-content:center">' +
    (r.daily === today ? '<button class="ps-btn" data-action="shared-daily">Play the same daily PhD</button>' : "") +
    '<button class="ps-btn ps-btn-primary" data-action="shared-play">Play your own PhD</button></div></div>';
}

// The card as a PNG, once the game's rounded font is ready (a canvas can't wait for it on its own).
export function cardBlob(e, done) {
  const draw = function () { drawCard(e).toBlob(done, "image/png"); };
  if (document.fonts && document.fonts.load) document.fonts.load('600 40px "Fredoka"').then(draw, draw);
  else draw();
}

// The image: a 1200 × 630 card in the game's colors, for saving or attaching to a post.
export function drawCard(e) {
  const c = document.createElement("canvas");
  c.width = 1200; c.height = 630;
  const x = c.getContext("2d");
  const display = '"Fredoka", ui-rounded, system-ui, sans-serif';
  const body = "system-ui, -apple-system, sans-serif";
  const n = e.numbers;
  x.fillStyle = "#f6efe0"; x.fillRect(0, 0, 1200, 630);
  x.fillStyle = "#283454"; x.fillRect(0, 0, 1200, 92);
  x.fillStyle = "#f6efe0"; x.font = "600 34px " + display; x.fillText("\u{1F393} PhD Simulator", 60, 60);
  x.fillStyle = "#aeb6cf"; x.font = "500 24px " + body; x.textAlign = "right"; x.fillText(location.host + location.pathname.replace(/index\.html$/, ""), 1140, 58); x.textAlign = "left";
  x.fillStyle = "#857c6e"; x.font = "600 24px " + body; x.fillText((e.graduated ? "GRADUATED" : "LEFT THE PHD") + (e.group ? " · " + e.group.toUpperCase() : ""), 60, 158);
  x.fillStyle = "#2b2620"; x.font = "600 62px " + display; x.fillText(e.name, 60, 228, 1080);
  x.fillStyle = "#d65a32"; x.font = "600 36px " + display; x.fillText(e.title.name, 60, 282, 1080);
  const cells = [["Years", n.years], ["Papers", n.pubs], ["Citations", n.citations], ["h-index", n.h], ["Rejections", n.rejections], ["Achievements", e.achievements.length]];
  cells.forEach(function (cell, i) {
    const cx = 60 + i * 183, cy = 330;
    x.fillStyle = "#fffdf7"; x.strokeStyle = "#e4d9c3"; x.lineWidth = 3;
    roundRect(x, cx, cy, 165, 120, 18); x.fill(); x.stroke();
    x.textAlign = "center";
    x.fillStyle = "#2b2620"; x.font = "600 46px " + display; x.fillText(String(cell[1]), cx + 82, cy + 66);
    x.fillStyle = "#857c6e"; x.font = "500 21px " + body; x.fillText(cell[0], cx + 82, cy + 98);
    x.textAlign = "left";
  });
  const beats = beatsLine(n.beats);
  if (beats) { x.fillStyle = "#2f8a55"; x.font = "600 30px " + display; x.fillText(beats, 60, 520); }
  x.fillStyle = "#857c6e"; x.font = "500 22px " + body; x.fillText("A game about doing a PhD in NLP and HCI. Play your own.", 60, 580);
  return c;
}

function roundRect(x, l, t, w, h, r) {
  x.beginPath();
  x.moveTo(l + r, t); x.lineTo(l + w - r, t); x.quadraticCurveTo(l + w, t, l + w, t + r);
  x.lineTo(l + w, t + h - r); x.quadraticCurveTo(l + w, t + h, l + w - r, t + h);
  x.lineTo(l + r, t + h); x.quadraticCurveTo(l, t + h, l, t + h - r);
  x.lineTo(l, t + r); x.quadraticCurveTo(l, t, l + r, t); x.closePath();
}
