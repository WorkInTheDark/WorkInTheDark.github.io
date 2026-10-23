// POST /api/admin  { token, action: "remove" | "ban" | "unban" | "rename", pub, nick }
// For cleaning up the boards; see admin.mjs. Off unless ADMIN_TOKEN is set.
import { timingSafeEqual } from "node:crypto";
import { send, readJson } from "../lib/http.js";
import { store } from "../lib/redis.js";
import { adminAct } from "../lib/boards.js";
import { cleanNick } from "../lib/nick.js";
import { ADMIN_TOKEN } from "../lib/config.js";

function sameToken(a) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(ADMIN_TOKEN);
  return ADMIN_TOKEN.length >= 16 && x.length === y.length && timingSafeEqual(x, y);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { ok: false, reason: "method" });
  let body;
  try { body = await readJson(req); } catch (e) { return send(res, 400, { ok: false, reason: "bad_json" }); }
  if (!sameToken(body.token)) return send(res, 403, { ok: false, reason: "forbidden" });
  try {
    const nick = body.action === "rename" ? cleanNick(body.nick) : null;
    if (body.action === "rename" && nick === null) return send(res, 400, { ok: false, reason: "bad_nick" });
    return send(res, 200, await adminAct(store(), String(body.action || ""), String(body.pub || ""), nick));
  } catch (e) {
    console.error("admin failed:", e);
    return send(res, 500, { ok: false, reason: "server_error" });
  }
}
