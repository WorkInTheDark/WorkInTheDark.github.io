// Fills {tokens} in event text. Every token is bound once per event (stored in ctx.tok)
// so {labmate} names the same person throughout a card, and saves stay consistent.
import { ordinal } from "./util.js";

const TOKEN_RE = /\{([a-z0-9_]+(?:\.[a-z0-9_]+)?)(?::(\d+)-(\d+))?(?:\|([a-z]+))?\}/gi;

function labmatePick(G, ctx, key, avoid) {
  ctx.tok = ctx.tok || {};
  if (ctx.tok[key]) return ctx.tok[key];
  const lm = G.state.labmates.filter(function (l) { return l.present !== false && l.name !== avoid; });
  const name = lm.length ? G.rng.pick(lm).name : (key === "labmate2" ? "another student" : "a labmate");
  ctx.tok[key] = name;
  return name;
}

function bound(G, ctx, key, fn) {
  ctx.tok = ctx.tok || {};
  if (ctx.tok[key] === undefined) ctx.tok[key] = fn();
  return ctx.tok[key];
}

export function fakePrior(G) {
  const n = G.D.names;
  return G.rng.pick(n.last || ["Smith"]) + " et al. (" + (2023 + Math.floor(G.state.turn / 52)) + ")";
}

export function fill(text, G, ctx) {
  if (text === undefined || text === null) return "";
  ctx = ctx || {};
  const s = G.state;
  const D = G.D;
  return String(text).replace(TOKEN_RE, function (m, key, a, b, filter) {
    let out;
    switch (key) {
      case "player": out = s.player.name; break;
      case "advisor": out = s.advisor ? "Prof. " + s.advisor.surname : "a professor"; break;
      case "advisor.nick": out = s.advisor ? s.advisor.nick : "your future advisor"; break;
      case "labmate": out = labmatePick(G, ctx, "labmate"); break;
      case "labmate2": out = labmatePick(G, ctx, "labmate2", labmatePick(G, ctx, "labmate")); break;
      case "senior": {
        const sorted = s.labmates.filter(function (l) { return l.present !== false; })
          .sort(function (x, y) { return y.year - x.year; });
        out = sorted.length ? sorted[0].name : "a senior student";
        break;
      }
      case "mentee": out = s.mentee ? s.mentee.name : bound(G, ctx, "mentee", function () { return G.rng.pick(D.names.first || ["Sam"]); }); break;
      case "project": {
        const p = ctx.projectId && s.projects.find(function (x) { return x.id === ctx.projectId; });
        out = p ? p.short || p.title : "your project";
        break;
      }
      case "project.topic": {
        const p = ctx.projectId && s.projects.find(function (x) { return x.id === ctx.projectId; });
        const t = p && s.world.topics.find(function (x) { return x.id === p.topic; });
        out = t ? t.name : "your topic";
        break;
      }
      case "topic": {
        out = ctx.topicName || (s.world.topics[0] ? s.world.topics[0].name : "your topic");
        break;
      }
      case "paper": {
        const p = ctx.paperId && s.papers.find(function (x) { return x.id === ctx.paperId; });
        out = p ? p.short || p.title : "your paper";
        break;
      }
      case "venue": {
        const p = ctx.paperId && s.papers.find(function (x) { return x.id === ctx.paperId; });
        out = ctx.venue || (p ? p.venueName : "the conference");
        break;
      }
      case "city": out = ctx.city || bound(G, ctx, "city", function () { return G.rng.pick(D.names.cities || ["Vienna"]); }); break;
      case "company": out = ctx.company || bound(G, ctx, "company", function () { return G.rng.pick(D.names.companies || ["a tech company"]); }); break;
      case "model": out = ctx.model || (s.world.models.length ? s.world.models[s.world.models.length - 1].name : bound(G, ctx, "model", function () { return "the newest frontier model"; })); break;
      case "biglab": out = ctx.biglab || (s.world.models.length ? s.world.models[s.world.models.length - 1].lab : bound(G, ctx, "biglab", function () { return G.rng.pick(D.names.labs || ["a big lab"]); })); break;
      case "committee": out = bound(G, ctx, "committee", function () { return "Prof. " + G.rng.pick(D.names.last || ["Lee"]); }); break;
      case "fake_prior": out = bound(G, ctx, "fake_prior", function () { return fakePrior(G); }); break;
      case "roll": {
        const k = "roll:" + a + "-" + b;
        out = bound(G, ctx, k, function () { return G.rng.int(parseInt(a, 10), parseInt(b, 10)); });
        break;
      }
      default:
        if (key.indexOf("counter.") === 0) {
          const n = s.counters[key.slice(8)] || 0;
          out = filter === "ordinal" ? ordinal(n) : String(n);
          return out;
        }
        return m;
    }
    if (filter === "ordinal" && /^\d+$/.test(String(out))) out = ordinal(parseInt(out, 10));
    return String(out);
  });
}
