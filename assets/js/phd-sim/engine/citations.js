// Citation accrual: each published paper (or preprint) is a small Poisson process.
import { hasTrait } from "./derived.js";
import { TURNS } from "./state.js";

export function setCiteMean(G, p) {
  const cfg = G.D.config.citations;
  const s = G.state;
  const base = cfg.venue_base[p.tier] || 4;
  const topic = s.world.topics.find(function (t) { return t.id === p.topic; });
  const hype = topic ? topic.hype : 50;
  const hypeMult = 0.5 + (hype / 100) * 1.5;
  let mean = base * Math.exp((p.Q - 60) / 20) * hypeMult;
  if (hasTrait(G, "extremely_online")) mean *= 1.3;
  if (!p.firstAuthor) mean *= 0.8;
  p.citeMean = mean;
}

export function rollBreakout(G, p) {
  const s = G.state;
  const topic = s.world.topics.find(function (t) { return t.id === p.topic; });
  const hype = topic ? topic.hype : 50;
  const chance = G.D.config.citations.breakout_chance * (p.Q / 60) * (hype / 50);
  if (G.rng.chance(chance)) {
    p.breakout = G.rng.int(5, 20);
    return true;
  }
  return false;
}

export function accrueCitations(G) {
  const s = G.state;
  const cfg = G.D.config.citations;
  const net = 0.8 + (s.stats.network || 0) / 250;
  s.papers.forEach(function (p) {
    const accepted = p.status === "accepted";
    if (p.superseded || (!accepted && !p.preprint)) return;
    if (!p.citeMean) setCiteMean(G, p);
    const start = accepted ? p.pubTurn : p.submittedTurn;
    const yr = (s.turn - start) / TURNS;
    if (yr < 0) return;
    const ramp = yr < 1 ? 0.4 : yr < 2 ? 0.8 : Math.max(0.5, 1 - 0.03 * (yr - 2));
    const mean = p.citeMean * ramp / TURNS * (accepted ? 1 : cfg.preprint_factor) * net * (p.breakout || 1);
    p.citations = (p.citations || 0) + G.rng.poisson(mean);
  });
}
