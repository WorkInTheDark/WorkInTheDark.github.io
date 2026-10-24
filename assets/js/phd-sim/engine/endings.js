// Offers, endings, titles, epilogues, PhD 101 recommendations, and run finalization.
import { check } from "./conditions.js";
import { asList } from "./util.js";
import { fill } from "./templating.js";
import { totalCitations, hIndex, acceptedPapers, firstAuthorPubs, hasTrait, paperCitations } from "./derived.js";
import { yearOf, tOf, STAT_LABELS, HIDDEN, TURNS } from "./state.js";
import { unlock, checkAchievements } from "./achievements.js";
import { fateLine } from "./people.js";
import { t } from "./i18n.js";

export function profile(G) {
  const s = G.state;
  const acc = acceptedPapers(G).filter(function (p) { return p.firstAuthor; });
  const top = acc.filter(function (p) { return p.tier === "top"; }).length;
  const adv = s.advisor ? s.advisor.params : { fame: 3 };
  const letter = (s.stats.advisor_rel / 100) * (adv.fame / 5);
  const h = hIndex(G);
  const cites = totalCitations(G);
  const hiring = s.world.hiring === "boom" ? 1.2 : s.world.hiring === "freeze" ? 0.7 : 1;
  return {
    pubs: acc.length, top: top, h: h, cites: cites, letter: letter,
    academic: 10 * top + 5 * (acc.length - top) + 4 * h + 0.03 * cites + 20 * letter + 0.1 * s.stats.network,
    industry: (6 * acc.length + 3 * h + 0.3 * s.stats.coding + 0.15 * s.stats.network + 12 * (s.telemetry.internships || 0)) * hiring,
    hiring: hiring
  };
}

function offerBars(G) {
  const o = G.D.config.offers || {};
  return {
    tenure: o.tenure_track_score || 64, famous: o.famous_postdoc_score || 45,
    frontier: o.frontier_lab_score || 80, frontierCoding: o.frontier_lab_coding || 65,
    uxPapers: o.ux_hci_papers || 0, clinicalChance: o.clinical_chance || 1, journalistWriting: o.journalist_writing || 0
  };
}

// Accepted first-author papers from human-centered projects (studies and systems).
function hciPapers(G) {
  const s = G.state;
  return acceptedPapers(G).filter(function (pp) {
    if (!pp.firstAuthor) return false;
    const pr = s.projects.find(function (q) { return q.id === pp.projectId; });
    return pr && (pr.type === "study" || pr.type === "system");
  }).length;
}

function offer(G, id) {
  const e = G.D.endingById[id];
  return e ? { id: id, name: e.name, desc: e.offer || e.blurb || "" } : null;
}

export function computeOffers(G, tracks) {
  const s = G.state;
  const P = profile(G);
  const st = s.stats;
  const out = [];
  const roll = function (p) { return G.rng.chance(Math.max(0, Math.min(0.97, p * (P.hiring)))); };
  const talk = s.job && s.job.talkScore !== undefined ? 0.7 + 0.6 * s.job.talkScore : 1;
  const rollA = function (p) { return roll(p * talk); };
  const has = function (track) { return tracks.indexOf(track) >= 0; };
  const bar = offerBars(G);
  if (has("academia")) {
    // Only the strongest profiles can get these two (config offers: about the top 10% and 25%).
    if (P.academic >= bar.tenure && rollA(0.5)) out.push("tenure_track");
    if (P.academic >= 40 && st.presenting >= 55 && (s.telemetry.ta_semesters || 0) >= 2 && rollA(0.6)) out.push("teaching_college");
    if (P.academic >= bar.famous && rollA(0.7)) out.push("postdoc_famous");
    else if (P.academic >= 22 && rollA(0.8)) out.push("eternal_postdoc");
    if (P.academic >= 50 && rollA(0.3)) out.push("lecturer_abroad");
    if (s.player.origin === "international" && P.academic >= 42 && rollA(0.5)) out.push("faculty_back_home");
  }
  if (has("industry")) {
    if (P.industry >= bar.frontier && st.coding >= bar.frontierCoding && roll(0.7)) out.push("frontier_lab");
    if (P.industry >= 60 && roll(0.6)) out.push("bigtech_rs");
    if (P.industry >= 40 && roll(0.8)) out.push("applied_scientist");
    if (st.coding >= 45 && roll(0.85)) out.push("ml_engineer");
    if (s.flags.quant_recruiter && st.coding >= 55 && roll(0.7)) out.push("quant");
    if ((s.telemetry.study_projects || 0) >= 2 && hciPapers(G) >= bar.uxPapers && roll(0.6)) out.push("ux_researcher");
    if (s.flags.return_offer) out.push("return_offer");
  }
  if (has("startup")) {
    if (s.flags.startup_idea || (s.advisor && s.advisor.archetype === "serial_founder")) out.push("founder");
    if (s.flags.labmate_startup_offer) out.push("employee_four");
  }
  if (has("other")) {
    if (s.flags.policy_interest) out.push("policy_fellow");
    if (s.flags.science_writer && st.writing >= bar.journalistWriting) out.push("science_journalist");
    if (s.flags.video_fame || (st.presenting >= 70 && hasTrait(G, "extremely_online"))) out.push("ai_youtuber");
    if (s.flags.clinical_partner && hciPapers(G) >= 1 && roll(bar.clinicalChance)) out.push("clinical_informatics");
  }
  if (!out.length) out.push(st.coding >= 35 ? "ml_engineer" : "applied_scientist");
  const uniq = [];
  out.forEach(function (id) { if (uniq.indexOf(id) < 0) uniq.push(id); });
  // For the simulator's balance report: the profile behind the latest offers, and every offer seen.
  const log = s.offerLog = s.offerLog || { offered: {} };
  log.academic = Math.round(P.academic * 10) / 10;
  log.industry = Math.round(P.industry * 10) / 10;
  uniq.forEach(function (id) { log.offered[id] = true; });
  return uniq.map(function (id) { return offer(G, id); }).filter(Boolean);
}

function pickTitle(G) {
  const titles = G.D.titles.slice().sort(function (a, b) { return (b.priority || 0) - (a.priority || 0); });
  for (let i = 0; i < titles.length; i++) {
    if (!titles[i].when || check(titles[i].when, G, {})) return titles[i];
  }
  return { id: "steady_hand", name: t("The Steady Hand") };
}

// The epilogue's lines, and which epilogues.yml entries they came from (for the share link).
function pickEpilogue(G) {
  const s = G.state;
  const lines = [], ids = [];
  const matches = G.D.epilogues.filter(function (e) { return check(e.when, G, {}); });
  const shuffled = G.rng.shuffle(matches).sort(function (a, b) { return (b.priority || 0) - (a.priority || 0); });
  shuffled.slice(0, 3).forEach(function (e) { lines.push(fill(e.text, G, {})); ids.push(G.D.epilogues.indexOf(e)); });
  const gone = s.labmates.filter(function (l) { return l.fate; });
  if (gone.length) {
    const l = G.rng.pick(gone);
    lines.push(fateLine(l));
  }
  const best = acceptedPapers(G).slice().sort(function (a, b) { return paperCitations(b) - paperCitations(a); })[0];
  if (best && paperCitations(best) > 0) {
    lines.push(t("“{paper}” keeps getting cited: {n} times and counting.", { paper: best.short, n: paperCitations(best) }));
  }
  return { lines: lines, ids: ids };
}

// Where a paper's venue and title sit in the game's data, so a shared link can name the paper with
// ids alone: [venue id, cycle, Findings 1/0, topic id, title list, index in it (-1 if not there)].
function paperRef(G, p) {
  const tt = (G.D.topicById[p.topic] || {}).titles || {};
  let field = "", idx = -1;
  Object.keys(tt).some(function (f) { const i = (tt[f] || []).indexOf(p.title); if (i >= 0) { field = f; idx = i; } return i >= 0; });
  return [p.venueId || "", p.cycle || 0, p.tier === "findings" ? 1 : 0, p.topic || "", field, idx];
}

// The end card's moments (playtest feedback, 2026-10-24: share what you lived through, not bars):
// up to four answered events, the rarer and more personal the better (advisor signatures, the lab,
// life outside it), one per kind of event and spread over the years, in the order they happened.
// No dice, so the pick never changes a replay.
const RARITY_SCORE = { legendary: 10, rare: 6, uncommon: 3, common: 1 };
const CATEGORY_SCORE = { legion: 3, exit: 2, advisor: 1.5, lab: 1.5, life: 1.5, travel: 1.5, career: 1, milestone: 1, teaching: 0.5,
  research: 0.5, writing: 0.5, reviews: 0.5, wellbeing: 0, world: 0, data: 0 };
function pickMoments(G) {
  const cands = (G.state.moments || []).map(function (m) {
    const ev = G.D.eventById[m.id] || {};
    let score = (RARITY_SCORE[ev.rarity] || 1) + (CATEGORY_SCORE[ev.category] || 0) + (ev.arc ? 1 : 0);
    if (ev.hook === "sick" || ev.hook === "exhausted") score -= 1;
    return { m: m, ev: ev, score: score };
  }).filter(function (c) { return c.m.text; })
    .sort(function (a, b) { return b.score - a.score || a.m.t - b.m.t; });
  const picks = [];
  const take = function (ok) {
    cands.forEach(function (c) {
      if (picks.length >= 4 || picks.indexOf(c) >= 0 || !ok(c)) return;
      if (picks.some(function (p) { return p.m.id === c.m.id; })) return;
      picks.push(c);
    });
  };
  const year = function (c) { return yearOf(c.m.t); };
  take(function (c) { return !picks.some(function (p) { return p.ev.category === c.ev.category || year(p) === year(c); }); });
  take(function (c) { return !picks.some(function (p) { return p.ev.category === c.ev.category; }); });
  take(function () { return true; });
  return picks.sort(function (a, b) { return a.m.t - b.m.t; }).map(function (c) {
    return { id: c.m.id, c: c.m.c, f: c.m.f, t: c.m.t, title: c.m.title, label: c.m.label, text: c.m.text };
  });
}

// What people said to you: the last piece of advice from a senior labmate (tips.yml, which come when
// they fit what you're going through), and the opening line of the harshest review you got.
function pickQuotes(G) {
  const s = G.state;
  const out = [];
  const tips = (s.quotes || []).filter(function (q) { return G.D.tips.some(function (tp) { return tp.id === q.tip; }); });
  const tipQuote = function (q) {
    const tp = G.D.tips.find(function (x) { return x.id === q.tip; });
    return { kind: "tip", id: q.tip, by: q.by || "", text: tp.text, t: q.t };
  };
  if (tips.length) out.push(tipQuote(tips[tips.length - 1]));
  let worst = null;
  s.papers.forEach(function (p) {
    (p.reviews || []).forEach(function (r, i) {
      if (r.opener && !r.silent && (!worst || r.raw < worst.r.raw)) worst = { r: r, n: i + 1, t: p.decisionTurn || p.submittedTurn || s.turn };
    });
  });
  if (worst) {
    const persona = (G.D.reviews.personas || []).find(function (pp) { return pp.id === worst.r.persona; });
    const oi = persona ? asList(persona.openers).indexOf(worst.r.opener) : -1;
    out.push({ kind: "review", persona: worst.r.persona, n: worst.n, oi: oi, text: worst.r.opener, t: worst.t });
  }
  if (out.length < 2 && tips.length > 1) out.unshift(tipQuote(tips[0]));
  return out;
}

function pickRecommendations(G) {
  const recs = G.D.recommendations.filter(function (r) { return !r.when || check(r.when, G, {}); })
    .sort(function (a, b) { return (b.priority || 0) - (a.priority || 0); });
  const out = [];
  recs.forEach(function (r) {
    if (out.length >= 3) return;
    if (out.some(function (o) { return o.topic === r.topic; })) return;
    const ep = G.D.phd101[r.topic];
    if (ep) out.push({ topic: r.topic, title: ep.title, url: ep.url, why: r.why || "" });
  });
  return out;
}

// The share of simulated PhDs (data percentiles.yml, from simulate.mjs --percentiles) whose research
// record (the same score the job market uses) is lower than this one. Null without the table.
export function beatsPercent(D, score) {
  const q = D.percentiles && D.percentiles.score;
  if (!q || !q.length) return null;
  let below = 0;
  for (let i = 0; i < q.length; i++) if (q[i] < score) below = i;
  return Math.max(0, Math.min(99, Math.round((100 * below) / (q.length - 1))));
}

export function finalize(G, endingId) {
  const s = G.state;
  if (s.phase === "ended") return;
  let id = endingId;
  if (id === "founder") {
    const r = G.rng.next() - s.stats.network / 400;
    id = r < 0.3 ? "founder_acquired" : r < 0.7 ? "founder_pivot" : "founder_bigtech";
  }
  // A long postdoc that turned out well, only for profiles that could have had the famous lab.
  if (id === "eternal_postdoc" && profile(G).academic >= offerBars(G).famous) id = "postdoc_famous";
  const e = G.D.endingById[id] || { id: id, name: id, text: "" };
  if (s.milestones.graduated) {
    const y = yearOf(s.turn);
    if (y <= 4) unlock(G, "speedrun");
    if (y === 5 || (y === 6 && tOf(s.turn) === 1)) unlock(G, "on_time");
    if (y >= 7) unlock(G, "the_long_way");
  }
  const meta0 = G.meta;
  meta0.codex = meta0.codex || {};
  meta0.codex.endings = meta0.codex.endings || {};
  meta0.codex.endings[id] = (meta0.codex.endings[id] || 0) + 1;
  if (Object.keys(meta0.codex.endings).filter(function (k) { return k !== "founder"; }).length >= 26) unlock(G, "every_door");
  checkAchievements(G);
  const title = pickTitle(G);
  const epilogue = pickEpilogue(G);
  const numbers = {
    years: Math.round((s.turn / TURNS) * 10) / 10,
    pubs: firstAuthorPubs(G),
    allPubs: acceptedPapers(G).length,
    citations: totalCitations(G),
    h: hIndex(G),
    submissions: s.telemetry.submissions,
    rejections: s.telemetry.rejections,
    conferences: s.telemetry.conferences,
    overtime: s.telemetry.overtime_days,
    burnouts: s.telemetry.burnouts,
    events: s.telemetry.events_seen,
    score: Math.round(profile(G).academic * 10) / 10,
    stats: {}
  };
  numbers.beats = beatsPercent(G.D, numbers.score);
  ["energy", "sanity"].concat(HIDDEN).forEach(function (k) { numbers.stats[k] = Math.round(s.stats[k] || 0); });
  s.ending = {
    id: id,
    name: e.name,
    group: e.group || "",
    text: fill(e.text || "", G, {}),
    graduated: !!s.milestones.graduated,
    daily: s.daily && /^daily-\d{4}-\d{2}-\d{2}$/.test(s.seed || "") ? s.seed.slice(6) : null,
    title: { id: title.id, name: title.name, desc: title.desc || "" },
    epilogue: epilogue.lines,
    numbers: numbers,
    statLabels: STAT_LABELS,
    recommendations: pickRecommendations(G),
    papers: s.papers.filter(function (p) { return !p.superseded; }).map(function (p) {
      return { title: p.title, venue: p.venueName, tier: p.tier, status: p.status, cites: paperCitations(p), first: p.firstAuthor, ref: paperRef(G, p) };
    }),
    achievements: Object.keys(s.runAchievements || {}),
    advisor: s.advisor ? { label: s.advisor.label, name: t("Prof. {name}", { name: s.advisor.surname }),
      ref: [s.advisor.archetype, ((G.D.names || {}).last || []).indexOf(s.advisor.surname)] } : null,
    moments: pickMoments(G),
    quotes: pickQuotes(G),
    // Ids for the share link (ui/share.js): which epilogue lines this run got.
    ref: { epilogue: epilogue.ids }
  };
  const meta = G.meta;
  meta.codex = meta.codex || {};
  ["endings", "titles", "advisors"].forEach(function (k) { meta.codex[k] = meta.codex[k] || {}; });
  meta.codex.titles[title.id] = (meta.codex.titles[title.id] || 0) + 1;
  meta.runsCompleted = (meta.runsCompleted || 0) + 1;
  s.phase = "ended";
  s.prompt = null;
}
