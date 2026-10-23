// Storage: Upstash Redis over its REST API (no client library), or an in-memory stand-in for local
// development and tests. Both take commands as arrays: cmd(["ZADD", key, score, member]).
import { REDIS_URL, REDIS_TOKEN } from "./config.js";

function upstash(url, token) {
  async function post(path, body) {
    const r = await fetch(url + path, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error("redis: " + (j.error || r.status));
    return j;
  }
  return {
    async cmd(args) { return (await post("", args)).result; },
    async pipe(cmds) {
      if (!cmds.length) return [];
      const out = await post("/pipeline", cmds);
      return out.map(function (x) { if (x.error) throw new Error("redis: " + x.error); return x.result; });
    }
  };
}

// Just the commands the leaderboard uses, with Redis's semantics and reply shapes.
export function memoryStore() {
  const kv = new Map(), exp = new Map();
  const alive = function (k) { if (exp.has(k) && exp.get(k) <= Date.now()) { kv.delete(k); exp.delete(k); } return kv.has(k); };
  const zset = function (k) { if (!alive(k)) kv.set(k, new Map()); return kv.get(k); };
  const sorted = function (k) {
    return Array.from(zset(k).entries()).sort(function (a, b) { return b[1] - a[1] || (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0); });
  };
  const run = function (a) {
    const op = String(a[0]).toUpperCase(), k = a[1];
    switch (op) {
      case "GET": return alive(k) ? kv.get(k) : null;
      case "MGET": return a.slice(1).map(function (x) { return alive(x) ? kv.get(x) : null; });
      case "SET": {
        const nx = a.indexOf("NX") > 0, ex = a.indexOf("EX");
        if (nx && alive(k)) return null;
        kv.set(k, String(a[2]));
        if (ex > 0) exp.set(k, Date.now() + Number(a[ex + 1]) * 1000); else exp.delete(k);
        return "OK";
      }
      case "DEL": { let n = 0; a.slice(1).forEach(function (x) { if (alive(x)) { kv.delete(x); n++; } }); return n; }
      case "EXISTS": return alive(k) ? 1 : 0;
      case "INCR": { const v = (alive(k) ? Number(kv.get(k)) : 0) + 1; kv.set(k, String(v)); return v; }
      case "EXPIRE": if (alive(k)) { exp.set(k, Date.now() + Number(a[2]) * 1000); return 1; } return 0;
      case "SADD": { if (!alive(k)) kv.set(k, new Set()); let n = 0; a.slice(2).forEach(function (m) { if (!kv.get(k).has(m)) { kv.get(k).add(m); n++; } }); return n; }
      case "SMEMBERS": return alive(k) ? Array.from(kv.get(k)) : [];
      case "ZADD": { const z = zset(k); const isNew = !z.has(a[3]); z.set(a[3], Number(a[2])); return isNew ? 1 : 0; }
      case "ZSCORE": { if (!alive(k)) return null; const v = kv.get(k).get(a[2]); return v === undefined ? null : String(v); }
      case "ZREM": { if (!alive(k)) return 0; let n = 0; a.slice(2).forEach(function (m) { if (kv.get(k).delete(m)) n++; }); return n; }
      case "ZCARD": return alive(k) ? kv.get(k).size : 0;
      case "ZREVRANK": { if (!alive(k)) return null; const i = sorted(k).findIndex(function (e) { return e[0] === a[2]; }); return i < 0 ? null : i; }
      case "ZREVRANGE": {
        if (!alive(k)) return [];
        const all = sorted(k), from = Number(a[2]), to = Number(a[3]) < 0 ? all.length - 1 : Number(a[3]);
        const part = all.slice(from, to + 1);
        return String(a[4] || "").toUpperCase() === "WITHSCORES" ? part.flatMap(function (e) { return [e[0], String(e[1])]; }) : part.map(function (e) { return e[0]; });
      }
    }
    throw new Error("memory store: " + op + " not supported");
  };
  return {
    async cmd(args) { return run(args); },
    async pipe(cmds) { return cmds.map(run); }
  };
}

let shared = null;
export function store() {
  if (!shared) shared = REDIS_URL && REDIS_TOKEN ? upstash(REDIS_URL.replace(/\/$/, ""), REDIS_TOKEN) : memoryStore();
  return shared;
}
export function useStore(s) { shared = s; }
