// PhD Simulator leaderboard: a Cloudflare Worker with a D1 database.
//   GET  /api/board?kind=daily&day=YYYY-MM-DD   (or kind=all; add &me=<player id> for your own place)
//   POST /api/submit  { pid, nick, lang, result, code, record }
//   POST /api/admin   { token, action: remove | ban | unban | rename, pub, nick }
// Each board keeps one entry per player, their best. Results come from the player's game and aren't
// replayed (Arthur, 2026-10-23); they're checked for shape and against the run's share code, and the
// run's recorded choices are kept so a replay check could be added later.

const LIMITS = {
  perIpHour: 30,        // submissions per IP address per hour
  perPlayerHour: 20,    // submissions per player per hour
  dailyLateDays: 7,     // a daily run can be submitted up to a week after its day
  boardSize: 100,       // the most entries one board request returns
  recordBytes: 200000,  // larger run records aren't kept
  bodyBytes: 300000
};

// Created on first use, so a new database needs no setup step.
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS players (pid TEXT PRIMARY KEY, pub TEXT UNIQUE NOT NULL, nick TEXT NOT NULL DEFAULT '', banned INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, pid TEXT NOT NULL, score REAL NOT NULL, beats INTEGER, ending TEXT NOT NULL, title TEXT, grad INTEGER NOT NULL, years REAL NOT NULL, pubs INTEGER NOT NULL, cites INTEGER NOT NULL, h INTEGER NOT NULL, day TEXT, code TEXT NOT NULL, lang TEXT, at TEXT NOT NULL, run_hash TEXT UNIQUE NOT NULL, record TEXT)",
  "CREATE TABLE IF NOT EXISTS best (board TEXT NOT NULL, pid TEXT NOT NULL, entry_id TEXT NOT NULL, score REAL NOT NULL, at TEXT NOT NULL, PRIMARY KEY (board, pid))",
  "CREATE INDEX IF NOT EXISTS best_rank ON best (board, score DESC, at)",
  "CREATE TABLE IF NOT EXISTS hits (k TEXT PRIMARY KEY, n INTEGER NOT NULL, until INTEGER NOT NULL)"
];
let schemaReady = null;
function ensureSchema(env) {
  if (!schemaReady) schemaReady = env.DB.batch(SCHEMA.map(function (q) { return env.DB.prepare(q); })).catch(function (e) { schemaReady = null; throw e; });
  return schemaReady;
}

// ---- Checks (also used by tools/phd-sim/tests/board-check.test.mjs) ---------------------------------

export async function sha(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)));
  return Array.from(new Uint8Array(d), function (b) { return b.toString(16).padStart(2, "0"); }).join("");
}

export function utcDay(ms) { return new Date(ms === undefined ? Date.now() : ms).toISOString().slice(0, 10); }

// Nicknames on a public board: up to 20 characters, no links, no markup, no obvious slurs. Anything
// that slips through can be renamed or removed with admin.mjs.
const BLOCKED = [
  "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "faggot", "retard", "whore", "slut", "rapist", "nazi", "hitler",
  "傻逼", "煞笔", "沙比", "操你", "草你", "肏", "日你", "他妈的", "草泥马", "婊子", "贱人", "鸡巴", "屌", "滚你", "死全家"
];
// Returns the cleaned nickname, "" for none, or null when it can't be used.
export function cleanNick(raw) {
  let s = String(raw === undefined || raw === null ? "" : raw).normalize("NFKC");
  s = s.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  s = Array.from(s).slice(0, 20).join("").trim();
  if (/[<>]|https?:|www\.|\.(com|net|org|io|cn|me|xyz|top)\b/i.test(s)) return null;
  const flat = s.toLowerCase().replace(/[\s._\-*]/g, "");
  if (BLOCKED.some(function (w) { return flat.indexOf(w) >= 0; })) return null;
  return s;
}

// The share code the game makes for a finished run (ui/share.js encodeResult): base64url JSON.
export function decodeCode(code) {
  try {
    if (typeof code !== "string" || !/^[A-Za-z0-9_-]{8,4000}$/.test(code)) return null;
    const bin = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
    const r = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, function (c) { return c.charCodeAt(0); })));
    return r && r.v === 1 ? r : null;
  } catch (e) {
    return null;
  }
}

const ID = /^[a-z0-9_]{1,40}$/;
const isInt = function (v, max) { return Number.isInteger(v) && v >= 0 && v <= max; };

// A submitted result must be well formed and say the same as the run's share code, which is what a
// viewer sees when they open the entry. Returns the clean result, or { reason }.
export function checkResult(result, code, now) {
  const r = result || {};
  const c = decodeCode(code);
  if (!c) return { reason: "bad_code" };
  const daily = r.daily === null || r.daily === undefined ? null : r.daily;
  if (!(typeof r.score === "number" && isFinite(r.score) && r.score >= 0 && r.score <= 100000)) return { reason: "bad_score" };
  if (typeof r.ending !== "string" || !ID.test(r.ending)) return { reason: "bad_ending" };
  if (r.title !== null && r.title !== undefined && !(typeof r.title === "string" && ID.test(r.title))) return { reason: "bad_title" };
  if (!(typeof r.years === "number" && r.years >= 0 && r.years <= 20) || !isInt(r.pubs, 1000) || !isInt(r.citations, 1e7) || !isInt(r.h, 1000)) return { reason: "bad_numbers" };
  if (r.beats !== null && r.beats !== undefined && !isInt(r.beats, 99)) return { reason: "bad_numbers" };
  if (daily !== null) {
    if (typeof daily !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(daily)) return { reason: "bad_day" };
    if (daily > utcDay(now) || daily < utcDay(now - LIMITS.dailyLateDays * 864e5)) return { reason: "daily_out_of_range" };
  }
  const same = c.e === r.ending && (c.t || null) === (r.title || null) && c.g === (r.graduated ? 1 : 0) && c.y === r.years &&
    c.p === r.pubs && c.c === r.citations && c.h === r.h && (c.k === undefined ? null : c.k) === (r.beats === undefined ? null : r.beats) &&
    (c.d || null) === daily;
  if (!same) return { reason: "code_mismatch" };
  return { value: { score: Math.round(r.score * 10) / 10, beats: r.beats === undefined ? null : r.beats, ending: r.ending, title: r.title || null,
    grad: r.graduated ? 1 : 0, years: r.years, pubs: r.pubs, cites: r.citations, h: r.h, day: daily } };
}

// ---- HTTP ---------------------------------------------------------------------------------------------

function origins(env) { return String(env.ALLOWED_ORIGINS || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean); }

function withCors(req, env, res) {
  const o = req.headers.get("Origin") || "";
  const list = origins(env);
  const h = new Headers(res.headers);
  if (list.indexOf(o) >= 0 || list.indexOf("*") >= 0) {
    h.set("Access-Control-Allow-Origin", o || "*");
    h.set("Vary", "Origin");
    h.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    h.set("Access-Control-Allow-Headers", "Content-Type");
    h.set("Access-Control-Max-Age", "86400");
  }
  return new Response(res.body, { status: res.status, headers: h });
}

function json(status, body, cacheSeconds) {
  return new Response(JSON.stringify(body), { status: status, headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cacheSeconds ? "public, max-age=0, s-maxage=" + cacheSeconds : "no-store"
  } });
}

const boardKey = function (kind, day) { return kind === "daily" ? "d:" + day : "all"; };
const PLAYER = /^[a-z0-9]{16,40}$/;

// ---- Boards -------------------------------------------------------------------------------------------

const ENTRY_COLS = "e.score, e.beats, e.ending, e.title, e.grad, e.years, e.pubs, e.cites, e.h, e.day, e.code, e.at, p.pub, p.nick";

function shape(row, rank) {
  return { rank: rank, pub: row.pub, nick: row.nick || "", score: row.score, beats: row.beats, ending: row.ending, title: row.title,
    grad: row.grad, years: row.years, pubs: row.pubs, cites: row.cites, h: row.h, day: row.day || "", code: row.code, at: row.at };
}

async function placeOf(env, board, pid) {
  return env.DB.prepare(
    "SELECT 1 + (SELECT COUNT(*) FROM best b2 WHERE b2.board = b.board AND (b2.score > b.score OR (b2.score = b.score AND b2.at < b.at))) AS rank, " +
    "(SELECT COUNT(*) FROM best b3 WHERE b3.board = b.board) AS total, b.entry_id AS entry_id, " + ENTRY_COLS +
    " FROM best b JOIN entries e ON e.id = b.entry_id JOIN players p ON p.pid = b.pid WHERE b.board = ? AND b.pid = ?").bind(board, pid).first();
}

async function readBoard(env, kind, day, limit, pid) {
  const board = boardKey(kind, day);
  const n = Math.max(1, Math.min(LIMITS.boardSize, limit || 50));
  const [top, total] = await env.DB.batch([
    env.DB.prepare("SELECT " + ENTRY_COLS + " FROM best b JOIN entries e ON e.id = b.entry_id JOIN players p ON p.pid = b.pid WHERE b.board = ? ORDER BY b.score DESC, b.at ASC LIMIT ?").bind(board, n),
    env.DB.prepare("SELECT COUNT(*) AS n FROM best WHERE board = ?").bind(board)
  ]);
  const out = { ok: true, kind: kind, day: kind === "daily" ? day : null, total: total.results[0].n,
    entries: top.results.map(function (row, i) { return shape(row, i + 1); }) };
  if (pid) {
    const me = await placeOf(env, board, pid);
    if (me) out.me = shape(me, me.rank);
  }
  return out;
}

// Counts a submission against the hourly limits; returns the counts.
async function hit(env, keys, now) {
  const until = Math.floor(now / 3600e3 + 1) * 3600e3;
  const rows = await env.DB.batch(keys.map(function (k) {
    return env.DB.prepare("INSERT INTO hits (k, n, until) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN hits.until <= ? THEN 1 ELSE hits.n + 1 END, until = CASE WHEN hits.until <= ? THEN excluded.until ELSE hits.until END RETURNING n")
      .bind(k, until, now, now);
  }));
  if (Math.random() < 0.02) await env.DB.prepare("DELETE FROM hits WHERE until <= ?").bind(now).run();
  return rows.map(function (r) { return r.results[0].n; });
}

async function submit(req, env) {
  const text = await req.text();
  if (text.length > LIMITS.bodyBytes) return json(413, { ok: false, reason: "too_large" });
  let body;
  try { body = JSON.parse(text); } catch (e) { return json(400, { ok: false, reason: "bad_json" }); }
  const pid = String(body.pid || "");
  if (!PLAYER.test(pid)) return json(400, { ok: false, reason: "bad_player" });
  const nick = cleanNick(body.nick);
  if (nick === null) return json(400, { ok: false, reason: "bad_nick" });
  const now = Date.now();
  // Every request counts toward the hourly limits, including ones that turn out invalid.
  const ip = req.headers.get("CF-Connecting-IP") || "";
  const counts = await hit(env, ["ip:" + (await sha((env.HASH_SALT || "phd-sim") + ":" + ip)).slice(0, 16), "p:" + pid], now);
  if (counts[0] > LIMITS.perIpHour || counts[1] > LIMITS.perPlayerHour) return json(429, { ok: false, reason: "rate_limited" });
  const checked = checkResult(body.result, body.code, now);
  if (!checked.value) return json(checked.reason === "daily_out_of_range" ? 400 : 422, { ok: false, reason: checked.reason === "daily_out_of_range" ? checked.reason : "invalid" });
  const v = checked.value;
  const player = await env.DB.prepare("SELECT banned FROM players WHERE pid = ?").bind(pid).first();
  if (player && player.banned) return json(403, { ok: false, reason: "banned" });

  // The run's choices are kept for a possible replay check later; the same run goes on only once.
  const rec = body.record && typeof body.record === "object" && Array.isArray(body.record.inputs) ? body.record : null;
  let recText = rec ? JSON.stringify(rec) : null;
  if (recText && recText.length > LIMITS.recordBytes) recText = null;
  const runHash = await sha(rec ? "run|" + rec.seed + "|" + rec.runIndex + "|" + JSON.stringify(rec.inputs) : "code|" + pid + "|" + body.code + "|" + v.score);
  const at = new Date(now).toISOString();
  const id = (await sha(runHash + "|" + now)).slice(0, 16);
  const pub = (await sha("pub:" + pid)).slice(0, 10);
  const ins = await env.DB.prepare("INSERT INTO entries (id, pid, score, beats, ending, title, grad, years, pubs, cites, h, day, code, lang, at, run_hash, record) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(run_hash) DO NOTHING")
    .bind(id, pid, v.score, v.beats, v.ending, v.title, v.grad, v.years, v.pubs, v.cites, v.h, v.day, body.code, body.lang === "zh" ? "zh" : "en", at, runHash, recText).run();
  if (!ins.meta || !ins.meta.changes) return json(409, { ok: false, reason: "duplicate" });

  const boards = [["all", "all", null]].concat(v.day ? [["daily", "d:" + v.day, v.day]] : []);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO players (pid, pub, nick, created) VALUES (?, ?, ?, ?) ON CONFLICT(pid) DO UPDATE SET nick = excluded.nick").bind(pid, pub, nick, at)
  ].concat(boards.map(function (b) {
    return env.DB.prepare("INSERT INTO best (board, pid, entry_id, score, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(board, pid) DO UPDATE SET entry_id = excluded.entry_id, score = excluded.score, at = excluded.at WHERE excluded.score > best.score")
      .bind(b[1], pid, id, v.score, at);
  })));
  const out = { ok: true, entry: { id: id, pub: pub, nick: nick, score: v.score, ending: v.ending, day: v.day || "" }, best: {}, ranks: {} };
  for (const b of boards) {
    const place = await placeOf(env, b[1], pid);
    out.best[b[0]] = !!place && place.entry_id === id;
    out.ranks[b[0]] = place ? { rank: place.rank, of: place.total, day: b[2] } : null;
  }
  return json(200, out);
}

function sameToken(a, b) {
  a = String(a || ""); b = String(b || "");
  if (b.length < 16 || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function admin(req, env) {
  let body;
  try { body = JSON.parse(await req.text()); } catch (e) { return json(400, { ok: false, reason: "bad_json" }); }
  if (!sameToken(body.token, env.ADMIN_TOKEN)) return json(403, { ok: false, reason: "forbidden" });
  const p = await env.DB.prepare("SELECT pid FROM players WHERE pub = ?").bind(String(body.pub || "")).first();
  if (!p) return json(404, { ok: false, reason: "unknown_player" });
  switch (body.action) {
    case "rename": {
      const nick = cleanNick(body.nick);
      if (nick === null) return json(400, { ok: false, reason: "bad_nick" });
      await env.DB.prepare("UPDATE players SET nick = ? WHERE pid = ?").bind(nick, p.pid).run();
      return json(200, { ok: true });
    }
    case "remove":
    case "ban": {
      const r = await env.DB.batch([env.DB.prepare("DELETE FROM best WHERE pid = ?").bind(p.pid)]
        .concat(body.action === "ban" ? [env.DB.prepare("UPDATE players SET banned = 1 WHERE pid = ?").bind(p.pid)] : []));
      return json(200, { ok: true, removedFrom: r[0].meta.changes });
    }
    case "unban":
      await env.DB.prepare("UPDATE players SET banned = 0 WHERE pid = ?").bind(p.pid).run();
      return json(200, { ok: true });
  }
  return json(400, { ok: false, reason: "unknown_action" });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return withCors(req, env, new Response(null, { status: 204 }));
    try {
      await ensureSchema(env);
      if (url.pathname === "/api/board" && req.method === "GET") {
        const kind = url.searchParams.get("kind") === "daily" ? "daily" : "all";
        const day = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("day") || "") ? url.searchParams.get("day") : utcDay();
        const me = PLAYER.test(url.searchParams.get("me") || "") ? url.searchParams.get("me") : null;
        // The shared view of a board is cached for 20 seconds; a player's own place isn't.
        const cache = !me && typeof caches !== "undefined" ? caches.default : null;
        const key = cache ? new Request(url.origin + url.pathname + "?kind=" + kind + "&day=" + day + "&limit=" + (url.searchParams.get("limit") || "")) : null;
        let res = cache ? await cache.match(key) : null;
        if (!res) {
          res = json(200, await readBoard(env, kind, day, Number(url.searchParams.get("limit")) || 50, me), me ? 0 : 20);
          if (cache) ctx.waitUntil(cache.put(key, res.clone()));
        }
        return withCors(req, env, res);
      }
      if (url.pathname === "/api/submit" && req.method === "POST") return withCors(req, env, await submit(req, env));
      if (url.pathname === "/api/admin" && req.method === "POST") return await admin(req, env);
      if (url.pathname === "/" || url.pathname === "/api") return json(200, { ok: true, name: "PhD Simulator leaderboard" });
      return json(404, { ok: false, reason: "not_found" });
    } catch (e) {
      console.error("leaderboard error:", e && e.stack || e);
      return withCors(req, env, json(500, { ok: false, reason: "server_error" }));
    }
  }
};
