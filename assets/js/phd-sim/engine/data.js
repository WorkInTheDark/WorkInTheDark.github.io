// Turns the raw JSON (site.data.phd_sim + the PhD 101 map) into indexed lookups.
import { asList } from "./util.js";

function indexBy(list, key) {
  const out = {};
  asList(list).forEach(function (it) { out[it[key || "id"]] = it; });
  return out;
}

function normalizeEvent(ev, file) {
  ev.file = file;
  ev.hook = ev.hook || "turn";
  ev.trigger = ev.trigger || "random";
  ev.rarity = ev.rarity || "common";
  ev.text = asList(ev.text);
  ev.choices = asList(ev.choices);
  return ev;
}

export function prepareData(raw) {
  const src = raw.data || raw;
  const D = {};
  D.phd101 = raw.phd101 || {};
  D.config = src.config || {};
  D.calendar = (src.calendar && src.calendar.turns) || [];

  D.events = [];
  D.eventById = {};
  D.byHook = {};
  const files = src.events || {};
  Object.keys(files).sort().forEach(function (file) {
    asList(files[file]).forEach(function (ev) {
      if (!ev || !ev.id) return;
      normalizeEvent(ev, file);
      D.events.push(ev);
      D.eventById[ev.id] = ev;
      if (ev.trigger !== "scheduled") {
        (D.byHook[ev.hook] = D.byHook[ev.hook] || []).push(ev);
      }
    });
  });

  D.flavor = [];
  Object.keys(src).forEach(function (k) {
    if (k.indexOf("flavor") === 0) D.flavor = D.flavor.concat(asList(src[k]));
  });

  const adv = src.advisors || {};
  D.archetypes = asList(adv.archetypes);
  D.archetypeById = indexBy(D.archetypes);
  D.quirks = asList(adv.quirks);

  const tr = src.traits || {};
  D.traits = asList(tr.start);
  D.earnedTraits = asList(tr.earned);
  D.traitById = indexBy(D.traits.concat(D.earnedTraits));

  D.statuses = asList(src.statuses);
  D.statusById = indexBy(D.statuses);

  const bg = src.backgrounds || {};
  D.backgrounds = asList(bg.backgrounds);
  D.backgroundById = indexBy(D.backgrounds);
  D.origins = asList(bg.origins);

  D.venues = asList(src.venues);
  D.venueById = indexBy(D.venues);
  D.topics = asList(src.topics);
  D.topicById = indexBy(D.topics);
  D.names = src.names || {};

  D.endings = asList(src.endings);
  D.endingById = indexBy(D.endings);
  D.titles = asList(src.titles);
  D.epilogues = asList(src.epilogues);
  D.achievements = asList(src.achievements);
  D.achievementById = indexBy(D.achievements);
  D.tips = asList(src.tips);
  D.recommendations = asList(src.recommendations);

  D.reviews = src.reviews || { personas: [], concerns: [], meta: {} };
  D.personaById = indexBy(D.reviews.personas);
  D.qa = src.qa || { questions: [], members: [] };
  return D;
}
