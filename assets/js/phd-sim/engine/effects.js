// Applies outcome objects (effects, flags, statuses, schedules…) and reports what changed.
import { parseValue, clamp, asList } from "./util.js";
import { STAT_IDS, span, WEEKS_PER_TURN } from "./state.js";
import { hasTrait } from "./derived.js";
import { fill } from "./templating.js";
import { unlock } from "./achievements.js";
import { currentStage, addProgress, withdrawRevision } from "./projects.js";

const HIDDEN_LINES = {
  advisor_rel: ["Your advisor seems pleased.", "Your advisor seems a little cooler toward you."],
  labmates_rel: ["Your labmates warm to you.", "The lab feels a little colder."],
  family_rel: ["Your family feels closer.", "Your family misses you."],
  friends_rel: ["Your friends are glad to see you.", "Your friends haven't heard from you in a while."],
  network: ["More people in the field know your name.", "You feel a bit out of the loop."],
  taste: ["Your sense for good problems sharpens.", "You second-guess your research instincts."],
  coding: ["Your code feels less fragile than last month.", "Your code feels shakier."],
  writing: ["Your writing feels a little sharper.", "Your writing feels clumsier."],
  presenting: ["You feel steadier in front of a room.", "Presenting feels harder than it used to."],
  knowledge: ["You understand the field a little better.", "You feel behind on the literature."]
};

// Stats the player can see: shown as numbers after a choice. Everything else is hinted.
export const VISIBLE_KEYS = ["energy", "sanity", "health", "citations"];

export function rollRange(G, v) {
  const p = parseValue(v);
  if (!p) return 0;
  if (p.bool !== undefined) return p.bool;
  return G.rng.triangular(p.center, p.spread);
}

export function sanityLossScale(G) {
  let k = 1;
  if (hasTrait(G, "resilient")) k *= 0.7;
  if (hasTrait(G, "anxious")) k *= 1.2;
  if (hasTrait(G, "first_gen")) k *= 0.9;
  if (hasTrait(G, "parent")) k *= 0.9;
  return k;
}

export function addStat(G, id, amount) {
  const s = G.state;
  if (id === "citations") {
    amount = Number(typeof amount === "string" ? rollRange(G, amount) : amount) || 0;
    s.bonusCitations = Math.max(0, (s.bonusCitations || 0) + amount);
    return amount;
  }
  if (STAT_IDS.indexOf(id) < 0) return 0;
  if (typeof amount === "string") amount = rollRange(G, amount);
  amount = Number(amount);
  if (!isFinite(amount)) return 0;
  if (id === "sanity" && amount < 0) amount = amount * sanityLossScale(G);
  const old = s.stats[id] || 0;
  s.stats[id] = clamp(old + amount, 0, 100);
  if (id === "sanity") s.telemetry.min_sanity = Math.min(s.telemetry.min_sanity, s.stats.sanity);
  return Math.round((s.stats[id] - old) * 10) / 10;
}

export function addStatus(G, id, turns) {
  const s = G.state;
  const ex = s.statuses.find(function (x) { return x.id === id; });
  if (ex) ex.turns = Math.max(ex.turns, turns || 1);
  else s.statuses.push({ id: id, turns: turns || 1 });
}

export function removeStatus(G, id) {
  G.state.statuses = G.state.statuses.filter(function (x) { return x.id !== id; });
}

export function schedule(G, spec, ctx) {
  asList(spec).forEach(function (sc) {
    if (!sc || !sc.event) return;
    if (sc.chance !== undefined && !G.rng.chance(sc.chance)) return;
    const range = Array.isArray(sc.in) ? sc.in : [sc.in || 1, sc.in || 1];
    const at = G.state.turn + Math.max(1, span(G.rng.int(range[0], range.length > 1 ? range[1] : range[0])));
    G.state.queue.push({ event: sc.event, turn: at, ctx: { projectId: ctx.projectId, paperId: ctx.paperId, tok: ctx.tok } });
  });
}

function findProject(G, ctx) {
  return ctx.projectId ? G.state.projects.find(function (p) { return p.id === ctx.projectId; }) : null;
}
function findPaper(G, ctx) {
  return ctx.paperId ? G.state.papers.find(function (p) { return p.id === ctx.paperId; }) : null;
}

function projectEffect(G, key, raw, ctx, res, hidden) {
  const p = findProject(G, ctx);
  if (!p) return;
  const sub = key.slice(8);
  if (sub === "progress") {
    const n = rollRange(G, raw);
    const st = currentStage(G, p);
    if (st.kind === "wait") return;
    // Content values are points of the whole progress bar.
    addProgress(G, p, n, function (line) { res.notes.push(line); });
    res.visible.push({ stat: "progress", label: p.short, amount: n });
  } else if (sub.indexOf("quality.") === 0) {
    const c = sub.slice(8);
    const n = rollRange(G, raw);
    if (p.bonus[c] === undefined) return;
    p.bonus[c] += n;
    hidden.push({ line: n >= 0 ? "The project got stronger." : "The project got weaker.", amount: Math.abs(n) });
  } else if (sub === "delay") {
    const n = rollRange(G, raw);
    const st = currentStage(G, p);
    if (st.kind === "wait") p.wait = Math.max(0, p.wait + Math.round(n));
    else if (n > 0) p.pause += span(n);
    res.visible.push({ stat: "delay", label: p.short, amount: Math.round(n) * WEEKS_PER_TURN });
  } else if (sub === "pivot") {
    withdrawRevision(G, p);
    p.stageIdx = 0; p.progress = 0; p.revise = false;
    p.q.S = { s: 0, n: 0 }; p.q.C = { s: 0, n: 0 };
    p.bonus.N = p.bonus.N * 0.5;
    p.target = null;
    G.state.counters.pivots = (G.state.counters.pivots || 0) + 1;
    res.notes.push(p.short + " goes back to the idea stage.");
  } else if (sub === "abandon") {
    withdrawRevision(G, p);
    p.status = "shelved";
    res.notes.push(p.short + " is shelved.");
  }
}

function paperEffect(G, key, raw, ctx, res, hidden) {
  const p = findPaper(G, ctx);
  if (!p) return;
  const sub = key.slice(6);
  if (sub === "score") {
    const n = rollRange(G, raw);
    p.scoreBonus = (p.scoreBonus || 0) + n;
    hidden.push({ line: n >= 0 ? "That may help with the reviewers." : "The reviewers may not like that.", amount: Math.abs(n) });
  } else if (sub === "desk_reject") {
    if (p.status === "under_review") p.deskPending = true;
  } else if (sub === "citations") {
    const n = rollRange(G, raw);
    p.bonusCites = (p.bonusCites || 0) + n;
    res.visible.push({ stat: "citations", amount: n });
  }
}

export function applyOutcome(G, out, ctx) {
  const s = G.state;
  ctx = ctx || {};
  out = out || {};
  const res = { text: out.text ? fill(out.text, G, ctx) : "", visible: [], hidden: [], notes: [], tip: out.tip || null, ending: null };
  const hiddenDeltas = [];
  const eff = out.effects || {};
  Object.keys(eff).forEach(function (key) {
    const raw = eff[key];
    if (key.indexOf("project.") === 0) return projectEffect(G, key, raw, ctx, res, hiddenDeltas);
    if (key.indexOf("paper.") === 0) return paperEffect(G, key, raw, ctx, res, hiddenDeltas);
    const n = rollRange(G, raw);
    if (key === "days") { s.dayAdj += n; res.visible.push({ stat: "days", amount: n }); return; }
    if (key === "days_next") { s.dayAdjNext += n; res.visible.push({ stat: "days_next", amount: n }); return; }
    if (key === "career_prep") { s.careerPrep += n; return; }
    const d = addStat(G, key, n);
    if (VISIBLE_KEYS.indexOf(key) >= 0) { if (d) res.visible.push({ stat: key, amount: d }); }
    else if (HIDDEN_LINES[key] && d !== 0) {
      const threshold = ["taste", "coding", "writing", "presenting", "knowledge"].indexOf(key) >= 0 ? 2 : 3;
      if (Math.abs(d) >= threshold) hiddenDeltas.push({ line: HIDDEN_LINES[key][d > 0 ? 0 : 1], amount: Math.abs(d) });
    }
  });
  hiddenDeltas.sort(function (a, b) { return b.amount - a.amount; });
  res.hidden = hiddenDeltas.slice(0, 2).map(function (h) { return h.line; });

  asList(out.flag_set).forEach(function (f) { s.flags[f] = true; });
  asList(out.flag_clear).forEach(function (f) { delete s.flags[f]; });
  if (out.counter) Object.keys(out.counter).forEach(function (k) {
    s.counters[k] = (s.counters[k] || 0) + (parseInt(out.counter[k], 10) || 0);
  });
  asList(out.status).forEach(function (st) { if (st && st.add) addStatus(G, st.add, span(st.turns || 1)); });
  asList(out.status_remove).forEach(function (id) { removeStatus(G, id); });
  if (out.trait_add && s.player.traits.indexOf(out.trait_add) < 0) {
    s.player.traits.push(out.trait_add);
    const t = G.D.traitById[out.trait_add];
    res.notes.push("New trait: " + (t ? t.name : out.trait_add) + ".");
  }
  if (out.schedule) schedule(G, out.schedule, ctx);
  // Events can open up an extra option for this turn (or the next, once this turn's focus is chosen).
  asList(out.unlock).forEach(function (id) {
    if (!G.D.opportunityById || !G.D.opportunityById[id]) return;
    const beforeFocus = G.state.stage === "turn_start" || G.state.stage === "start_items";
    const when = beforeFocus ? G.state.turn : G.state.turn + 1;
    G.state.unlocks = (G.state.unlocks || []).concat([{ id: id, turn: when, ctx: { projectId: ctx.projectId, paperId: ctx.paperId, tok: ctx.tok } }]);
    if (beforeFocus) {
      G.state.turnOpps = (G.state.turnOpps || []).filter(function (o) { return o.id !== id; }).concat([{ id: id, ctx: { projectId: ctx.projectId, tok: ctx.tok } }]);
    }
    const def = G.D.opportunityById[id];
    res.notes.push("New option " + (beforeFocus ? "this turn" : "next turn") + ": " + fill(def.label, G, ctx) + ".");
  });
  asList(out.achievement).forEach(function (a) { unlock(G, a); });
  if (out.ending) { s.pendingEnding = out.ending; res.ending = out.ending; }
  return res;
}
