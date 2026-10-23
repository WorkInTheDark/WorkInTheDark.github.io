// Small helpers that work both on Vercel and with node:http in dev-server.mjs.
import { createHash } from "node:crypto";
import { ORIGINS, SALT } from "./config.js";

export function sha(s) { return createHash("sha256").update(String(s)).digest("hex"); }

// Allows the game's pages to call the API; answers the browser's preflight. Returns true when done.
export function cors(req, res, methods) {
  const origin = req.headers.origin || "";
  if (ORIGINS.indexOf(origin) >= 0 || ORIGINS.indexOf("*") >= 0) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", methods + ", OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return true; }
  return false;
}

export function send(res, status, body, cacheSeconds) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cacheSeconds ? "public, max-age=0, s-maxage=" + cacheSeconds + ", stale-while-revalidate=" + cacheSeconds * 2 : "no-store");
  res.end(JSON.stringify(body));
}

// The JSON body, read from the stream unless the platform already parsed it. Capped at 1 MB.
export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > 1024 * 1024) throw Object.assign(new Error("too large"), { status: 413 });
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

// Only a salted hash of the address is kept, for rate limits.
export function ipKey(req) {
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || (req.socket && req.socket.remoteAddress) || "";
  return sha(SALT + ":" + ip).slice(0, 16);
}

// What other players see instead of a player's private id.
export function publicId(pid) { return sha("pub:" + pid).slice(0, 10); }

export function utcDay(d) { return (d || new Date()).toISOString().slice(0, 10); }
