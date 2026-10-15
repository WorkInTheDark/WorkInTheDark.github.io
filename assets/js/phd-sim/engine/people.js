// Advisors, candidates, labmates, committees.
import { clone } from "./util.js";

const PERSONALITIES = [
  "Helpful Senior", "Competitive Peer", "Chaotic Genius", "Quiet Workhorse",
  "Social Glue", "Perpetual Fifth-Year", "Industry Dreamer", "Meme Curator"
];

export function personName(G) {
  const n = G.D.names;
  return { first: G.rng.pick(n.first || ["Alex"]), last: G.rng.pick(n.last || ["Lee"]) };
}

export function genCandidates(G) {
  const D = G.D;
  const pool = D.archetypes.slice();
  const out = [];
  const usedSurnames = {};
  for (let i = 0; i < 3 && pool.length; i++) {
    const a = G.rng.weighted(pool, function (x) { return x.weight === undefined ? 1 : x.weight; });
    pool.splice(pool.indexOf(a), 1);
    let nm = personName(G);
    while (usedSurnames[nm.last]) nm = personName(G);
    usedSurnames[nm.last] = true;
    const quirks = a.fixed_quirks ? a.fixed_quirks.slice() : G.rng.shuffle(D.quirks).slice(0, 2);
    // Rumors are right about 70% of the time.
    let rumor = a.id;
    if (!G.rng.chance(0.7)) {
      const others = D.archetypes.filter(function (x) { return x.id !== a.id && x.id !== "kind_funded"; });
      rumor = G.rng.pick(others).id;
    }
    const topic = G.rng.pick(G.state.world.topics);
    out.push({
      archetype: a.id, first: nm.first, surname: nm.last, quirks: quirks,
      rumor: rumor, revealed: false, area: topic ? topic.name : "NLP"
    });
  }
  return out;
}

export function makeAdvisor(G, cand) {
  const a = G.D.archetypeById[cand.archetype];
  return {
    archetype: a.id,
    label: a.label,
    nick: a.nick,
    legion: a.legion,
    tagline: a.tagline,
    first: cand.first,
    surname: cand.surname,
    params: clone(a.params),
    quirks: cand.quirks,
    since: G.state.turn
  };
}

export function genLabmates(G, size) {
  const out = [];
  for (let i = 0; i < size; i++) {
    const nm = personName(G);
    out.push({
      id: "l" + G.state.nextId++,
      name: nm.first,
      full: nm.first + " " + nm.last,
      year: G.rng.int(1, 6),
      personality: G.rng.pick(PERSONALITIES),
      present: true
    });
  }
  return out;
}

// End of each academic year: seniors graduate, everyone moves up, a new student arrives.
export function yearlyLabmates(G, log) {
  const s = G.state;
  s.labmates.forEach(function (l) {
    if (!l.present) return;
    l.year++;
    if (l.year > 6 || (l.year >= 5 && G.rng.chance(0.4))) {
      l.present = false;
      l.fate = G.rng.pick(["graduated and joined a big tech lab", "graduated and started a postdoc",
        "graduated and founded a startup", "graduated and took a faculty job", "graduated and moved home to teach"]);
      log(l.name + " " + l.fate + ".");
    }
  });
  if (s.advisor) {
    const nm = personName(G);
    s.labmates.push({ id: "l" + s.nextId++, name: nm.first, full: nm.first + " " + nm.last, year: 1,
      personality: G.rng.pick(PERSONALITIES), present: true });
    log(nm.first + " joins the lab as a first-year.");
  }
}

export function genCommittee(G, n) {
  const members = G.D.qa.members || [];
  const picks = G.rng.shuffle(members).slice(0, n);
  return picks.map(function (m) {
    const nm = personName(G);
    return { name: "Prof. " + nm.last, label: m.label, prefers: m.prefers || [] };
  });
}
