// The field around you: topic hype, the hiring climate, and frontier model releases.
import { clamp } from "./util.js";
import { tOf } from "./state.js";
import { t } from "./i18n.js";

export function tickWorld(G, log) {
  const s = G.state;
  const w = s.world;
  const items = [];
  w.topics.forEach(function (t) {
    const base = (G.D.topicById[t.id] || {}).hype || 50;
    t.hype = clamp(t.hype + G.rng.normal(0, 3) + (base - t.hype) * 0.03, 5, 98);
  });
  const term = tOf(s.turn);
  if ((term === 1 || term === 14)) {
    const r = G.rng.next();
    const before = w.hiring;
    if (w.hiring === "neutral") w.hiring = r < 0.2 ? "boom" : r < 0.4 ? "freeze" : "neutral";
    else w.hiring = r < 0.45 ? "neutral" : w.hiring;
    if (before !== w.hiring) {
      log(w.hiring === "boom" ? t("Tech hiring is booming. Recruiters are suddenly very friendly.")
        : w.hiring === "freeze" ? t("Industry announces hiring freezes. The job boards go quiet.")
          : t("The job market settles back to normal."));
    }
  }
  if (s.turn >= w.nextRelease) {
    w.modelCount++;
    const names = G.D.names.models || ["Model-{n}"];
    const lab = G.rng.pick(G.D.names.labs || [t("A big lab")]);
    const name = G.rng.pick(names).replace("{n}", String(2 + w.modelCount));
    w.models.push({ name: name, lab: lab, turn: s.turn });
    const hot = G.rng.pick(w.topics);
    const shift = G.rng.chance(0.5) ? 15 : -12;
    if (hot) hot.hype = clamp(hot.hype + shift, 5, 98);
    const vars = { biglab: lab, model: name, topic: hot ? hot.name : "" };
    log(!hot ? t("{biglab} releases {model}.", vars)
      : shift > 0 ? t("{biglab} releases {model}. Suddenly everyone cares about {topic}.", vars)
        : t("{biglab} releases {model}. Interest cools in {topic}.", vars));
    items.push({ kind: "hook", hook: "model_release", ctx: { model: name, biglab: lab } });
    w.nextRelease = s.turn + G.rng.int(8, 16);
  }
  return items;
}
