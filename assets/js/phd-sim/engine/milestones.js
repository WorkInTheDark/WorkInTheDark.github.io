// System prompts: advisor matching, submissions, decisions, conferences, quals, proposal,
// defense, internships, fellowships, the job market, and leaving. Each builder returns a
// prompt; handleSys applies the player's choice.
import { clamp, asList } from "./util.js";
import { yearOf, tOf, absTurn, STAT_LABELS, weeks, firstWeek } from "./state.js";
import { hasTrait, hasStatus, firstAuthorPubs, pendingFirstAuthor, acceptedPapers } from "./derived.js";
import { applyOutcome, addStat, addStatus, removeStatus } from "./effects.js";
import { unlock } from "./achievements.js";
import { fill } from "./templating.js";
import { genCandidates, makeAdvisor, genLabmates, genCommittee } from "./people.js";
import {
  PROJECT_TYPES, STAGE_LABELS, newProjectObject, activeProjects, autoTarget, components, weakestComp,
  writingCompletion, isReady, deadlineLabel, venuesForType, nextDeadline
} from "./projects.js";
import { makePaper, generateReviews, rebuttalPrompt, resolveRebuttal, decide, metaLine, nextResubmitTarget } from "./reviews.js";
import { setCiteMean, rollBreakout } from "./citations.js";
import { computeOffers, finalize } from "./endings.js";
import { fireHook } from "./events.js";

function sys(id, title, text, choices, data) {
  return {
    type: "sys", sys: id, title: title, text: text,
    choices: choices.map(function (c, i) { return { i: i, label: c.label, desc: c.desc || "", arrows: c.arrows || [] }; }),
    data: data || {}
  };
}

function notice(title, text, data) {
  return sys("notice", title, text, [{ label: "Continue" }], data);
}

function proj(G, id) { return G.state.projects.find(function (p) { return p.id === id; }); }
function paper(G, id) { return G.state.papers.find(function (p) { return p.id === id; }); }
function log(G, text, kind) { G.state.log.push({ turn: G.state.turn, kind: kind || "line", text: text }); }

const COMP_WORDS = {
  N: { name: "novelty", question: "Why does anyone need this? Right now the case for novelty is the weakest part of the paper." },
  S: { name: "soundness", question: "Does the evidence actually support the claim? Right now it doesn't quite." },
  C: { name: "clarity", question: "A reader will get lost by section 3. What is the one sentence they must remember?" }
};

// ---- Matching ---------------------------------------------------------------

export function matchingPrompt(G) {
  const s = G.state;
  if (!s.candidates) s.candidates = genCandidates(G);
  const D = G.D;
  const forced = tOf(s.turn) >= 8;
  return {
    type: "matching",
    title: forced ? "Time to choose an advisor" : "Choosing an advisor",
    text: forced
      ? "The matching deadline is this week. Pick the lab you will spend the next five years in."
      : "Three professors are taking students. Senior students have opinions about each of them; rumors are right most of the time. Rotating in a lab costs 3 days this week and shows you the truth.",
    forced: forced,
    rotatedThisTurn: !!s.rotatedTurn && s.rotatedTurn === s.turn,
    candidates: s.candidates.map(function (c, i) {
      const shown = D.archetypeById[c.revealed ? c.archetype : c.rumor];
      return {
        idx: i,
        name: "Prof. " + c.first + " " + c.surname,
        area: c.area,
        nick: shown.nick,
        tagline: shown.tagline,
        legion: shown.legion,
        revealed: c.revealed,
        quirks: c.revealed ? c.quirks : []
      };
    })
  };
}

export function answerMatching(G, resp) {
  const s = G.state;
  const c = s.candidates[resp.idx];
  if (resp.action === "rotate" && c) {
    c.revealed = true;
    s.rotatedTurn = s.turn;
    s.dayAdj -= 3;
    const truth = G.D.archetypeById[c.archetype];
    const rumorRight = c.rumor === c.archetype;
    return { text: "You spend three days in Prof. " + c.surname + "'s lab. " + (rumorRight
      ? "The rumors were right: students really do call them " + truth.nick + "."
      : "The rumors were wrong. Up close, they are " + truth.nick + ": " + truth.tagline), visible: [{ stat: "days", amount: -3 }], hidden: [], notes: [], again: true };
  }
  if (resp.action === "later") return { text: "You'll decide later. The deadline is the end of the semester.", visible: [], hidden: [], notes: [] };
  if (!c) return null;
  s.advisor = makeAdvisor(G, c);
  const a = G.D.archetypeById[c.archetype];
  s.labmates = genLabmates(G, a.lab_size || 4);
  const offeredDA = s.candidates.some(function (x) { return x.archetype === "kind_funded"; });
  if (c.archetype === "kind_funded") unlock(G, "found_the_dark_angel");
  else if (offeredDA) unlock(G, "the_one_that_got_away");
  G.meta.codex = G.meta.codex || {};
  G.meta.codex.advisors = G.meta.codex.advisors || {};
  G.meta.codex.advisors[c.archetype] = (G.meta.codex.advisors[c.archetype] || 0) + 1;
  s.candidates = null;
  s.turnItems.unshift({ kind: "sys", sys: "first_project" });
  return {
    text: "You join Prof. " + c.surname + "'s lab. Students call them " + s.advisor.nick + ": " + s.advisor.tagline,
    visible: [], hidden: [], notes: [s.labmates.length + " labmates say hello on the lab chat."]
  };
}

// ---- Projects ---------------------------------------------------------------

export function newProjectPrompt(G, opts) {
  const s = G.state;
  const ideas = Math.min(3, s.telemetry.ideas || 0);
  return {
    type: "new_project",
    title: opts && opts.title || "Start a new project",
    text: (opts && opts.text) || "Pick the kind of project and the topic. Hot topics get more attention, and more competition.",
    cancellable: !(opts && opts.required),
    ideaBonus: ideas,
    types: Object.keys(PROJECT_TYPES).map(function (k) {
      const t = PROJECT_TYPES[k];
      return {
        id: k, label: t.label,
        stages: t.stages.map(function (st) { return STAGE_LABELS[st.id] + (st.kind === "wait" ? " (wait)" : ""); }).join(" → "),
        bonus: k === "study" && s.player.background === "switcher"
      };
    }),
    topics: s.world.topics.map(function (t) { return { id: t.id, name: t.name, hype: Math.round(t.hype) }; })
  };
}

export function createProject(G, type, topicId, opts) {
  const s = G.state;
  opts = opts || {};
  const ideas = Math.min(3, s.telemetry.ideas || 0);
  const p = newProjectObject(G, type, topicId, { bonusN: opts.bonusN !== undefined ? opts.bonusN : ideas * 3, stageIdx: opts.stageIdx, seedQuality: opts.seedQuality, source: opts.source });
  if (opts.bonusN === undefined) s.telemetry.ideas = Math.max(0, (s.telemetry.ideas || 0) - ideas);
  if (opts.progress) p.progress = opts.progress;
  s.projects.push(p);
  return p;
}

export function answerNewProject(G, resp) {
  if (!resp || resp.cancel) return null;
  const p = createProject(G, resp.type, resp.topic, {});
  autoTarget(G, p);
  return { text: "New project: “" + p.title + "”.", visible: [], hidden: [], notes: ["It now shows up in your choices each week."] };
}

function firstProjectPrompt(G) {
  const s = G.state;
  const senior = s.labmates.slice().sort(function (a, b) { return b.year - a.year; })[0];
  return sys("first_project", "Your first project",
    (senior ? senior.name : "A senior student") + " is graduating soon and has a half-finished project nobody owns. Your advisor suggests you could take it over, or start something of your own.",
    [{ label: "Take over the half-finished project", desc: "A head start, but someone else's design choices." },
      { label: "Start your own project", desc: "Your idea, from scratch." }],
    { senior: senior ? senior.name : null });
}

// ---- Submission -------------------------------------------------------------

function submitPrompt(G, p) {
  const v = G.D.venueById[p.target.venueId];
  const pct = Math.round(writingCompletion(G, p) * 100);
  const name = deadlineLabel(G, p);
  return sys("submit", name + " deadline: this week",
    "“" + p.title + "” is " + pct + "% written. You need at least half a draft by the end of the week to submit. The more complete the writing, the clearer the paper.",
    [{ label: "Submit and post a preprint", desc: "Citations start early. Everyone will see it." },
      { label: "Submit without a preprint", desc: "Quiet until the decision." },
      { label: "Skip this deadline", desc: "Aim for the next one." }],
    { projectId: p.id, venue: v ? v.id : null });
}

function questionPrompt(G, p) {
  const comps = components(G, p);
  const weak = weakestComp(comps);
  return sys("the_question", "The Question",
    "A week before the deadline, " + (G.state.advisor ? G.state.advisor.nick : "your advisor") + " reads “" + p.short + "” and asks one question: “" + COMP_WORDS[weak].question + "”",
    [{ label: "Fix it this week", desc: "Work on the paper this week and the fix goes in." },
      { label: "Note it and keep going", desc: "There's only so much time." }],
    { projectId: p.id, comp: weak });
}

// ---- Decisions and conferences ---------------------------------------------

function sanityFromScores(reviews) {
  const avg = reviews.reduce(function (a, r) { return a + r.score; }, 0) / reviews.length;
  return Math.round((avg - 3) * 3);
}

function decisionPrompt(G, pp, outcome) {
  if (!pp.firstAuthor) {
    const who = pp.coauthor || "Your labmate";
    const good = outcome === "accept" || outcome === "findings";
    return sys("decision", (good ? "Co-authored paper accepted: " : "Co-authored paper rejected: ") + pp.short,
      good ? who + "'s paper, with you as a co-author, is in" + (outcome === "findings" ? " Findings at " : " at ") + pp.venueName + "."
        : who + "'s paper, with you as a co-author, didn't make it. " + who + " shrugs and starts revising.",
      [{ label: good ? "Congratulate " + who : "Send " + who + " a sympathetic emoji" }], { paperId: pp.id, outcome: outcome, coauthor: true });
  }
  const line = metaLine(G, outcome === "findings" ? "findings" : outcome === "accept" ? "accept" : outcome === "reject" ? "reject" : "revise");
  const scores = pp.reviews ? pp.reviews.map(function (r) { return r.score; }).join(", ") : "";
  const head = "Scores: " + scores + ". " + (line ? "Meta-review: “" + line + "”" : "");
  if (outcome === "accept") {
    return sys("decision", "Accepted at " + pp.venueName + "!", "“" + pp.title + "” is in. " + head,
      [{ label: "Celebrate", arrows: [{ stat: "sanity", dir: "up", strength: 2 }] }], { paperId: pp.id, outcome: outcome });
  }
  if (outcome === "findings") {
    return sys("decision", "Accepted to Findings", "“" + pp.title + "” didn't make the main conference, but Findings will take it. " + head,
      [{ label: "Take Findings", desc: "A publication now." }, { label: "Withdraw and aim higher", desc: "Revise and resubmit to the main track." }],
      { paperId: pp.id, outcome: outcome });
  }
  if (outcome === "revise" || outcome === "major_revision") {
    return sys("decision", pp.journal ? "Major revision" : "Revise and resubmit", "The reviewers want changes to “" + pp.title + "”. " + head,
      [{ label: "Start the revision", desc: pp.journal ? "Revise, then send it back." : "The revision is due in a few weeks." },
        { label: "Withdraw it", desc: "Try another venue instead." }],
      { paperId: pp.id, outcome: outcome });
  }
  return sys("decision", (pp.deskReject ? "Desk rejected: " : "Rejected: ") + pp.short,
    (pp.deskReject ? "It never reached reviewers. " : head + " ") + "What now?",
    [{ label: "Revise for the next deadline", desc: "Address the reviews and try again." },
      { label: "Send it to a workshop", desc: "Lower bar, smaller audience." },
      { label: "Shelve it", desc: "Some papers aren't meant to be." }],
    { paperId: pp.id, outcome: "reject" });
}

function acceptPaper(G, pp, findings) {
  const s = G.state;
  pp.status = "accepted";
  if (findings) { pp.tier = "findings"; pp.venueName = pp.venueName + " Findings"; }
  pp.pubTurn = s.turn;
  setCiteMean(G, pp);
  const broke = rollBreakout(G, pp);
  s.telemetry.acceptances++;
  if (pp.firstAuthor) s.telemetry.first_author_pubs++;
  if (pp.tier === "top") s.telemetry.top_pubs++;
  if (pp.tier === "workshop") s.telemetry.workshop_pubs++;
  const p = proj(G, pp.projectId);
  if (p) p.status = "done";
  if (pp.promises) {
    s.dayAdjNext -= Math.min(4, pp.promises);
    log(G, "Camera-ready: the " + pp.promises + " fixes you promised in the rebuttal will take " + Math.min(4, pp.promises) + " days next week.");
  }
  if (pp.conferenceTurn && pp.conferenceTurn > s.turn) s.flags.trip_planned = true;
  if (broke) log(G, "Something about “" + pp.short + "” catches on. People keep citing it.");
  removeStatus(G, "post_rejection_blues");
  s.pendingHooks.push({ hook: "after_accept", ctx: { paperId: pp.id } });
}

function rejectPaper(G, pp) {
  const s = G.state;
  pp.status = "rejected";
  s.telemetry.rejections++;
  if (pp.deskReject) s.telemetry.desk_rejects++;
  if (s.telemetry.rejections >= 5 && s.player.traits.indexOf("rejection_hardened") < 0) {
    s.player.traits.push("rejection_hardened");
    log(G, "Five rejections in, something has changed. New trait: Rejection-Hardened.");
  }
  addStatus(G, "post_rejection_blues", 3);
  s.pendingHooks.push({ hook: "after_reject", ctx: { paperId: pp.id } });
}

function conferencePrompt(G, pp) {
  const s = G.state;
  const city = G.rng.pick(G.D.names.cities || ["Vienna"]);
  const fund = s.advisor ? s.advisor.params.fund : 3;
  const choices = [];
  const data = { paperId: pp.id, city: city, options: [] };
  if (s.flags.visa_failed) {
    data.options = ["remote"];
    return sys("conference", pp.venueName + " in " + city, "Your visa didn't come through in time. You'll present “" + pp.short + "” remotely, at 3 am your time.",
      [{ label: "Present remotely" }], data);
  }
  if (fund >= 3) {
    choices.push({ label: "Go in person", desc: "Your advisor covers the trip. Costs 4 days.", arrows: [{ stat: "energy", dir: "down", strength: 1 }] });
    data.options.push("go");
  } else {
    choices.push({ label: "Apply for a student travel grant", desc: "About a coin flip." });
    data.options.push("grant");
    choices.push({ label: "Volunteer for free registration", desc: "You go, but it costs 2 extra days." });
    data.options.push("volunteer");
  }
  choices.push({ label: "Present remotely", desc: "Cheaper and calmer. Fewer people meet you." });
  data.options.push("remote");
  return sys("conference", pp.venueName + " in " + city,
    "“" + pp.short + "” gets presented this week. " + (fund >= 3 ? "Your advisor will pay for the trip." : "Your lab has no travel money."), choices, data);
}

function attend(G, pp, city, extraDays) {
  const s = G.state;
  addStatus(G, "at_conference", 1);
  s.dayAdj -= (G.D.config.fixed_days.conference || 4) + (extraDays || 0);
  s.telemetry.conferences++;
  let net = G.rng.triangular(8, 3);
  if (hasTrait(G, "polyglot") || hasTrait(G, "international")) net += 3;
  addStat(G, "network", net);
  let san = 3;
  if (hasTrait(G, "foodie")) san += 3;
  if (hasTrait(G, "homebody")) san -= 4;
  addStat(G, "sanity", san);
  if (G.rng.chance(0.5)) addStatus(G, "jet_lagged", 1);
  s.world.cities[city] = true;
  fireHook(G, "conference", { city: city, paperId: pp.id, venue: pp.venueName }).forEach(function (it) { s.endItems.push(it); });
  log(G, "You fly to " + city + " for " + pp.venueName + " and present \u201c" + pp.short + "\u201d. Four days of talks, posters and too much coffee.", "news");
}

// Conferences happen on their own: you go if there's money for it, otherwise you present remotely.
function autoConference(G, pp) {
  const s = G.state;
  const city = G.rng.pick(G.D.names.cities || ["Vienna"]);
  const fund = s.advisor ? s.advisor.params.fund : 3;
  s.flags.trip_planned = s.papers.some(function (x) { return x !== pp && x.status === "accepted" && x.conferenceTurn && x.conferenceTurn > s.turn; });
  if (s.flags.visa_failed) {
    delete s.flags.visa_failed;
    unlock(G, "remote_presenter");
    addStat(G, "network", 2);
    log(G, "Your visa didn't come through, so you present \u201c" + pp.short + "\u201d at " + pp.venueName + " remotely, at 3 am your time.", "news");
    return;
  }
  if (fund >= 3 || G.rng.chance(0.5 + s.stats.network / 400)) {
    if (fund < 3) log(G, "A student travel grant comes through.", "news");
    attend(G, pp, city, 0);
    return;
  }
  addStat(G, "network", 2);
  log(G, "There's no travel money, so you present \u201c" + pp.short + "\u201d at " + pp.venueName + " remotely. Two people ask great questions.", "news");
}

// ---- Quals, proposal, defense (Committee Q&A) -------------------------------

export const STRATEGIES = [
  { id: "direct", label: "Answer directly", desc: "Best when they're testing what you know." },
  { id: "acknowledge", label: "Acknowledge the limitation", desc: "Best when they've found a real weakness." },
  { id: "reframe", label: "Reframe the question", desc: "Best when they're asking why it matters." },
  { id: "stall", label: "“Great question…”", desc: "Buys time. Rarely enough." }
];
const BEST = { knowledge: ["direct"], weakness: ["acknowledge"], big_picture: ["reframe"], gotcha: ["acknowledge", "reframe"] };
const QA_COUNT = { quals: 4, proposal: 4, defense: 5, job_talk: 3 };
const HINT = {
  knowledge: "They wanted a straight answer.",
  weakness: "They had found a real weakness; owning it would have landed better.",
  big_picture: "They were asking why it matters; reframing would have helped.",
  gotcha: "It was a trap; acknowledging or reframing beats a direct answer."
};
const QA_TITLE = { quals: "Qualifying exam", proposal: "Thesis proposal", defense: "Thesis defense", job_talk: "Job talk" };

export function qaPrompt(G, stage) {
  const s = G.state;
  const committee = s.committee && s.committee.length ? s.committee : genCommittee(G, 4);
  if (stage !== "job_talk") s.committee = committee;
  const pool = (G.D.qa.questions || []).filter(function (q) { return asList(q.stages).indexOf(stage) >= 0; });
  const picks = [];
  const n = Math.min(QA_COUNT[stage] || 4, pool.length);
  const avail = pool.slice();
  for (let i = 0; i < n; i++) {
    const member = committee[i % committee.length];
    const q = G.rng.weighted(avail, function (x) { return member.prefers.indexOf(x.kind) >= 0 ? 3 : 1; });
    avail.splice(avail.indexOf(q), 1);
    picks.push({ key: "q" + i, id: q.id, member: member.name + " (" + member.label + ")", text: fill(q.text, G, {}) });
  }
  s.qaPending = { stage: stage, picks: picks.map(function (p) { return p.id; }) };
  return {
    type: "qa",
    stage: stage,
    title: QA_TITLE[stage],
    text: stage === "defense" ? "Five people, two hours, one room. Read each question and choose how to answer." :
      "The committee takes turns. Read each question and choose how to answer.",
    questions: picks,
    strategies: STRATEGIES
  };
}

export function answerQa(G, resp) {
  const s = G.state;
  const pend = s.qaPending;
  if (!pend) return null;
  const stage = pend.stage;
  const answers = (resp && resp.answers) || {};
  const qs = pend.picks.map(function (id) { return (G.D.qa.questions || []).find(function (q) { return q.id === id; }); });
  let wins = 0;
  const lines = [];
  const prep = Math.min(15, s.readiness || 0) + (hasTrait(G, "anxious") ? 5 : 0) +
    (s.advisor && s.advisor.archetype === "kind_funded" ? 8 : 0);
  qs.forEach(function (q, i) {
    if (!q) return;
    const strat = answers["q" + i] || "stall";
    const skill = s.stats[q.skill] || 40;
    let fit = BEST[q.kind] && BEST[q.kind].indexOf(strat) >= 0 ? 15 : strat === "stall" ? -10 : -12;
    let p = clamp(0.5 + (skill + prep + fit - (q.difficulty || 55)) / 40, 0.05, 0.95);
    if (strat === "stall") p = Math.max(p, 0.25);
    const ok = G.rng.chance(p);
    if (ok) wins++;
    let line = ok ? G.rng.pick(["They nod and write something down.", "That lands.", "A satisfied “good”.", "They move on, convinced."])
      : G.rng.pick(["A long pause. They follow up.", "They don't look convinced.", "You can see them making a note.", "That one will come up again."]);
    if (!ok && fit < 15 && HINT[q.kind]) line += " " + HINT[q.kind];
    lines.push({ q: q.text, ok: ok, line: line });
    addStat(G, "presenting", ok ? 1 : 0.5);
  });
  const frac = qs.length ? wins / qs.length : 1;
  s.qaPending = null;
  if (stage !== "job_talk") s.readiness = 0;
  const res = { qa: lines, text: "", visible: [], hidden: [], notes: [] };
  const m = s.milestones;
  if (stage === "quals") {
    removeStatus(G, "quals_prep");
    if (frac >= 0.5) {
      m.quals = "passed";
      res.text = "You pass your quals.";
      res.visible.push({ stat: "sanity", amount: addStat(G, "sanity", 8) });
    } else if (m.quals === "failed_once") {
      res.text = "You don't pass on the second try. The program offers you a Master's degree on the way out.";
      s.pendingEnding = "masters_out";
    } else {
      m.quals = "failed_once";
      res.text = "Not this time. You can retake quals next year.";
      res.visible.push({ stat: "sanity", amount: addStat(G, "sanity", -10) });
    }
  } else if (stage === "proposal") {
    removeStatus(G, "proposal_prep");
    if (frac >= 0.5) {
      m.proposal = "passed";
      res.text = "Your proposal passes. You are officially a PhD candidate.";
      res.visible.push({ stat: "sanity", amount: addStat(G, "sanity", 8) });
      addStat(G, "advisor_rel", 4);
    } else {
      res.text = "The committee asks you to revise the plan and present again in a few weeks.";
      m.proposalAt = s.turn + weeks(4);
      addStatus(G, "proposal_prep", weeks(4));
      res.visible.push({ stat: "sanity", amount: addStat(G, "sanity", -6) });
    }
  } else if (stage === "defense") {
    removeStatus(G, "defense_prep");
    if (frac >= 0.6) {
      res.text = "They ask you to step outside. Ten long minutes later: “Congratulations, Doctor.”";
      m.defense = "passed";
      graduate(G);
    } else if (frac >= 0.4) {
      res.text = "You pass, with minor revisions. Two more weeks of fixes and you're done.";
      m.defense = "minor";
      m.graduateAt = s.turn + weeks(1);
    } else {
      res.text = "You pass, with major revisions. Six weeks of work, then a short follow-up meeting.";
      m.defense = "major";
      m.graduateAt = s.turn + weeks(3);
    }
    res.visible.push({ stat: "sanity", amount: addStat(G, "sanity", 10) });
  } else if (stage === "job_talk") {
    s.job = s.job || {};
    s.job.talkScore = frac;
    res.text = frac >= 0.6 ? "Your job talk goes well. People keep asking follow-ups at dinner." : "The talk is fine. Not your best, not your worst.";
  }
  return res;
}

function graduate(G) {
  const s = G.state;
  s.milestones.graduated = true;
  s.milestones.graduateAt = null;
  const items = fireHook(G, "graduation", {});
  for (let i = items.length - 1; i >= 0; i--) s.turnItems.unshift(items[i]);
  s.turnItems.push({ kind: "sys", sys: "final_offers" });
}

// ---- Prompts built on demand for queued sys items --------------------------

export function buildSys(G, item) {
  const s = G.state;
  const d = item.data || {};
  switch (item.sys) {
    case "welcome":
      return notice("Welcome to your PhD, " + s.player.name,
        "It's September. You have five years, give or take, to become an expert in something nobody fully understands yet. Each turn is one week: choose one thing to do with it, keep an eye on Energy and Sanity, and remember: everyone else is also figuring it out.");
    case "matching":
      if (s.advisor) return null;
      return matchingPrompt(G);
    case "first_project":
      if (activeProjects(G).length) return null;
      return firstProjectPrompt(G);
    case "new_project":
      return newProjectPrompt(G, d);
    case "submit": {
      const p = proj(G, d.projectId);
      if (!p || p.status !== "active") return null;
      return submitPrompt(G, p);
    }
    case "the_question": {
      const p = proj(G, d.projectId);
      if (!p || p.status !== "active") return null;
      return questionPrompt(G, p);
    }
    case "rebuttal": {
      const pp = paper(G, d.paperId);
      if (!pp || pp.status !== "under_review") return null;
      return rebuttalPrompt(G, pp);
    }
    case "decision": {
      const pp = paper(G, d.paperId);
      if (!pp) return null;
      return decisionPrompt(G, pp, d.outcome);
    }
    case "conference": {
      const pp = paper(G, d.paperId);
      if (!pp || pp.status !== "accepted") return null;
      return conferencePrompt(G, pp);
    }
    case "qa":
      return qaPrompt(G, d.stage);
    case "proposal_offer":
      return sys("proposal_offer", "Ready to propose?",
        "Your committee is formed and you have " + firstAuthorPubs(G) + " first-author papers. The thesis proposal turns you from a student into a candidate. You'd present in " + weeks(G.D.config.proposal_prep_turns || 4) + " weeks.",
        [{ label: "Schedule the proposal", desc: "Project days until then count as preparation." }, { label: "Not yet" }]);
    case "defense_offer": {
      const acc = firstAuthorPubs(G);
      const early = acc < (G.D.config.graduation_pubs || 3);
      return sys("defense_offer", "Ready to defend?",
        early ? "You have " + acc + " first-author papers accepted and one under review. You could start defense preparation now and hope the third one lands. Prep takes about three months."
          : "You have " + acc + " first-author papers accepted. Defense preparation takes about three months of thesis writing and slides.",
        [{ label: "Start defense prep", desc: "Part of every week goes to the thesis and slides." }, { label: "Not yet" }]);
    }
    case "internship_apply":
      return sys("internship_apply", "Summer internships",
        "Recruiting season is open. An internship means 12 weeks of industry research, real compute, and a lot of new people.",
        [{ label: "Apply broadly", desc: "Better odds. Career-prep days help." }, { label: "Apply to a couple of places" }, { label: "Skip this year" }]);
    case "internship_offer":
      return sys("internship_offer", "Internship offer from " + d.company,
        d.company + " offers you a summer internship: 12 weeks, starting late May.",
        [{ label: "Accept", desc: "Summer weekdays go to the internship; evenings and weekends are still yours." }, { label: "Decline and stay in the lab" }], d);
    case "fellowship_apply":
      return sys("fellowship_apply", "Fellowship applications",
        "A fellowship would pay your way for a year, with no TA duty. The research statement takes a couple of days.",
        [{ label: "Apply", desc: "Costs 2 days this week.", arrows: [] }, { label: "Skip it" }]);
    case "job_market_start":
      return sys("job_market_start", "The job market",
        "You're close enough to the finish line that people ask what's next. Going on the market takes time, but offers don't arrive on their own.",
        [{ label: "Apply everywhere", desc: "Academia and industry." }, { label: "Industry only" }, { label: "Academia only" },
          { label: "Something different", desc: "Startups, policy, writing, clinics." }, { label: "Not this year" }]);
    case "offers":
    case "final_offers": {
      if (item.sys === "final_offers" && s.acceptedOffer) {
        s.pendingEnding = s.acceptedOffer;
        return null;
      }
      const tracks = item.sys === "final_offers" ? ["academia", "industry", "startup", "other"] : (s.job && s.job.tracks) || ["industry"];
      const offers = computeOffers(G, tracks);
      s.offers = offers;
      const choices = offers.map(function (o) { return { label: "Accept: " + o.name, desc: o.desc }; });
      if (item.sys === "offers") choices.push({ label: "Decline them all for now", desc: "Try again next year." });
      return sys(item.sys, item.sys === "final_offers" ? "What's next, Doctor?" : "Offers",
        item.sys === "final_offers" ? "The degree is done. A few doors are open." : "After months of applications and interviews, here's what came back.",
        choices, {});
    }
    case "leave":
      return leavePrompt(G);
    case "idle_nudge":
      if (activeProjects(G).some(function (p) { return p.firstAuthor !== false; })) return null;
      return sys("idle_nudge", "What's next?",
        "In your one-on-one, your advisor asks what you're working on next. Right now, the honest answer is \u201cnothing in particular\u201d.",
        [{ label: "Start a new project", desc: "Pick a kind of project and a topic." }, { label: "Keep reading for now", desc: "Ideas from reading give a new project a head start." }]);
    case "notice":
      return notice(d.title, d.text);
    default:
      return null;
  }
}

export function leavePrompt(G) {
  const s = G.state;
  const choices = [];
  const ids = [];
  if (yearOf(s.turn) >= 2) { choices.push({ label: "Leave with a Master's", desc: "A real degree and a fresh start." }); ids.push("masters_out"); }
  if (s.flags.bubble_tea_dream) { choices.push({ label: "Open the bubble tea shop", desc: "You've been thinking about it." }); ids.push("bubble_tea"); }
  if (s.flags.med_school_curious) { choices.push({ label: "Apply to med school", desc: "The clinicians were right about you." }); ids.push("switched_fields"); }
  if (s.flags.family_business) { choices.push({ label: "Join the family business", desc: "They've been asking." }); ids.push("family_business"); }
  choices.push({ label: "Never mind, keep going" });
  ids.push(null);
  return sys("leave", "Leave the PhD?", "Leaving isn't losing. Plenty of good lives start here. Where would you go?", choices, { ids: ids });
}

// ---- Handling answers -------------------------------------------------------

function empty(text) { return { text: text || "", visible: [], hidden: [], notes: [] }; }

export function handleSys(G, prompt, choice) {
  const s = G.state;
  const d = prompt.data || {};
  switch (prompt.sys) {
    case "notice": return null;
    case "first_project":
      if (choice === 0) {
        const t = G.rng.pick(s.world.topics);
        const type = G.rng.pick(["empirical", "empirical", "study", "dataset"]);
        const p = createProject(G, type, t.id, { stageIdx: 2, seedQuality: 45, bonusN: -3, source: "inherited" });
        p.firstAuthor = true;
        s.flags.inherited_project = true;
        autoTarget(G, p);
        return empty("You inherit “" + p.title + "”, its code, and its mysteries.");
      }
      s.turnItems.unshift({ kind: "sys", sys: "new_project", data: { required: true, title: "Your first project" } });
      return null;
    case "submit": {
      const p = proj(G, d.projectId);
      if (!p) return null;
      if (choice === 2) {
        autoTarget(G, p, { minLead: 1 });
        p.target = p.target && p.target.turn <= s.turn ? null : p.target;
        if (!p.target) autoTarget(G, p, { minLead: 2 });
        return empty("You let this one go. Next target: " + (deadlineLabel(G, p) || "to be decided") + ".");
      }
      p.submitting = { preprint: choice === 0 };
      addStatus(G, "deadline_mode", 1);
      const items = fireHook(G, "deadline", { projectId: p.id, venue: deadlineLabel(G, p) });
      for (let i = items.length - 1; i >= 0; i--) s.turnItems.unshift(items[i]);
      return empty("Deadline mode. Everything else can wait two weeks.");
    }
    case "the_question": {
      const p = proj(G, d.projectId);
      if (p && choice === 0) { p.fixFocus = d.comp; return empty("You know what to fix. Now you need the days."); }
      return empty("You write the question on a sticky note and move on.");
    }
    case "decision": {
      const pp = paper(G, d.paperId);
      const p = pp && proj(G, pp.projectId);
      const o = d.outcome;
      if (d.coauthor) {
        if (o === "findings") acceptPaper(G, pp, true);
        const dd = addStat(G, "sanity", o === "reject" ? -1 : 3);
        addStat(G, "labmates_rel", 2);
        return { text: o === "reject" ? "Not every paper is yours to carry." : "A line on your CV you helped earn.", visible: [{ stat: "sanity", amount: dd }], hidden: [], notes: [] };
      }
      if (o === "accept") {
        let san = G.rng.triangular(10, 3);
        if (hasTrait(G, "imposter_syndrome")) san -= 3;
        const dd = addStat(G, "sanity", san);
        addStat(G, "advisor_rel", 3);
        return { text: "You tell your family. They ask what it means. You explain for twenty minutes.", visible: [{ stat: "sanity", amount: dd }], hidden: ["Your advisor seems pleased."], notes: [] };
      }
      if (o === "findings") {
        if (choice === 0) { acceptPaper(G, pp, true); return empty("Findings it is. A publication is a publication."); }
        rejectPaper(G, pp);
        if (p) { p.status = "active"; p.revise = true; p.progress = 0; nextResubmitTarget(G, p, false); }
        return empty("You withdraw and start revising.");
      }
      if (o === "revise" || o === "major_revision") {
        if (choice === 0 && p) {
          pp.status = "revise_resubmit";
          p.status = "active"; p.revise = true; p.progress = 0;
          if (pp.journal) p.target = { venueId: pp.venueId, cycle: pp.cycle, turn: null, journalPaper: pp.id };
          else {
            const c = G.D.venueById[pp.venueId].cycles[pp.cycle];
            p.target = { venueId: pp.venueId, cycle: pp.cycle, turn: pp.submittedTurn + weeks(c.revision_due_in || 7), rrPaper: pp.id };
          }
         
          return empty("Revision mode. Every reviewer comment is now a to-do item.");
        }
        rejectPaper(G, pp);
        if (p) { p.status = "active"; p.revise = true; p.progress = 0; nextResubmitTarget(G, p, false); }
        return empty("You withdraw it and look for another venue.");
      }
      // Rejected (or desk rejected): sanity hit then a plan.
      let hit = G.rng.triangular(-8, 3);
      if (hasTrait(G, "rejection_hardened")) hit = Math.round(hit / 2);
      if (hasTrait(G, "perfectionist")) hit = Math.round(hit * 1.3);
      const dd = addStat(G, "sanity", hit);
      if (p) {
        if (choice === 2) { p.status = "shelved"; return { text: "You shelve it. It still taught you something.", visible: [{ stat: "sanity", amount: dd }], hidden: [], notes: [] }; }
        p.status = "active"; p.revise = true; p.progress = 0;
        nextResubmitTarget(G, p, choice === 1);
       
        return { text: "Back to the draft. Next stop: " + (deadlineLabel(G, p) || "the next deadline") + ".", visible: [{ stat: "sanity", amount: dd }], hidden: [], notes: [], tip: s.telemetry.rejections === 1 ? "Critique-Centric Feedback" : null };
      }
      return { text: "", visible: [{ stat: "sanity", amount: dd }], hidden: [], notes: [] };
    }
    case "conference": {
      const pp = paper(G, d.paperId);
      const opt = d.options[choice];
      s.flags.trip_planned = s.papers.some(function (x) { return x.status === "accepted" && x.conferenceTurn && x.conferenceTurn > s.turn; });
      if (opt === "remote") {
        const wasVisa = !!s.flags.visa_failed;
        delete s.flags.visa_failed;
        if (wasVisa) unlock(G, "remote_presenter");
        addStat(G, "network", 2);
        return empty("You present to a camera and a small grid of faces. Two of them ask great questions.");
      }
      if (opt === "grant") {
        if (G.rng.chance(0.5 + s.stats.network / 400)) { attend(G, pp, d.city, 0); return null; }
        addStat(G, "network", 2);
        return empty("No grant this time. You present remotely.");
      }
      attend(G, pp, d.city, opt === "volunteer" ? 2 : 0);
      return null;
    }
    case "proposal_offer":
      if (choice === 0) {
        s.milestones.proposalAt = s.turn + weeks(G.D.config.proposal_prep_turns || 4);
        addStatus(G, "proposal_prep", weeks(G.D.config.proposal_prep_turns || 4));
        s.committee = genCommittee(G, 4);
        s.readiness = 0;
        return empty("Your committee: " + s.committee.map(function (c) { return c.name; }).join(", ") + ". The date is set.");
      }
      s.milestones.proposalNextOffer = s.turn + 6;
      return empty("Not yet. Your advisor will ask again.");
    case "defense_offer":
      if (choice === 0) {
        const turns = weeks(G.D.config.defense_prep_turns || 6);
        s.milestones.defensePrepStart = s.turn;
        s.milestones.defenseAt = s.turn + turns;
        while (tOf(s.milestones.defenseAt) === 9) s.milestones.defenseAt += 1;
        addStatus(G, "defense_prep", turns);
        s.readiness = 0;
        const items = [];
        return empty("Defense prep begins. Thesis chapters, slides, and a date with your committee in about three months.");
      }
      s.milestones.defenseNextOffer = s.turn + 6;
      return empty("Not yet.");
    case "internship_apply":
      if (choice === 2) return empty("Maybe next year.");
      s.internship = { applied: choice === 0 ? "broad" : "few", year: yearOf(s.turn) };
      s.flags.internship_applied = true;
      return empty(choice === 0 ? "Thirty applications, one cover letter, many small edits." : "Two careful applications.");
    case "internship_offer":
      if (choice === 0) {
        s.internship.accepted = { company: d.company, year: yearOf(s.turn) };
        return empty("You sign. Summer will look different this year.");
      }
      return empty("You stay in the lab for the summer.");
    case "fellowship_apply":
      if (choice === 0) {
        s.dayAdj -= 2;
        s.fellowship = { year: yearOf(s.turn), applied: true };
        s.flags.fellowship_applied = true;
        return { text: "Research statement submitted. Results come in the spring.", visible: [{ stat: "days", amount: -2 }], hidden: [], notes: [] };
      }
      return empty("Not this year.");
    case "job_market_start": {
      const map = [["academia", "industry"], ["industry"], ["academia"], ["startup", "other", "industry"]];
      if (choice === 4) { s.job = { skipYear: yearOf(s.turn) }; return empty("Not this year. The thesis comes first."); }
      s.job = { tracks: map[choice], year: yearOf(s.turn) };
      s.flags.on_market = true;
      addStatus(G, "job_market", weeks(16));
      return empty("You polish your CV, your website and your research statement, in that order, several times.");
    }
    case "offers":
    case "final_offers": {
      const offers = s.offers || [];
      if (choice < offers.length) {
        s.acceptedOffer = offers[choice].id;
        removeStatus(G, "job_market");
        if (prompt.sys === "final_offers" || s.milestones.graduated) { s.pendingEnding = s.acceptedOffer; return null; }
        return empty("You accept: " + offers[choice].name + ". They'll wait until you defend.");
      }
      s.job = { skipYear: yearOf(s.turn) };
      removeStatus(G, "job_market");
      return empty("You decline. Next year, then.");
    }
    case "idle_nudge":
      if (choice === 0) s.turnItems.unshift({ kind: "sys", sys: "new_project", data: { title: "Your next project" } });
      return null;
    case "leave": {
      const id = d.ids[choice];
      if (!id) return empty("You stay. Tomorrow is another day.");
      s.pendingEnding = id;
      return null;
    }
    default:
      return null;
  }
}

// Called by the turn engine at the start of each turn to queue milestone items.
export function queueMilestones(G) {
  const s = G.state;
  const cfg = G.D.config;
  const t = tOf(s.turn);
  const y = yearOf(s.turn);
  const m = s.milestones;
  const items = [];
  if (!s.advisor && y === 1 && t <= 8 && firstWeek(s.turn) && (t <= 2 || t === 8 || t % 2 === 0)) items.push({ kind: "sys", sys: "matching" });

  // Quals at T18 of the quals year (retake the following year).
  const qualsYear = m.quals === "failed_once" ? m.qualsYear + 1 : m.qualsYear;
  if (m.quals !== "passed" && y === qualsYear && s.advisor) {
    if (t === cfg.quals_turn - 6 && firstWeek(s.turn)) { addStatus(G, "quals_prep", weeks(6)); s.readiness = 0; log(G, "Quals are in twelve weeks. Reading papers now counts as preparation.", "news"); }
    if (t === cfg.quals_turn && firstWeek(s.turn)) items.push({ kind: "sys", sys: "qa", data: { stage: "quals" } });
  }

  // Proposal day (scheduling it is a plan action).
  if (m.proposalAt && s.turn === m.proposalAt && m.proposal === "pending") {
    items.push({ kind: "sys", sys: "qa", data: { stage: "proposal" } });
  }

  // Defense day (starting prep is a plan action), graduation.
  if (m.defenseAt && s.turn >= m.defenseAt && m.defense === "pending") {
    if (firstAuthorPubs(G) >= (cfg.graduation_pubs || 3)) {
      fireHook(G, "defense", {}).forEach(function (it) { items.push(it); });
      items.push({ kind: "sys", sys: "qa", data: { stage: "defense" } });
      m.defenseAt = null;
    } else if (s.turn === m.defenseAt) {
      removeStatus(G, "defense_prep");
      log(G, "Your thesis is ready, but you have only " + firstAuthorPubs(G) + " first-author papers accepted. The defense happens as soon as the third one lands.", "news");
    }
  }
  if (m.graduateAt && s.turn >= m.graduateAt && !m.graduated) {
    m.defense = "passed";
    graduate(G);
  }

  // Fellowship results at T12.
  if (t === 12 && s.fellowship && s.fellowship.applied && s.fellowship.year === y && !s.fellowship.decided) {
    s.fellowship.decided = true;
    const p = clamp(0.08 + s.stats.taste / 400 + firstAuthorPubs(G) * 0.08 + (s.advisor ? (s.advisor.params.fame - 3) * 0.03 : 0), 0.03, 0.6);
    if (G.rng.chance(p)) {
      s.flags.fellowship_won = true;
      s.fellowshipYear = y + 1;
      log(G, "You won the fellowship! Next academic year is yours: no TA duty, and a line on your CV that people notice.", "good");
    } else {
      log(G, "Fellowship results: not this time. The feedback is polite and mostly about \u201cbroader impacts\u201d.", "news");
    }
  }

  // Internship offers at T14, the internship itself T20–T25.
  if (t === 14 && s.internship && s.internship.applied && s.internship.year === y && !s.internship.decided) {
    s.internship.decided = true;
    const hire = s.world.hiring === "boom" ? 1.3 : s.world.hiring === "freeze" ? 0.5 : 1;
    const p = clamp((0.3 + s.stats.network * 0.004 + s.stats.coding * 0.003 + s.careerPrep * 0.03) * hire, 0.05, 0.9);
    if (G.rng.chance(p)) items.push({ kind: "sys", sys: "internship_offer", data: { company: G.rng.pick(G.D.names.companies || ["a tech company"]) } });
    else log(G, "Internship season: no offers this year. A few nice rejection emails, and one that called you by someone else's name.", "news");
    s.careerPrep = 0;
  }
  if (s.internship && s.internship.accepted && s.internship.accepted.year === y) {
    if (t === 20 && firstWeek(s.turn) && !s.internship.accepted.started) { s.internship.accepted.started = true; addStatus(G, "on_internship", weeks(6)); log(G, "Your internship at " + s.internship.accepted.company + " starts. Weekends are still yours.", "news"); }
    if (t === 26 && !s.internship.accepted.done) {
      s.internship.accepted.done = true;
      s.telemetry.internships++;
      s.flags.interned = true;
      const lines = [];
      if (G.rng.chance(0.3 + s.stats.coding / 300)) { s.flags.return_offer = true; lines.push("They offer you a full-time return offer, whenever you're ready."); }
      if (G.rng.chance(0.4)) {
        lines.push("Your internship project turns into a paper you can submit.");
        internshipPaper(G, s.internship.accepted.company);
      }
      log(G, "Your internship at " + s.internship.accepted.company + " ends. " + (lines.join(" ") || "You leave with new friends and better code."), "news");
    }
  }

  // Job market (going on it is a plan action).
  if (hasStatus(G, "job_market")) {
    if (t === 8 && firstWeek(s.turn)) {
      const job = s.job || {};
      if (job.tracks && job.tracks.indexOf("academia") >= 0) items.push({ kind: "sys", sys: "qa", data: { stage: "job_talk" } });
    }
    if (t === 16 && firstWeek(s.turn)) items.push({ kind: "sys", sys: "offers" });
  }
  return items;
}

// Things you can choose to do this turn beyond the everyday activities.
// `slot: true` uses one of the turn's choices; the rest are free.
export function planExtras(G) {
  const s = G.state;
  const cfg = G.D.config;
  const t = tOf(s.turn);
  const y = yearOf(s.turn);
  const m = s.milestones;
  const out = [];
  if (!s.advisor || m.graduated) return out;
  activeProjects(G).forEach(function (p) {
    if (!p.target || p.target.rrPaper || p.target.journalPaper || p.target.turn !== s.turn || !isReadyish(G, p)) return;
    const pct = Math.round(writingCompletion(G, p) * 100);
    out.push({ id: "submit:" + p.id, kind: "submit", label: "Submit \u201c" + p.short + "\u201d to " + deadlineLabel(G, p),
      desc: "The draft is " + pct + "% written. It needs at least half a draft by the end of this week; the more finished, the clearer the paper.",
      preprint: true, suggested: pct >= 35 });
  });
  if (y >= 2 && y <= 5 && t >= 2 && t <= 7 && !(s.internship && s.internship.year === y) && !s.flags.on_market && !hasStatus(G, "defense_prep")) {
    out.push({ id: "apply_internship", kind: "apply", slot: true, label: "Apply for summer internships",
      desc: "Twelve weeks of industry research next summer. Offers arrive in March.",
      arrows: [{ stat: "energy", dir: "down", strength: 1 }, { stat: "presenting", dir: "up", strength: 1 }] });
  }
  if (y <= 3 && t >= 3 && t <= 6 && !s.flags.fellowship_won && !(s.fellowship && s.fellowship.year === y)) {
    out.push({ id: "apply_fellowship", kind: "apply", slot: true, label: "Apply for a fellowship",
      desc: "A year without TA duty if you win. Results in February.",
      arrows: [{ stat: "energy", dir: "down", strength: 1 }, { stat: "writing", dir: "up", strength: 1 }] });
  }
  if (m.proposal === "pending" && m.quals === "passed" && !m.proposalAt && t !== 9 &&
    y >= (cfg.proposal_min_year || 3) && firstAuthorPubs(G) >= (cfg.proposal_min_pubs || 2)) {
    out.push({ id: "proposal", kind: "milestone", label: "Schedule your thesis proposal",
      desc: "Present to your committee in " + weeks(cfg.proposal_prep_turns || 4) + " weeks. Project work until then counts as preparation." });
  }
  if (m.proposal === "passed" && !m.defensePrepStart && t !== 9) {
    const acc = firstAuthorPubs(G);
    const need = cfg.graduation_pubs || 3;
    const strictNoEarly = s.advisor.archetype === "methods_purist";
    const early = acc < need;
    if (acc >= need || (!strictNoEarly && acc === need - 1 && pendingFirstAuthor(G) >= 1)) {
      out.push({ id: "defense", kind: "milestone", label: "Start defense preparation",
        desc: "About three months of thesis writing and slides (part of every week)." + (early ? " Your third paper is still under review: if it's rejected, the defense waits." : "") });
    }
  }
  if (m.proposal === "passed" && y >= 4 && t >= 1 && t <= 4 && !hasStatus(G, "job_market") && !s.acceptedOffer && !(s.job && s.job.year === y)) {
    out.push({ id: "job_market", kind: "milestone", label: "Go on the job market",
      desc: "Applications this fall, interviews over the winter, offers in the spring." });
  }
  return out;
}

export function applyPlanExtra(G, id, opts) {
  const s = G.state;
  const cfg = G.D.config;
  const y = yearOf(s.turn);
  if (id.indexOf("submit:") === 0) {
    const p = proj(G, id.slice(7));
    if (!p || p.status !== "active") return;
    p.submitting = { preprint: !(opts && opts.preprint === false) };
    addStatus(G, "deadline_mode", 1);
    fireHook(G, "deadline", { projectId: p.id, venue: deadlineLabel(G, p) }).forEach(function (it) { s.endItems.push(it); });
    return;
  }
  switch (id) {
    case "apply_internship":
      s.internship = { applied: "broad", year: y };
      s.flags.internship_applied = true;
      log(G, "You send out internship applications: one CV, many small edits.", "news");
      break;
    case "apply_fellowship":
      s.fellowship = { year: y, applied: true };
      s.flags.fellowship_applied = true;
      log(G, "Fellowship application submitted. Results come in February.", "news");
      break;
    case "proposal":
      s.milestones.proposalAt = s.turn + weeks(cfg.proposal_prep_turns || 4);
      addStatus(G, "proposal_prep", weeks(cfg.proposal_prep_turns || 4));
      s.committee = genCommittee(G, 4);
      s.readiness = 0;
      log(G, "Proposal scheduled. Your committee: " + s.committee.map(function (c) { return c.name; }).join(", ") + ".", "news");
      break;
    case "defense": {
      const turns = weeks(cfg.defense_prep_turns || 6);
      s.milestones.defensePrepStart = s.turn;
      s.milestones.defenseAt = s.turn + turns;
      while (tOf(s.milestones.defenseAt) === 9) s.milestones.defenseAt += 1;
      addStatus(G, "defense_prep", turns);
      s.readiness = 0;
      log(G, "Defense preparation begins: thesis chapters, slides, and a date with your committee in about three months.", "news");
      break;
    }
    case "job_market":
      s.job = { tracks: ["academia", "industry", "startup", "other"], year: y };
      s.flags.on_market = true;
      addStatus(G, "job_market", weeks(16));
      log(G, "You go on the job market. You polish your CV, your website and your research statement, in that order, several times.", "news");
      break;
  }
}

function internshipPaper(G, company) {
  const s = G.state;
  const topic = G.rng.pick(s.world.topics);
  const p = createProject(G, "empirical", topic.id, { stageIdx: 4, seedQuality: 50 + s.stats.coding / 5, bonusN: 2, source: "internship" });
  p.progress = 100;
  p.q.C.s = 40 + s.stats.writing * 0.5; p.q.C.n = 1;
  autoTarget(G, p, { minLead: 1 });
}

// Reviews, decisions and conferences for this turn. Only Findings needs a decision from you;
// everything else lands in the turn report.
export function queuePapers(G) {
  const s = G.state;
  const items = [];
  s.papers.forEach(function (pp) {
    if (pp.deskPending && pp.status === "under_review") {
      pp.deskPending = false;
      pp.deskReject = true;
      unlock(G, "desk_rejected");
      autoReject(G, pp);
      return;
    }
    if (pp.status === "under_review" && pp.rebuttal && pp.reviewsTurn === s.turn && !pp.reviews && pp.firstAuthor) {
      generateReviews(G, pp);
      const hit = sanityFromScores(pp.reviews);
      addStat(G, "sanity", hit);
      log(G, "Reviews are in for \u201c" + pp.short + "\u201d: " + pp.reviews.map(function (r) { return r.score; }).join(", ") + " out of 5.", "news");
      fireHook(G, "reviews_in", { paperId: pp.id }).forEach(function (it) { items.push(it); });
      items.push({ kind: "sys", sys: "rebuttal", data: { paperId: pp.id } });
    }
    if (pp.status === "under_review" && pp.decisionTurn === s.turn) {
      const outcome = decide(G, pp);
      if (!pp.firstAuthor) {
        const who = pp.coauthor || "Your labmate";
        if (outcome === "accept" || outcome === "findings") {
          acceptPaper(G, pp, outcome === "findings");
          addStat(G, "labmates_rel", 2);
          log(G, who + "'s paper, with you as a co-author, is accepted at " + pp.venueName + ".", "good");
        } else {
          pp.status = "rejected";
          log(G, who + "'s paper, with you as a co-author, is rejected. " + who + " shrugs and starts revising.", "news");
        }
      } else if (outcome === "accept") {
        acceptPaper(G, pp, false);
        let san = G.rng.triangular(10, 3);
        if (hasTrait(G, "imposter_syndrome")) san -= 3;
        addStat(G, "sanity", san);
        addStat(G, "advisor_rel", 3);
        const line = metaLine(G, "accept");
        log(G, "Accepted at " + pp.venueName + ": \u201c" + pp.title + "\u201d!" + (line ? " Meta-review: \u201c" + line + "\u201d" : ""), "good");
      } else if (outcome === "findings") {
        items.push({ kind: "sys", sys: "decision", data: { paperId: pp.id, outcome: outcome } });
      } else if (outcome === "revise" || outcome === "major_revision") {
        autoRevise(G, pp);
      } else {
        autoReject(G, pp);
      }
    }
    if (pp.status === "accepted" && pp.conferenceTurn === s.turn) autoConference(G, pp);
  });
  // The Dark Angel's question comes the week before a deadline.
  activeProjects(G).forEach(function (p) {
    if (!p.target || p.target.rrPaper || p.target.journalPaper) return;
    const ttd = p.target.turn - s.turn;
    if (ttd === 1 && s.advisor && s.advisor.archetype === "kind_funded" && isReadyish(G, p)) items.push({ kind: "sys", sys: "the_question", data: { projectId: p.id } });
  });
  return items;
}

function autoReject(G, pp) {
  const s = G.state;
  rejectPaper(G, pp);
  let hit = G.rng.triangular(-8, 3);
  if (hasTrait(G, "rejection_hardened")) hit = Math.round(hit / 2);
  if (hasTrait(G, "perfectionist")) hit = Math.round(hit * 1.3);
  addStat(G, "sanity", hit);
  const p = proj(G, pp.projectId);
  const scores = pp.reviews ? " Scores: " + pp.reviews.map(function (r) { return r.score; }).join(", ") + "." : "";
  if (p) {
    p.status = "active"; p.revise = true; p.progress = 0;
    nextResubmitTarget(G, p, false);
    log(G, (pp.deskReject ? "Desk rejected at " : "Rejected at ") + pp.venueName + ": \u201c" + pp.short + "\u201d." + scores +
      " You'll revise it for " + (deadlineLabel(G, p) || "the next deadline") + " (change the target or shelve it in Projects).", "bad");
  } else {
    log(G, "Rejected at " + pp.venueName + ": \u201c" + pp.short + "\u201d." + scores, "bad");
  }
}

function autoRevise(G, pp) {
  const s = G.state;
  const p = proj(G, pp.projectId);
  if (!p) { rejectPaper(G, pp); return; }
  pp.status = "revise_resubmit";
  p.status = "active"; p.revise = true; p.progress = 0;
  if (pp.journal) p.target = { venueId: pp.venueId, cycle: pp.cycle, turn: null, journalPaper: pp.id };
  else {
    const c = G.D.venueById[pp.venueId].cycles[pp.cycle];
    p.target = { venueId: pp.venueId, cycle: pp.cycle, turn: pp.submittedTurn + weeks(c.revision_due_in || 7), rrPaper: pp.id };
  }
  log(G, (pp.journal ? "Major revision" : "Revise and resubmit") + " for \u201c" + pp.short + "\u201d at " + pp.venueName +
    ". Work on it to address the reviews; it goes back " + (pp.journal ? "when the revision is done." : "when the revision is due."), "news");
}

function isReadyish(G, p) {
  const st = PROJECT_TYPES[p.type].stages[p.stageIdx];
  return p.revise || (st && st.id === "writing" && writingCompletion(G, p) >= 0.25);
}

// End of turn: finalize submissions and revisions.
export function finishSubmissions(G) {
  const s = G.state;
  activeProjects(G).forEach(function (p) {
    if (p.fixFocus) {
      if ((p.days || 0) >= 2) { p.fixedComp = p.fixFocus; p.bonus[p.fixFocus] += 6; s.flags.kf_flaw_fixed = true; log(G, "You fixed the weakest part of “" + p.short + "” before submitting."); }
      p.fixFocus = null;
    }
    // CHI revise-and-resubmit and journal revisions.
    if (p.revise && p.target && (p.target.rrPaper || p.target.journalPaper)) {
      const pp = paper(G, p.target.rrPaper || p.target.journalPaper);
      if (!pp) return;
      const due = p.target.rrPaper ? p.target.turn === s.turn : isReady(G, p);
      if (!due) return;
      const improve = writingCompletion(G, p) * 8 + (p.bonus.C + p.bonus.S) * 0.3;
      pp.round = 2;
      pp.roundBonus = improve;
      pp.status = "under_review";
      const c = G.D.venueById[pp.venueId].cycles[pp.cycle];
      pp.decisionTurn = p.target.rrPaper ? pp.submittedTurn + weeks(c.final_in || c.decision_in + 5) : s.turn + weeks(4);
      if (pp.decisionTurn <= s.turn) pp.decisionTurn = s.turn + 1;
      p.status = "submitted"; p.revise = false; p.target = null;
      log(G, "You send the revision of “" + pp.short + "” back to " + pp.venueName + ".");
      return;
    }
    if (p.submitting) {
      const opts = p.submitting;
      if (isReady(G, p)) {
        const pp = makePaper(G, p, opts);
        log(G, "Submitted “" + pp.short + "” to " + pp.venueName + (pp.preprint ? ", with a preprint." : "."));
        s.pendingHooks.push({ hook: "after_submit", ctx: { paperId: pp.id } });
      } else {
        p.submitting = false;
        addStat(G, "sanity", -3);
        log(G, "“" + p.short + "” wasn't ready in time. On to the next deadline.");
        p.target = null;
        autoTarget(G, p, { minLead: 2 });
      }
    }
  });
}

export { notice, sys };
