// A week at a conference (Arthur, 2026-10-24: going to a conference should feel real: tiring, tense
// and stressful, but also a lot of fun and full of surprises). When an accepted paper's conference
// comes and there's money to travel, the conference card (milestones.js) offers the whole week.
//
// The week is eight steps, from Sunday evening to Thursday's flight home, two a day. Each step offers
// a few things to do (conference.yml activities), and many of them lead into an event from that kind
// of moment (events/conference.yml, hooks conf_*). Your talk or poster is Monday, Tuesday or
// Wednesday: something always goes wrong on stage, then the audience asks two questions, answered as
// at quals. Wednesday evening is the conference party. Energy drains all week and jet lag makes the
// first day harder; Stress builds until your talk is over; the people you meet are counted as
// contacts (the "contacts" effect), which become Network when you fly home.
import { t, T_ } from "./i18n.js";
import { fill } from "./templating.js";
import { applyOutcome, addStat, addStatus, removeStatus, spendDays } from "./effects.js";
import { drawHook, arrowsFor } from "./events.js";
import { check } from "./conditions.js";
import { asList, clamp } from "./util.js";
import { hasTrait } from "./derived.js";
import { unlock } from "./achievements.js";

export const STEPS = [
  { day: 1, slot: "night" }, { day: 2, slot: "day" }, { day: 2, slot: "night" }, { day: 3, slot: "day" },
  { day: 3, slot: "night" }, { day: 4, slot: "day" }, { day: 4, slot: "night" }, { day: 5, slot: "day" }
];
export const PARTY = 6;
const LAST = 7;
// Your talk or poster: Monday, Tuesday or Wednesday daytime.
const TALK_AT = [1, 3, 5];
export const WEEKDAY = [T_("Sunday"), T_("Monday"), T_("Tuesday"), T_("Wednesday"), T_("Thursday")];
const SLOT = { day: T_("daytime"), night: T_("evening") };
// Which activities a scene offers (conference.yml activities' slots).
const SLOT_OF = { arrival: "arrival", day: "day", night: "night", eve: "night", after: "night", party: "party", last: "last" };

// Answering a question from the audience, as at quals and the defense.
export const STRATEGIES = [
  { id: "direct", label: T_("Answer directly"), desc: T_("Best when they're testing what you know.") },
  { id: "acknowledge", label: T_("Acknowledge the limitation"), desc: T_("Best when they've found a real weakness.") },
  { id: "reframe", label: T_("Reframe the question"), desc: T_("Best when they're asking why it matters.") },
  { id: "stall", label: T_("“Great question…”"), desc: T_("Buys time. Rarely enough.") }
];
const BEST = { knowledge: ["direct"], weakness: ["acknowledge"], big_picture: ["reframe"], gotcha: ["acknowledge", "reframe"] };
const HINT = {
  knowledge: T_("They wanted a straight answer."),
  weakness: T_("They had found a real weakness; owning it would have landed better."),
  big_picture: T_("They were asking why it matters; reframing would have helped."),
  gotcha: T_("It was a trap; acknowledging or reframing beats a direct answer.")
};
const QUESTIONS = 2;
// Every part of the week is a long one, more tiring than a day in the lab (Energy); until your talk is
// over, it weighs on you (Stress, as sanity). Measured 2026-10-24 over 150 bot runs: the week costs
// about 20 Energy and adds a little Stress overall, with relief after the talk and at the party.
const LONG_DAY = -1, PRESSURE = -3;

function conf(G) { return G.D.conference || { scenes: [], activities: [], questions: [], askers: [] }; }
function ctxOf(trip) { return { city: trip.city, venue: trip.venue, paperId: trip.paperId }; }

// What happens at this step of the week: arrival, a day of the conference, an evening, the evening
// before or after your talk, the talk (or poster) itself, the party, or the last day.
export function sceneOf(trip, i) {
  if (i === trip.talkAt) return trip.kind;
  if (i === 0) return "arrival";
  if (i === PARTY) return "party";
  if (i === LAST) return "last";
  if (i === trip.talkAt - 1) return "eve";
  if (i === trip.talkAt + 1) return "after";
  return STEPS[i].slot;
}

export function stepLabel(i) {
  const st = STEPS[i];
  return t("Day {n} · {weekday} {slot}", { n: st.day, weekday: t(WEEKDAY[st.day - 1]), slot: t(SLOT[st.slot]) });
}

// Off to the conference for the week: five of this turn's days.
export function startTrip(G, pp, city, kind) {
  const s = G.state, st = s.stats;
  s.trip = {
    paperId: pp.id, venue: pp.venueName, city: city, kind: kind, talkAt: G.rng.weighted(TALK_AT, function (i) { return i === 3 ? 4 : 3; }),
    step: 0, contacts: 0, prep: 0, jet: G.rng.chance(0.7), options: [], qa: null, talk: null, used: [],
    start: { energy: st.energy, sanity: st.sanity, health: st.health }
  };
  addStatus(G, "at_conference", 1);
  spendDays(G, G.D.config.fixed_days.conference || 5);
  s.turnItems.unshift({ kind: "sys", sys: "trip" });
}

// The way to rest and anything marked always (rehearsing, before your talk) are offered whenever they
// fit, then more picked at random up to four. The way to rest comes last.
function pickOptions(G, trip) {
  const slot = SLOT_OF[sceneOf(trip, trip.step)];
  const before = trip.step < trip.talkAt;
  const pool = conf(G).activities.filter(function (a) {
    if (asList(a.slots).indexOf(slot) < 0) return false;
    if (a.kind && a.kind !== trip.kind) return false;
    if (a.talk === "before" && !before) return false;
    if (a.talk === "after" && before) return false;
    if (a.talk === "just_after" && trip.step !== trip.talkAt + 1) return false;
    return check(a.when, G, ctxOf(trip));
  });
  const out = pool.filter(function (a) { return a.always || a.rest; });
  let rest = pool.filter(function (a) { return !a.always && !a.rest; });
  while (out.length < 4 && rest.length) {
    const a = G.rng.weighted(rest, function (x) { return x.weight || 1; });
    out.push(a);
    rest = rest.filter(function (x) { return x !== a; });
  }
  out.sort(function (a, b) { return (a.rest ? 1 : 0) - (b.rest ? 1 : 0); });
  return out.map(function (a) { return a.id; });
}

// A scene's line, avoiding one already shown this week.
function sceneText(G, trip, id) {
  const sc = conf(G).scenes.find(function (x) { return x.id === id; });
  if (!sc) return "";
  const all = asList(sc.text);
  const fresh = all.filter(function (x) { return trip.used.indexOf(x) < 0; });
  const pick = G.rng.pick(fresh.length ? fresh : all);
  trip.used.push(pick);
  return fill(pick, G, ctxOf(trip));
}

function activity(G, id) { return conf(G).activities.find(function (x) { return x.id === id; }); }

// The card for where the week is: a question from the audience, your talk about to start, or what to
// do with this part of the day.
export function tripPrompt(G) {
  const s = G.state, trip = s.trip;
  if (!trip) return null;
  const ctx = ctxOf(trip);
  const base = { trip: true, step: trip.step, kind: trip.kind };
  if (trip.qa) {
    const qa = trip.qa;
    const q = conf(G).questions.find(function (x) { return x.id === qa.ids[qa.i]; });
    const who = conf(G).askers.find(function (x) { return x.id === qa.who[qa.i]; });
    return sys("trip", t("Questions · {i} of {n}", { i: qa.i + 1, n: qa.ids.length }),
      t("{who}: “{q}”", { who: who ? fill(who.label, G, ctx) : t("Someone in the audience"), q: fill(q.text, G, ctx) }),
      STRATEGIES.map(function (x) { return { label: t(x.label), desc: t(x.desc) }; }), Object.assign(base, { qa: true }));
  }
  const scene = sceneOf(trip, trip.step);
  if (trip.step === trip.talkAt) {
    const ready = trip.prep >= 6 ? t("You've run through it so many times you could give it in your sleep.") :
      trip.prep >= 3 ? t("You've practiced. Mostly.") : t("You haven't practiced as much as you meant to.");
    return sys("trip", stepLabel(trip.step), sceneText(G, trip, scene) + " " + ready,
      [{ label: trip.kind === "poster" ? t("Put up your poster") : t("Walk up to the podium") }], Object.assign(base, { talkStart: true }));
  }
  trip.options = pickOptions(G, trip);
  let text = sceneText(G, trip, scene);
  if (s.stats.energy < 15) text += " " + t("You're running on fumes.");
  const choices = trip.options.map(function (id) {
    const a = activity(G, id);
    return { label: fill(a.label, G, ctx), desc: fill(a.desc || "", G, ctx), arrows: arrowsFor(a) };
  });
  return sys("trip", stepLabel(trip.step), text, choices, base);
}

function sys(id, title, text, choices, data) {
  return { type: "sys", sys: id, title: title, text: text,
    choices: choices.map(function (c, i) { return { i: i, label: c.label, desc: c.desc || "", arrows: c.arrows || [] }; }), data: data || {} };
}

// Adds to a result's visible changes, one line per stat.
function addVisible(list, stat, amount) {
  if (!amount) return;
  const v = list.find(function (x) { return x.stat === stat; });
  if (v) v.amount = Math.round((v.amount + amount) * 10) / 10;
  else list.push({ stat: stat, amount: amount });
}

// What comes next: any events this step brought, then the next card of the week (or the trip report).
function queueNext(G, events) {
  const s = G.state, trip = s.trip;
  s.turnItems.unshift({ kind: "sys", sys: trip.step >= STEPS.length && !trip.qa ? "trip_report" : "trip" });
  for (let i = events.length - 1; i >= 0; i--) s.turnItems.unshift(events[i]);
}

function untilTalk(trip) {
  const days = STEPS[trip.talkAt].day - STEPS[trip.step].day;
  if (trip.kind === "poster") return days <= 1 ? t("Your poster session is tomorrow.") : t("Your poster session is in {n} days.", { n: days });
  return days <= 1 ? t("Your talk is tomorrow.") : t("Your talk is in {n} days.", { n: days });
}

// Your choice at this point of the week.
export function answerTrip(G, prompt, choice) {
  const s = G.state, trip = s.trip;
  if (!trip) return null;
  const d = prompt.data || {};
  const ctx = ctxOf(trip);
  if (d.qa) {
    const res = answerQuestion(G, trip, choice);
    res.choiceLabel = t((STRATEGIES[choice] || STRATEGIES[3]).label);
    queueNext(G, []);
    return res;
  }
  if (d.talkStart) {
    // On stage: something always happens, then the questions.
    const ev = drawHook(G, trip.kind === "poster" ? "conf_poster" : "conf_talk", ctx, 1);
    const pool = conf(G).questions.filter(function (q) { return asList(q.for || ["talk", "poster"]).indexOf(trip.kind) >= 0; });
    const askers = conf(G).askers.filter(function (q) { return asList(q.for || ["talk", "poster"]).indexOf(trip.kind) >= 0; });
    const ids = [], who = [];
    for (let i = 0; i < QUESTIONS; i++) {
      const left = pool.filter(function (x) { return ids.indexOf(x.id) < 0; });
      if (!left.length) break;
      ids.push(G.rng.weighted(left, function (x) { return x.weight || 1; }).id);
      const free = askers.filter(function (x) { return who.indexOf(x.id) < 0; });
      who.push(free.length ? G.rng.pick(free).id : null);
    }
    trip.talk = { result: null };
    trip.qa = ids.length ? { ids: ids, who: who, i: 0, wins: 0 } : null;
    if (!trip.qa) trip.step++;
    queueNext(G, ev);
    return null;
  }
  const a = activity(G, trip.options[choice]) || activity(G, trip.options[0]);
  const res = applyOutcome(G, { text: G.rng.pick(asList(a.text)), effects: a.effects, flag_set: a.flag_set, achievement: a.achievement }, ctx);
  res.choiceLabel = fill(a.label, G, ctx);
  // Long days, jet lag the first evening and day, and the talk weighing on you until it's done.
  addVisible(res.visible, "energy", addStat(G, "energy", LONG_DAY + (trip.jet && trip.step <= 1 ? -2 : 0)));
  if (trip.step < trip.talkAt) addVisible(res.visible, "sanity", addStat(G, "sanity", PRESSURE));
  if (trip.jet && trip.step === 0) res.notes.push(t("Jet lag: your body thinks it's the middle of the night."));
  else if (trip.step < trip.talkAt) res.notes.push(untilTalk(trip));
  trip.did = a.id;
  const events = a.event && G.rng.chance(a.event.chance === undefined ? 1 : a.event.chance) ? drawHook(G, a.event.hook, ctx, 1) : [];
  trip.step++;
  queueNext(G, events);
  return res;
}

function answerQuestion(G, trip, choice) {
  const s = G.state;
  const qa = trip.qa;
  const q = conf(G).questions.find(function (x) { return x.id === qa.ids[qa.i]; }) || {};
  const strat = (STRATEGIES[choice] || STRATEGIES[3]).id;
  const fit = BEST[q.kind] && BEST[q.kind].indexOf(strat) >= 0 ? 15 : strat === "stall" ? -10 : -12;
  const tired = s.stats.energy < 25 ? -8 : 0;
  let p = clamp(0.5 + (s.stats.presenting + Math.min(10, trip.prep) * 1.5 + fit + tired - (q.difficulty || 50)) / 40, 0.08, 0.92);
  if (strat === "stall") p = Math.max(p, 0.25);
  const ok = G.rng.chance(p);
  const visible = [];
  if (ok) { qa.wins++; trip.contacts++; addVisible(visible, "contacts", 1); }
  addVisible(visible, "sanity", addStat(G, "sanity", ok ? 2 : -3));
  addStat(G, "presenting", ok ? 1 : 0.5);
  let line = ok ? G.rng.pick([t("They nod and write something down."), t("That lands."), t("A satisfied “good”."), t("They move on, convinced.")])
    : G.rng.pick([t("A long pause. They follow up."), t("They don't look convinced."), t("You can see them making a note."), t("That one will come up again.")]);
  if (!ok && fit < 15 && HINT[q.kind]) line += " " + t(HINT[q.kind]);
  qa.i++;
  if (qa.i < qa.ids.length) return { text: line, visible: visible, hidden: [], notes: [] };
  // That was the last question: how it went, and the relief of being done.
  const wins = qa.wins;
  const poster = trip.kind === "poster";
  const eff = wins >= 2 ? { "paper.citations": "+5±2", contacts: "+3±1", sanity: "+6±1", presenting: "+2" } :
    wins === 1 ? { "paper.citations": "+2±1", contacts: "+1", sanity: "+3±1", presenting: "+1" } : { sanity: "+1" };
  const res = applyOutcome(G, { effects: eff }, ctxOf(trip));
  visible.forEach(function (v) { addVisible(res.visible, v.stat, v.amount); });
  trip.talk.result = wins >= 2 ? "great" : wins === 1 ? "fine" : "rough";
  res.text = line + " " + (wins >= 2 ? (poster ? t("Your poster draws a crowd until they turn the lights off. Two people take pictures of it.") : t("Afterward, a small line forms to talk to you, and someone asks for your slides."))
    : wins === 1 ? (poster ? t("A steady trickle of visitors, and a few good conversations.") : t("Polite applause. A couple of people find you at the coffee break."))
    : (poster ? t("It's a quiet session. The few people who stop really listen, at least.") : t("It's over. Your hands stop shaking somewhere around the coffee break.")));
  trip.qa = null;
  trip.step++;
  return res;
}

function netGain(G, trip) {
  let n = Math.min(18, Math.round(trip.contacts * 0.9));
  if (hasTrait(G, "polyglot") || hasTrait(G, "international")) n += 2;
  return n;
}

const TALK_LINE = {
  talk: { great: T_("Your talk went really well."), fine: T_("Your talk went fine."), rough: T_("Your talk was rough, but you got through it.") },
  poster: { great: T_("Your poster was a hit."), fine: T_("Your poster session went fine."), rough: T_("Your poster session was quiet, but you got through it.") }
};
function talkLine(trip) { return trip.talk && trip.talk.result ? " " + t(TALK_LINE[trip.kind][trip.talk.result]) : ""; }

// Flying home: what the week came to.
export function tripReport(G) {
  const s = G.state, trip = s.trip;
  if (!trip) return null;
  const visible = [];
  addVisible(visible, "energy", Math.round(s.stats.energy - trip.start.energy));
  addVisible(visible, "sanity", Math.round(s.stats.sanity - trip.start.sanity));
  addVisible(visible, "health", Math.round(s.stats.health - trip.start.health));
  return sys("trip_report", t("Flying home from {venue}", { venue: trip.venue }),
    t("A week in {city}: talks, coffee, too little sleep and a lot of people. You met {n} people worth remembering.", { city: trip.city, n: trip.contacts }) + talkLine(trip) +
      (netGain(G, trip) >= 3 ? " " + t("More people in the field know your name now.") : ""),
    [{ label: t("Back to the lab") }], { trip: true, step: STEPS.length, kind: trip.kind, report: true, visible: visible });
}

export function finishTrip(G) {
  const s = G.state, trip = s.trip;
  if (!trip) return null;
  const net = netGain(G, trip);
  addStat(G, "network", net);
  s.telemetry.conferences++;
  s.world.cities[trip.city] = true;
  // Back for the rest of the turn, maybe jet-lagged.
  removeStatus(G, "at_conference");
  if (trip.jet || G.rng.chance(0.3)) addStatus(G, "jet_lagged", 1);
  unlock(G, "whole_week");
  const pp = s.papers.find(function (p) { return p.id === trip.paperId; });
  s.log.push({ turn: s.turn, kind: "news", phase: s.stage,
    text: t("A week at {venue} in {city}: you present “{title}” and meet {n} people.", { venue: trip.venue, city: trip.city, title: pp ? pp.short : "", n: trip.contacts }) + talkLine(trip) });
  s.trip = null;
  return null;
}
