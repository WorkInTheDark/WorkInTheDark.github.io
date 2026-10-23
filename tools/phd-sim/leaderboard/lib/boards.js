// The boards in Redis. Each board keeps one entry per player, their best:
//   b:all, b:d:<day>          sorted sets, player id -> ranking score
//   best:all:<pid>, best:d:<day>:<pid> -> entry id      e:<id> -> the entry (JSON)
//   nick:<pid> -> current nickname    pub:<pubId> -> pid    days:<pid> -> days played
//   run:<hash> -> entry id (a run goes on the boards once)    ban:<pid>    rl:* rate limits
import { LIMITS } from "./config.js";
import { publicId, sha } from "./http.js";

const YEAR = 365 * 24 * 3600;
const EPOCH = Date.UTC(2026, 0, 1);

// Higher score first; between equal scores, whoever got there first.
function rankScore(score, now) {
  return Math.round(score * 10) * 1e10 + (9e9 - Math.floor((now - EPOCH) / 1000));
}

const boardKey = function (kind, day) { return kind === "daily" ? "b:d:" + day : "b:all"; };
const bestKey = function (kind, day, pid) { return kind === "daily" ? "best:d:" + day + ":" + pid : "best:all:" + pid; };

export async function overLimit(db, ip, pid) {
  const hour = Math.floor(Date.now() / 3600e3);
  const r = await db.pipe([["INCR", "rl:ip:" + ip + ":" + hour], ["EXPIRE", "rl:ip:" + ip + ":" + hour, 3600],
    ["INCR", "rl:p:" + pid + ":" + hour], ["EXPIRE", "rl:p:" + pid + ":" + hour, 3600], ["EXISTS", "ban:" + pid]]);
  if (r[4]) return "banned";
  if (r[0] > LIMITS.perIpHour || r[2] > LIMITS.perPlayerHour) return "rate_limited";
  return null;
}

// Stores a verified run and moves the player's bests. Returns their ranks afterwards.
export async function addRun(db, o) {
  const now = Date.now();
  const runKey = "run:" + sha(o.runId).slice(0, 32);
  const id = sha(o.runId + ":" + now).slice(0, 16);
  if ((await db.cmd(["SET", runKey, id, "NX", "EX", YEAR])) === null) return { ok: false, reason: "duplicate" };
  const pub = publicId(o.pid);
  const r = o.result;
  const entry = { id: id, pub: pub, score: r.score, beats: r.beats, ending: r.ending, title: r.title, grad: r.graduated ? 1 : 0,
    years: r.years, pubs: r.pubs, cites: r.citations, h: r.h, day: r.daily || "", code: o.code, at: new Date(now).toISOString(), lang: o.lang === "zh" ? "zh" : "en" };
  const rs = rankScore(r.score, now);
  const boards = [["all", ""]].concat(r.daily ? [["daily", r.daily]] : []);
  const before = await db.pipe(boards.map(function (b) { return ["ZSCORE", boardKey(b[0], b[1]), o.pid]; }));
  const cmds = [["SET", "e:" + id, JSON.stringify(entry)], ["SET", "nick:" + o.pid, o.nick], ["SET", "pub:" + pub, o.pid]];
  if (r.daily) cmds.push(["SADD", "days:" + o.pid, r.daily]);
  const improved = {};
  boards.forEach(function (b, i) {
    if (before[i] === null || rs > Number(before[i])) {
      improved[b[0]] = true;
      cmds.push(["ZADD", boardKey(b[0], b[1]), rs, o.pid], ["SET", bestKey(b[0], b[1], o.pid), id]);
    }
  });
  await db.pipe(cmds);
  const ranks = await db.pipe(boards.flatMap(function (b) { return [["ZREVRANK", boardKey(b[0], b[1]), o.pid], ["ZCARD", boardKey(b[0], b[1])]]; }));
  const out = { ok: true, entry: entry, best: improved, ranks: {} };
  boards.forEach(function (b, i) { out.ranks[b[0]] = { rank: ranks[2 * i] === null ? null : ranks[2 * i] + 1, of: ranks[2 * i + 1], day: b[1] || null }; });
  return out;
}

async function entriesFor(db, kind, day, pids) {
  if (!pids.length) return [];
  const keys = await db.pipe(pids.map(function (p) { return ["GET", bestKey(kind, day, p)]; }).concat(pids.map(function (p) { return ["GET", "nick:" + p]; })));
  const ids = keys.slice(0, pids.length);
  const nicks = keys.slice(pids.length);
  const raw = await db.cmd(["MGET"].concat(ids.map(function (x) { return "e:" + x; })));
  return pids.map(function (p, i) {
    const e = raw[i] ? JSON.parse(raw[i]) : null;
    return e ? Object.assign(e, { nick: nicks[i] || "" }) : null;
  });
}

// The top of a board, and the asking player's own place when they pass their id.
export async function readBoard(db, kind, day, limit, pid) {
  const key = boardKey(kind, day);
  const n = Math.max(1, Math.min(LIMITS.boardSize, limit || 50));
  const [flat, total] = await db.pipe([["ZREVRANGE", key, 0, n - 1], ["ZCARD", key]]);
  const top = await entriesFor(db, kind, day, flat);
  const entries = [];
  top.forEach(function (e, i) { if (e) entries.push(Object.assign({ rank: i + 1 }, e)); });
  const out = { kind: kind, day: kind === "daily" ? day : null, total: total, entries: entries };
  if (pid) {
    const rank = await db.cmd(["ZREVRANK", key, pid]);
    if (rank !== null) out.me = Object.assign({ rank: rank + 1 }, (await entriesFor(db, kind, day, [pid]))[0]);
  }
  return out;
}

// Admin: take a player off every board (and optionally ban them), or rename them.
export async function adminAct(db, action, pub, value) {
  const pid = await db.cmd(["GET", "pub:" + pub]);
  if (!pid) return { ok: false, reason: "unknown_player" };
  if (action === "rename") { await db.cmd(["SET", "nick:" + pid, value || ""]); return { ok: true }; }
  if (action === "unban") { await db.cmd(["DEL", "ban:" + pid]); return { ok: true }; }
  if (action === "remove" || action === "ban") {
    const days = await db.cmd(["SMEMBERS", "days:" + pid]);
    await db.pipe([["ZREM", "b:all", pid]].concat(days.map(function (d) { return ["ZREM", "b:d:" + d, pid]; })).concat(action === "ban" ? [["SET", "ban:" + pid, "1"]] : []));
    return { ok: true, removedFrom: 1 + days.length };
  }
  return { ok: false, reason: "unknown_action" };
}
