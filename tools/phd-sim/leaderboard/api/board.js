// GET /api/board?kind=daily&day=YYYY-MM-DD&limit=50   (kind=all for the all-time board)
// Add &me=<player id> to also get that player's own place (that answer isn't cached).
import { cors, send, utcDay } from "../lib/http.js";
import { store } from "../lib/redis.js";
import { readBoard } from "../lib/boards.js";

export default async function handler(req, res) {
  if (cors(req, res, "GET")) return;
  if (req.method !== "GET") return send(res, 405, { ok: false, reason: "method" });
  const q = new URL(req.url, "http://x").searchParams;
  const kind = q.get("kind") === "daily" ? "daily" : "all";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(q.get("day") || "") ? q.get("day") : utcDay();
  const me = /^[a-z0-9]{16,40}$/.test(q.get("me") || "") ? q.get("me") : null;
  try {
    const out = await readBoard(store(), kind, day, Number(q.get("limit")) || 50, me);
    return send(res, 200, Object.assign({ ok: true }, out), me ? 0 : 20);
  } catch (e) {
    console.error("board failed:", e);
    return send(res, 500, { ok: false, reason: "server_error" });
  }
}
