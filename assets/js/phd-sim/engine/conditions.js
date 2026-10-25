// Evaluates `when` / `requires` conditions. Binding conditions (project, paper)
// pick a matching object and record its id in ctx so tokens and effects use it.
import { compare, asList } from "./util.js";
import { yearOf, tOf, semesterOf } from "./state.js";
import { statValue, tele, hasStatus, hasTrait } from "./derived.js";
import { currentStage, turnsToDeadline } from "./projects.js";

function inRange(x, v) {
  if (Array.isArray(v)) return x >= v[0] && x <= (v.length > 1 ? v[1] : v[0]);
  if (typeof v === "string") return compare(x, v);
  return x === v;
}

function milestoneValue(G, key) {
  const m = G.state.milestones;
  if (key === "quals") return m.quals;
  if (key === "proposal") return m.proposal;
  if (key === "defense_prep") return hasStatus(G, "defense_prep") ? "active" : "inactive";
  if (key === "graduated") return !!m.graduated;
  return undefined;
}

export function matchProject(G, p, spec) {
  if (!p) return false;
  const status = spec.status || "active";
  if (asList(status).indexOf(p.status) < 0) return false;
  if (spec.first_author !== undefined && !!p.firstAuthor !== !!spec.first_author) return false;
  if (spec.first_author === undefined && !p.firstAuthor) return false;
  if (spec.type && asList(spec.type).indexOf(p.type) < 0) return false;
  const st = currentStage(G, p);
  if (spec.stage && asList(spec.stage).indexOf(st.id) < 0) return false;
  if (spec.stage_kind && st.kind !== spec.stage_kind) return false;
  if (spec.turns_to_deadline !== undefined) {
    const t = turnsToDeadline(G, p);
    if (t === null || t < 0 || !compare(t, spec.turns_to_deadline)) return false;
  }
  return true;
}

export function matchPaper(G, p, spec) {
  if (!p) return false;
  if (spec.status && asList(spec.status).indexOf(p.status) < 0) return false;
  if (spec.tier && asList(spec.tier).indexOf(p.tier) < 0) return false;
  if (spec.submissions !== undefined && !compare(p.submissions || 1, spec.submissions)) return false;
  if (spec.first_author !== undefined && !!p.firstAuthor !== !!spec.first_author) return false;
  return true;
}

function bindProject(G, spec, ctx) {
  const s = G.state;
  if (ctx.projectId) {
    return matchProject(G, s.projects.find(function (p) { return p.id === ctx.projectId; }), spec);
  }
  const cands = s.projects.filter(function (p) { return matchProject(G, p, spec); });
  if (!cands.length) return false;
  ctx.projectId = G.rng.pick(cands).id;
  return true;
}

function bindPaper(G, spec, ctx) {
  const s = G.state;
  if (ctx.paperId) {
    return matchPaper(G, s.papers.find(function (p) { return p.id === ctx.paperId; }), spec);
  }
  const cands = s.papers.filter(function (p) { return matchPaper(G, p, spec); });
  if (!cands.length) return false;
  ctx.paperId = G.rng.pick(cands).id;
  return true;
}

function boundHype(G, ctx) {
  const s = G.state;
  let p = ctx.projectId && s.projects.find(function (x) { return x.id === ctx.projectId; });
  if (!p) p = s.projects.find(function (x) { return x.status === "active"; });
  if (!p) return 50;
  const t = s.world.topics.find(function (x) { return x.id === p.topic; });
  return t ? t.hype : 50;
}

// At a conference for the week (trip.js), where the week is: { kind: talk|poster, talk: before|after|tomorrow,
// days: [1 Sunday … 5 Thursday] }, and what you chose to do that brought the event (did / did_not:
// conference.yml activity ids).
// Events are drawn at the step they happen in, before the week moves on.
function onTrip(trip, v) {
  if (!trip) return false;
  if (v.days && asList(v.days).indexOf(Math.floor((trip.step + 1) / 2) + 1) < 0) return false; // trip.js STEPS: Sunday evening, then two a day
  if (v.did && asList(v.did).indexOf(trip.did) < 0) return false;
  if (v.did_not && asList(v.did_not).indexOf(trip.did) >= 0) return false;
  if (v.kind && asList(v.kind).indexOf(trip.kind) < 0) return false;
  if (v.talk === "before" && trip.step >= trip.talkAt) return false;
  if (v.talk === "after" && trip.step <= trip.talkAt) return false;
  if (v.talk === "tomorrow" && trip.step !== trip.talkAt - 1) return false; // the evening before
  return true;
}

const ORDER = { project: 0, paper: 1 };

export function check(cond, G, ctx) {
  if (!cond) return true;
  ctx = ctx || {};
  const s = G.state;
  const keys = Object.keys(cond).sort(function (a, b) {
    return (a in ORDER ? ORDER[a] : 9) - (b in ORDER ? ORDER[b] : 9);
  });
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const v = cond[key];
    let ok = true;
    switch (key) {
      case "year": ok = inRange(yearOf(s.turn), v); break;
      case "turn": ok = inRange(tOf(s.turn), v); break;
      case "semester": ok = asList(v).indexOf(semesterOf(tOf(s.turn))) >= 0; break;
      case "stat":
        ok = Object.keys(v).every(function (k) { return compare(statValue(G, k), v[k]); });
        break;
      case "has_advisor": ok = !!s.advisor === !!v; break;
      case "advisor": ok = !!s.advisor && asList(v).indexOf(s.advisor.archetype) >= 0; break;
      case "advisor_not": ok = !s.advisor || asList(v).indexOf(s.advisor.archetype) < 0; break;
      case "background": ok = asList(v).indexOf(s.player.background) >= 0; break;
      case "origin": ok = asList(v).indexOf(s.player.origin) >= 0; break;
      case "traits_any": ok = asList(v).some(function (t) { return hasTrait(G, t); }); break;
      case "traits_none": ok = !asList(v).some(function (t) { return hasTrait(G, t); }); break;
      case "flags_all": ok = asList(v).every(function (f) { return !!s.flags[f]; }); break;
      case "flags_any": ok = asList(v).some(function (f) { return !!s.flags[f]; }); break;
      case "flags_none": ok = !asList(v).some(function (f) { return !!s.flags[f]; }); break;
      case "counter":
        ok = Object.keys(v).every(function (k) { return compare(s.counters[k] || 0, v[k]); });
        break;
      case "status_any": ok = asList(v).some(function (x) { return hasStatus(G, x); }); break;
      case "status_none": ok = !asList(v).some(function (x) { return hasStatus(G, x); }); break;
      case "milestone":
        ok = Object.keys(v).every(function (k) {
          const mv = milestoneValue(G, k);
          return typeof v[k] === "boolean" ? mv === v[k] : asList(v[k]).indexOf(mv) >= 0;
        });
        break;
      case "project": ok = bindProject(G, v, ctx); break;
      case "paper": ok = bindPaper(G, v, ctx); break;
      case "world":
        ok = Object.keys(v).every(function (k) {
          if (k === "hiring") return asList(v[k]).indexOf(s.world.hiring) >= 0;
          if (k === "hype") return compare(boundHype(G, ctx), v[k]);
          return true;
        });
        break;
      case "telemetry":
        ok = Object.keys(v).every(function (k) { return compare(tele(G, k), v[k]); });
        break;
      case "trip": ok = onTrip(s.trip, v); break;
      case "chance": ok = G.rng.chance(v); break;
      case "any": ok = asList(v).some(function (c) { return check(c, G, ctx); }); break;
      case "not": ok = !check(v, G, JSON.parse(JSON.stringify(ctx))); break;
      default: ok = true;
    }
    if (!ok) return false;
  }
  return true;
}
