// Offers, endings, titles, epilogues, PhD 101 recommendations, and run finalization.
import { check } from "./conditions.js";
import { fill } from "./templating.js";
import { totalCitations, hIndex, acceptedPapers, firstAuthorPubs, hasTrait, paperCitations } from "./derived.js";
import { yearOf, tOf, STAT_LABELS, HIDDEN, TURNS } from "./state.js";
import { unlock, checkAchievements } from "./achievements.js";

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
  const has = function (t) { return tracks.indexOf(t) >= 0; };
  if (has("academia")) {
    if (P.academic >= 64 && rollA(0.5)) out.push("tenure_track");
    if (P.academic >= 40 && st.presenting >= 55 && (s.telemetry.ta_semesters || 0) >= 2 && rollA(0.6)) out.push("teaching_college");
    if (P.academic >= 45 && st.network >= 45 && rollA(0.7)) out.push("postdoc_famous");
    else if (P.academic >= 22 && rollA(0.8)) out.push("eternal_postdoc");
    if (P.academic >= 50 && rollA(0.3)) out.push("lecturer_abroad");
    if (s.player.origin === "international" && P.academic >= 42 && rollA(0.5)) out.push("faculty_back_home");
  }
  if (has("industry")) {
    if (P.industry >= 80 && st.coding >= 65 && roll(0.5)) out.push("frontier_lab");
    if (P.industry >= 60 && roll(0.6)) out.push("bigtech_rs");
    if (P.industry >= 40 && roll(0.8)) out.push("applied_scientist");
    if (st.coding >= 45 && roll(0.85)) out.push("ml_engineer");
    if (s.flags.quant_recruiter && st.coding >= 55 && roll(0.7)) out.push("quant");
    if ((s.telemetry.study_projects || 0) >= 2 && roll(0.7)) out.push("ux_researcher");
    if (s.flags.return_offer) out.push("return_offer");
  }
  if (has("startup")) {
    if (s.flags.startup_idea || (s.advisor && s.advisor.archetype === "serial_founder")) out.push("founder");
    if (s.flags.labmate_startup_offer) out.push("employee_four");
  }
  if (has("other")) {
    if (s.flags.policy_interest) out.push("policy_fellow");
    if (s.flags.science_writer || st.writing >= 72) out.push("science_journalist");
    if (s.flags.video_fame || (st.presenting >= 70 && hasTrait(G, "extremely_online"))) out.push("ai_youtuber");
    if (s.flags.clinical_partner) out.push("clinical_informatics");
  }
  if (!out.length) out.push(st.coding >= 35 ? "ml_engineer" : "applied_scientist");
  const uniq = [];
  out.forEach(function (id) { if (uniq.indexOf(id) < 0) uniq.push(id); });
  return uniq.map(function (id) { return offer(G, id); }).filter(Boolean);
}

function pickTitle(G) {
  const titles = G.D.titles.slice().sort(function (a, b) { return (b.priority || 0) - (a.priority || 0); });
  for (let i = 0; i < titles.length; i++) {
    if (!titles[i].when || check(titles[i].when, G, {})) return titles[i];
  }
  return { id: "steady_hand", name: "The Steady Hand" };
}

function pickEpilogue(G) {
  const s = G.state;
  const lines = [];
  const matches = G.D.epilogues.filter(function (e) { return check(e.when, G, {}); });
  const shuffled = G.rng.shuffle(matches).sort(function (a, b) { return (b.priority || 0) - (a.priority || 0); });
  shuffled.slice(0, 3).forEach(function (e) { lines.push(fill(e.text, G, {})); });
  const gone = s.labmates.filter(function (l) { return l.fate; });
  if (gone.length) {
    const l = G.rng.pick(gone);
    lines.push(l.name + ", your old labmate, " + l.fate.replace(/^graduated and /, "") + ".");
  }
  const best = acceptedPapers(G).slice().sort(function (a, b) { return paperCitations(b) - paperCitations(a); })[0];
  if (best && paperCitations(best) > 0) {
    lines.push("“" + best.short + "” keeps getting cited: " + paperCitations(best) + " times and counting.");
  }
  return lines;
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

export function finalize(G, endingId) {
  const s = G.state;
  if (s.phase === "ended") return;
  let id = endingId;
  if (id === "founder") {
    const r = G.rng.next() - s.stats.network / 400;
    id = r < 0.3 ? "founder_acquired" : r < 0.7 ? "founder_pivot" : "founder_bigtech";
  }
  if (id === "eternal_postdoc" && hIndex(G) >= 6) id = "postdoc_famous";
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
    stats: {}
  };
  ["energy", "sanity"].concat(HIDDEN).forEach(function (k) { numbers.stats[k] = Math.round(s.stats[k] || 0); });
  s.ending = {
    id: id,
    name: e.name,
    group: e.group || "",
    text: fill(e.text || "", G, {}),
    graduated: !!s.milestones.graduated,
    title: { id: title.id, name: title.name, desc: title.desc || "" },
    epilogue: pickEpilogue(G),
    numbers: numbers,
    statLabels: STAT_LABELS,
    recommendations: pickRecommendations(G),
    papers: s.papers.filter(function (p) { return !p.superseded; }).map(function (p) {
      return { title: p.title, venue: p.venueName, tier: p.tier, status: p.status, cites: paperCitations(p), first: p.firstAuthor };
    }),
    achievements: Object.keys(s.runAchievements || {}),
    advisor: s.advisor ? { label: s.advisor.label, name: "Prof. " + s.advisor.surname } : null
  };
  const meta = G.meta;
  meta.codex = meta.codex || {};
  ["endings", "titles", "advisors"].forEach(function (k) { meta.codex[k] = meta.codex[k] || {}; });
  meta.codex.titles[title.id] = (meta.codex.titles[title.id] || 0) + 1;
  meta.runsCompleted = (meta.runsCompleted || 0) + 1;
  s.phase = "ended";
  s.prompt = null;
}
