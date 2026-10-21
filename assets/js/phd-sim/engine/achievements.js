// Achievements persist across runs in meta; each run also remembers its own.
import { check } from "./conditions.js";
import { t } from "./i18n.js";

export function unlock(G, id) {
  const s = G.state;
  const def = G.D.achievementById[id];
  if (!def) return false;
  s.runAchievements = s.runAchievements || {};
  if (s.runAchievements[id]) return false;
  s.runAchievements[id] = true;
  const meta = G.meta;
  meta.achievements = meta.achievements || {};
  const isNew = !meta.achievements[id];
  if (isNew) meta.achievements[id] = new Date().toISOString().slice(0, 10);
  s.newAchievements.push({ id: id, name: def.name, desc: def.desc, isNew: isNew });
  s.log.push({ turn: s.turn, kind: "achievement", text: isNew ? t("Achievement: {name} (new!)", { name: def.name }) : t("Achievement: {name}", { name: def.name }) });
  return true;
}

export function checkAchievements(G) {
  G.D.achievements.forEach(function (a) {
    if (!a.when) return;
    if (G.state.runAchievements && G.state.runAchievements[a.id]) return;
    if (check(a.when, G, {})) unlock(G, a.id);
  });
}
