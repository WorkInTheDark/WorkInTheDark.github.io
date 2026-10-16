// Submission, peer review, the rebuttal mini-game, and decisions.
import { clamp, asList } from "./util.js";
import { fill } from "./templating.js";
import { components, qualityFor, autoTarget, nextDeadline } from "./projects.js";
import { hasTrait } from "./derived.js";
import { span } from "./state.js";
import { unlock } from "./achievements.js";

// One response per reviewer, covering all of their concerns. Clarify is the default.
export const RESPONSES = [
  { id: "clarify", label: "Clarify", desc: "Point to what the paper already says. Works when they misread." },
  { id: "concede", label: "Concede and promise fixes", desc: "Safe for minor points. You must deliver them in the camera-ready." },
  { id: "experiment", label: "Run new experiments", days: 2, desc: "Strong for soundness concerns. Costs 2 days and Energy; results can disappoint." },
  { id: "pushback", label: "Push back politely", desc: "Good when they're wrong and open-minded. Risky otherwise." },
  { id: "passive", label: "Passive-aggressive reply", desc: "Satisfying to write. Almost never a good idea." },
  { id: "flag", label: "Flag it as LLM-written", llmOnly: true, desc: "Ask the area chair to discount this review. Only offered when a review reads that way." }
];

export function makePaper(G, p, opts) {
  const s = G.state;
  const v = G.D.venueById[p.target.venueId];
  const c = v.cycles[p.target.cycle];
  const comps = components(G, p);
  const Q = qualityFor(G, comps, v.id);
  p.submissions++;
  const paper = {
    id: "x" + s.nextId++,
    projectId: p.id,
    title: p.title,
    short: p.short,
    type: p.type,
    topic: p.topic,
    venueId: v.id,
    venueName: c.name,
    tier: v.tier,
    journal: !!v.journal,
    cycle: p.target.cycle,
    submittedTurn: s.turn,
    reviewsTurn: s.turn + span(c.reviews_in),
    decisionTurn: s.turn + span(c.decision_in),
    conferenceTurn: c.conference_in ? s.turn + span(c.conference_in) : null,
    rebuttal: !!c.rebuttal,
    rr: !!v.revise_resubmit,
    round: 1,
    comps: comps,
    Q: Q,
    fixedComp: p.fixedComp,
    status: "under_review",
    reviews: null,
    rebutted: false,
    preprint: !!(opts && opts.preprint),
    firstAuthor: p.firstAuthor,
    submissions: p.submissions,
    citations: 0,
    citeMean: 0,
    pubTurn: null,
    breakout: 1,
    bonusCites: 0,
    scoreBonus: 0,
    promises: 0
  };
  // One citation stream per project: earlier versions of this work hand their citations on.
  s.papers.forEach(function (old) {
    if (old.projectId === p.id && !old.superseded && old !== paper) {
      paper.citations += old.citations || 0;
      paper.bonusCites += old.bonusCites || 0;
      old.citations = 0;
      old.bonusCites = 0;
      old.superseded = paper.id;
    }
  });
  s.papers.push(paper);
  p.status = "submitted";
  p.paperId = paper.id;
  p.revise = false;
  p.submitting = false;
  p.fixedComp = null;
  s.telemetry.submissions++;
  if (p.submissions > 1) s.telemetry.resubmissions++;
  return paper;
}

function pickPersona(G) {
  return G.rng.weighted(G.D.reviews.personas, function (pp) { return pp.weight === undefined ? 1 : pp.weight; });
}

function scoreOf(raw) {
  return clamp(Math.round((raw - 20) / 15), 1, 5);
}

export function generateReviews(G, paper) {
  const cfg = G.D.config.reviews;
  const D = G.D;
  const reviews = [];
  for (let i = 0; i < 3; i++) {
    const persona = pickPersona(G) || { id: "plain", bias: 0, openness: 0.8, openers: ["The paper studies an interesting problem."] };
    const raw = paper.Q + (persona.bias || 0) + G.rng.normal(0, cfg.reviewer_sigma) + (paper.scoreBonus || 0);
    const nConcerns = clamp(2 + (raw < 60 ? 1 : 0) + (G.rng.chance(0.3) ? 1 : 0), 1, 4);
    const pool = D.reviews.concerns.slice();
    const concerns = [];
    const ctx = { tok: {}, topicName: (G.state.world.topics.find(function (t) { return t.id === paper.topic; }) || {}).name, venue: paper.venueName };
    for (let k = 0; k < nConcerns && pool.length; k++) {
      const def = G.rng.weighted(pool, function (cd) {
        let w = cd.component === "fit" ? 0.4 : Math.max(0.3, (75 - paper.comps[cd.component]) / 25);
        if (asList(cd.personas).indexOf(persona.id) >= 0) w *= 3;
        if (paper.fixedComp && cd.component === paper.fixedComp) w *= 0.3;
        return w;
      });
      if (!def) break;
      pool.splice(pool.indexOf(def), 1);
      const compVal = def.component === "fit" ? 55 : paper.comps[def.component];
      const validP = clamp((def.valid === undefined ? 0.6 : def.valid) + (60 - compVal) / 100, 0.1, 0.95);
      concerns.push({
        key: "r" + i + "c" + k,
        id: def.id,
        text: fill(G.rng.pick(asList(def.text)), G, ctx),
        comp: def.component,
        severity: def.severity || "minor",
        valid: G.rng.chance(validP),
        pre: !!(paper.fixedComp && def.component === paper.fixedComp)
      });
    }
    reviews.push({
      persona: persona.id,
      opener: fill(G.rng.pick(asList(persona.openers)), G, ctx),
      raw: raw,
      score: scoreOf(raw),
      confidence: G.rng.int(2, 5),
      concerns: concerns,
      flagged: false,
      silent: !!persona.silent,
      llm: !!persona.llm,
      openness: persona.openness === undefined ? 0.8 : persona.openness
    });
  }
  // The harshest persona always gets to be Reviewer 2.
  const r2 = reviews.findIndex(function (r) { return r.persona === "reviewer_2"; });
  if (r2 >= 0 && r2 !== 1) { const t = reviews[1]; reviews[1] = reviews[r2]; reviews[r2] = t; }
  paper.reviews = reviews;
  paper.scoreAtReviews = paper.scoreBonus || 0;
  return reviews;
}

export function rebuttalPrompt(G, paper) {
  const s = G.state;
  return {
    type: "rebuttal",
    paperId: paper.id,
    title: "Author response: " + paper.short,
    venue: paper.venueName,
    reviews: paper.reviews.map(function (r, i) {
      return {
        n: i + 1,
        opener: r.opener,
        score: r.score,
        confidence: r.confidence,
        llm: r.llm,
        concerns: r.concerns.map(function (c) { return { key: c.key, text: c.text, severity: c.severity, comp: c.comp, pre: c.pre }; })
      };
    }),
    options: RESPONSES
  };
}

function respond(G, paper, r, c, resp) {
  const st = G.state.stats;
  if (c.pre) {
    unlock(G, "saw_it_coming");
    return { d: 8, line: "You'd already fixed this before submitting. The reply writes itself." };
  }
  switch (resp) {
    case "clarify":
      if (!c.valid) {
        return G.rng.chance(0.55 + st.writing / 200)
          ? { d: G.rng.triangular(6, 2), line: "Your clarification lands." }
          : { d: 1, line: "They skim your clarification." };
      }
      return { d: c.severity === "minor" ? 1 : 0, line: "Clarifying doesn't fix a real problem." };
    case "concede":
      paper.promises++;
      return { d: c.severity === "minor" ? G.rng.triangular(4, 1) : 2, line: "They appreciate the honesty." };
    case "experiment":
      if (G.rng.chance(clamp(0.5 + (st.coding - 50) / 40, 0.1, 0.9))) {
        if (c.comp === "S" || c.comp === "fit") return { d: c.valid ? G.rng.triangular(8, 3) : 4, line: "The new results convince them." };
        return { d: 3, line: "Nice results, though not quite what they asked." };
      }
      return G.rng.chance(0.25)
        ? { d: -2, line: "The new baseline beats you. You report it honestly." }
        : { d: 1, line: "The experiment doesn't finish in time." };
    case "pushback":
      if (!c.valid) return { d: G.rng.triangular(5, 2), line: "Your pushback is fair, and they see it." };
      return { d: -4, line: "They don't enjoy being contradicted on a real issue." };
    case "passive":
      if (G.rng.chance(0.02)) { unlock(G, "legendary_passive_aggressive"); return { d: 15, line: "Somehow, it works. Legendary." }; }
      return { d: -8, line: "They noticed the tone." };
    default:
      return { d: c.severity === "major" && c.valid ? -1 : 0, line: "" };
  }
}

// answer.responses: { reviewerIndex: responseId }. Anything missing is a clarification.
export function resolveRebuttal(G, paper, answer) {
  const s = G.state;
  const responses = (answer && answer.responses) || {};
  let days = 0;
  const out = [];
  paper.reviews.forEach(function (r, i) {
    const before = r.score;
    const lines = [];
    let delta = 0;
    let resp = responses[i] || "clarify";
    if (!RESPONSES.some(function (x) { return x.id === resp; }) || (resp === "flag" && !r.llm)) resp = "clarify";
    if (resp === "flag") {
      r.flagged = G.rng.chance(0.6);
      lines.push(r.flagged ? "The area chair agrees this review reads as LLM-written and discounts it." : "The area chair notes your concern.");
    } else {
      if (resp === "experiment") { days += 2; s.stats.energy = clamp(s.stats.energy - 6, 0, 100); }
      r.concerns.forEach(function (c) {
        const o = respond(G, paper, r, c, resp);
        delta += r.silent ? 0 : o.d * (o.d > 0 ? r.openness : 1);
        if (o.line && !r.silent && lines.indexOf(o.line) < 0) lines.push(o.line);
      });
    }
    if (r.silent) lines.push("No sign this reviewer read the response.");
    if (!r.silent && G.rng.chance(0.1)) { delta -= 4; lines.push("After reading the other reviews, they lower their score."); }
    r.raw += delta;
    r.score = scoreOf(r.raw);
    out.push({ n: i + 1, before: before, after: r.score, lines: lines });
  });
  if (days) s.dayAdj -= days;
  paper.rebutted = true;
  s.telemetry.rebuttals++;
  return { reviews: out, days: days };
}

export function decide(G, paper) {
  const cfg = G.D.config.reviews;
  const v = G.D.venueById[paper.venueId];
  if (!paper.reviews) generateReviews(G, paper);
  let sum = 0, w = 0;
  paper.reviews.forEach(function (r) { const wt = r.flagged ? 0.5 : 1; sum += r.raw * wt; w += wt; });
  let m = sum / w + G.rng.normal(0, cfg.ac_sigma) + (paper.round > 1 ? paper.roundBonus || 0 : 0);
  // Score changes from events after the reviews were written still count.
  m += (paper.scoreBonus || 0) - (paper.scoreAtReviews || 0);
  if (hasTrait(G, "lucky")) m += 2;
  paper.meta = m;
  const thr = v.threshold;
  if (paper.journal) {
    if (paper.round > 1) return m >= thr - 4 ? "accept" : "reject";
    if (m >= thr + 6) return "accept";
    return m >= thr - 10 ? "major_revision" : "reject";
  }
  if (paper.rr) {
    if (paper.round > 1) return m >= thr - 3 ? "accept" : "reject";
    return m >= thr - cfg.rr_band ? "revise" : "reject";
  }
  if (m >= thr) return "accept";
  if (v.findings && m >= thr - cfg.findings_band) return "findings";
  return "reject";
}

export function metaLine(G, kind) {
  const meta = G.D.reviews.meta || {};
  const pool = asList(meta[kind === "major_revision" ? "revise" : kind]);
  return pool.length ? fill(G.rng.pick(pool), G, {}) : "";
}

export function nextResubmitTarget(G, p, workshopOnly) {
  autoTarget(G, p, { minLead: 2, onlyWorkshops: !!workshopOnly });
}
