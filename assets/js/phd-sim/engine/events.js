// Drawing, presenting and resolving content events.
import { clamp, clone, asList } from "./util.js";
import { yearOf, weeks } from "./state.js";
import { check } from "./conditions.js";
import { fill } from "./templating.js";
import { applyOutcome } from "./effects.js";
import { statValue, hasTrait } from "./derived.js";

export const HOOK_CHANCE = {
  turn: 1, deadline: 0.3, after_submit: 0.2, reviews_in: 0.3, after_accept: 0.35, after_reject: 0.3,
  conference: 1, internship: 0.15, defense_prep: 0.2, defense: 1, job_market: 0.07, model_release: 0.25, graduation: 1
};
const HOOK_MAX = { conference: 1, graduation: 2 };

export function eventEligible(G, ev, ctx, scheduled) {
  const s = G.state;
  const cfg = G.D.config.events;
  if (!scheduled && ev.trigger === "scheduled") return false;
  const seenAt = s.seen[ev.id];
  if (seenAt !== undefined && !scheduled) {
    if (!ev.repeatable) return false;
    if (s.turn - seenAt < weeks(ev.cooldown || cfg.default_cooldown || 6)) return false;
  }
  if (!scheduled && ev.rarity === "legendary" && s.lastLegendaryYear === yearOf(s.turn)) return false;
  return check(ev.when, G, ctx);
}

function novelty(G, ev) {
  const s = G.state;
  const nv = G.D.config.events.novelty;
  if (s.seen[ev.id] !== undefined) return nv.this_run;
  const seenRuns = (G.meta && G.meta.seenRuns) || {};
  const last = seenRuns[ev.id];
  if (last === undefined) return nv.never;
  const d = (s.runIndex || 0) - last;
  if (d <= 1) return nv.last_run;
  if (d === 2) return nv.two_runs;
  return 1;
}

export function eventWeight(G, ev) {
  const s = G.state;
  const cfg = G.D.config.events;
  let w = (cfg.rarity[ev.rarity] || 10) * (ev.weight || 1);
  w *= novelty(G, ev);
  if ((ev.rarity === "rare" || ev.rarity === "legendary") && hasTrait(G, "lucky")) w *= 1.5;
  const recent = s.recentCats.filter(function (r) { return s.turn - r.turn < weeks(cfg.balance_window); })
    .filter(function (r) { return r.cat === ev.category; }).length;
  if (recent >= 2) w *= 0.5;
  else if (recent === 0) w *= 1.3;
  if (ev.category === "wellbeing" && s.stats.sanity < 30) w *= 2;
  return w;
}

export function drawHook(G, hook, baseCtx, count) {
  const pool = G.D.byHook[hook] || [];
  const cands = [];
  pool.forEach(function (ev) {
    const ctx = clone(baseCtx || {});
    if (eventEligible(G, ev, ctx, false)) cands.push({ ev: ev, ctx: ctx });
  });
  const picks = [];
  for (let i = 0; i < count && cands.length; i++) {
    const c = G.rng.weighted(cands, function (x) { return eventWeight(G, x.ev); });
    if (!c) break;
    picks.push({ kind: "event", id: c.ev.id, ctx: c.ctx });
    cands.splice(cands.indexOf(c), 1);
  }
  return picks;
}

export function fireHook(G, hook, baseCtx) {
  const chance = HOOK_CHANCE[hook] === undefined ? 1 : HOOK_CHANCE[hook];
  if (!G.rng.chance(chance)) return [];
  return drawHook(G, hook, baseCtx, HOOK_MAX[hook] || 1);
}

function boundObjectsExist(G, ctx) {
  const s = G.state;
  if (ctx.projectId && !s.projects.some(function (p) { return p.id === ctx.projectId; })) return false;
  if (ctx.paperId && !s.papers.some(function (p) { return p.id === ctx.paperId; })) return false;
  return true;
}

export function arrowsFor(choice) {
  const outs = choice.check ? [choice.success || {}, choice.failure || {}] : [choice];
  const out = [];
  ["energy", "sanity", "health", "citations"].forEach(function (stat) {
    const signs = [];
    let mag = 0;
    outs.forEach(function (o) {
      const v = o.effects && o.effects[stat];
      if (v === undefined) return;
      const m = /^\s*([+-]?\d+(?:\.\d+)?)/.exec(String(v));
      const c = m ? parseFloat(m[1]) : 0;
      if (c !== 0) { signs.push(c > 0 ? 1 : -1); mag = Math.max(mag, Math.abs(c)); }
    });
    if (!signs.length) return;
    const up = signs.indexOf(1) >= 0, down = signs.indexOf(-1) >= 0;
    out.push({ stat: stat, dir: up && down ? "mixed" : up ? "up" : "down", strength: mag >= 10 ? 2 : 1 });
  });
  return out;
}

export function presentEvent(G, item) {
  const s = G.state;
  const ev = G.D.eventById[item.id];
  if (!ev) return null;
  const ctx = item.ctx || {};
  if (!boundObjectsExist(G, ctx)) return null;
  if (item.scheduled && !eventEligible(G, ev, ctx, true)) return null;
  const variants = ev.text.length ? ev.text : [""];
  const text = fill(G.rng.pick(variants), G, ctx);
  const choices = [];
  ev.choices.forEach(function (c, i) {
    if (c.requires && !check(c.requires, G, ctx)) return;
    choices.push({ i: i, label: fill(c.label, G, ctx), tag: c.tag || null, arrows: arrowsFor(c) });
  });
  if (!choices.length) return null;

  s.seen[ev.id] = s.turn;
  s.telemetry.events_seen++;
  s.recentCats.push({ turn: s.turn, cat: ev.category });
  if (s.recentCats.length > 20) s.recentCats.shift();
  if (ev.rarity === "legendary") s.lastLegendaryYear = yearOf(s.turn);
  const meta = G.meta;
  meta.seenRuns = meta.seenRuns || {};
  meta.seenRuns[ev.id] = s.runIndex || 0;
  meta.codex = meta.codex || {};
  meta.codex.events = meta.codex.events || {};
  const cx = meta.codex.events[ev.id] = meta.codex.events[ev.id] || { n: 0, o: {} };
  cx.n++;

  s.current = { id: ev.id, ctx: ctx };
  return {
    type: "event",
    id: ev.id,
    title: fill(ev.title, G, ctx),
    category: ev.category,
    rarity: ev.rarity,
    text: text,
    choices: choices
  };
}

export function checkChance(G, chk) {
  const spread = chk.spread || 20;
  return clamp(0.5 + (statValue(G, chk.stat) - chk.vs) / (2 * spread), 0.05, 0.95);
}

export function resolveEvent(G, choiceIndex) {
  const s = G.state;
  const cur = s.current;
  const ev = cur && G.D.eventById[cur.id];
  if (!ev) return { text: "", visible: [], hidden: [], notes: [] };
  const c = ev.choices[choiceIndex] || ev.choices[0];
  let out = c;
  let success = null;
  if (c.check) {
    success = G.rng.chance(checkChance(G, c.check));
    out = (success ? c.success : c.failure) || {};
  }
  const res = applyOutcome(G, out, cur.ctx);
  res.success = success;
  res.choiceLabel = fill(c.label, G, cur.ctx);
  const cx = G.meta.codex.events[ev.id];
  if (cx) cx.o[String(choiceIndex) + (success === false ? "f" : "")] = res.text || true;
  s.current = null;
  return res;
}

export function flavorLine(G) {
  const lines = G.D.flavor.filter(function (f) { return !f.when || check(f.when, G, {}); });
  if (!lines.length) return null;
  const f = G.rng.pick(lines);
  return fill(f.text, G, {});
}
