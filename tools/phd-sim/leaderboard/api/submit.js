// POST /api/submit  { pid, nick, lang, record, claim }
// Replays the run from its record and, if it comes out as claimed, puts it on the all-time board
// (and the daily board for a daily run). The stored numbers are the replay's, not the player's.
import { cors, send, readJson, ipKey, utcDay } from "../lib/http.js";
import { cleanNick } from "../lib/nick.js";
import { store } from "../lib/redis.js";
import { overLimit, addRun } from "../lib/boards.js";
import { verify } from "../lib/game.js";
import { LIMITS } from "../lib/config.js";

export default async function handler(req, res) {
  if (cors(req, res, "POST")) return;
  if (req.method !== "POST") return send(res, 405, { ok: false, reason: "method" });
  let body;
  try { body = await readJson(req); } catch (e) { return send(res, e.status || 400, { ok: false, reason: "bad_json" }); }
  const pid = String(body.pid || "");
  if (!/^[a-z0-9]{16,40}$/.test(pid)) return send(res, 400, { ok: false, reason: "bad_player" });
  const nick = cleanNick(body.nick);
  if (nick === null) return send(res, 400, { ok: false, reason: "bad_nick" });
  const record = body.record;
  if (!record || typeof record !== "object") return send(res, 400, { ok: false, reason: "bad_record" });
  const db = store();
  try {
    const limited = await overLimit(db, ipKey(req), pid);
    if (limited) return send(res, 429, { ok: false, reason: limited });
    // Daily runs count for their own day, up to a week late; never for a day that hasn't come.
    if (record.daily) {
      const day = String(record.seed || "").slice(6);
      const today = utcDay(), oldest = utcDay(new Date(Date.now() - LIMITS.dailyLateDays * 864e5));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > today || day < oldest) return send(res, 400, { ok: false, reason: "daily_out_of_range" });
    }
    const v = await verify(record, body.claim);
    if (!v.ok) return send(res, 422, { ok: false, reason: v.reason === "mismatch" || v.reason === "diverged" || v.reason === "unfinished" ? "unverified" : v.reason });
    const runId = record.seed + "|" + record.runIndex + "|" + JSON.stringify(record.inputs);
    const out = await addRun(db, { pid: pid, nick: nick, lang: body.lang, result: v.result, code: v.code, runId: runId });
    return send(res, out.ok ? 200 : 409, out);
  } catch (e) {
    console.error("submit failed:", e);
    return send(res, 500, { ok: false, reason: "server_error" });
  }
}
