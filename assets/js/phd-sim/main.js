// Entry point: picks the language, loads the game data (and its translation table), and mounts the
// app into #phd-sim.
import { App } from "./ui/app.js";
import { setLanguage, buildTable, translateData, LANGUAGES } from "./engine/i18n.js";
import { loadLang } from "./engine/save.js";

// ?lang=zh in the address wins, then the player's saved choice, then the browser's language.
function pickLanguage() {
  const known = LANGUAGES.map(function (l) { return l.id; });
  const q = /[?&]lang=([a-z]+)/.exec(location.search);
  if (q && known.indexOf(q[1]) >= 0) return q[1];
  const saved = loadLang();
  if (saved && known.indexOf(saved) >= 0) return saved;
  const prefs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"]);
  return prefs.some(function (l) { return /^zh\b/i.test(l); }) ? "zh" : "en";
}

function getJson(url) {
  return fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
}

const root = document.getElementById("phd-sim");
if (root) {
  const src = root.getAttribute("data-src");
  const lang = pickLanguage();
  root.setAttribute("lang", lang === "zh" ? "zh-Hans" : "en");
  // A missing or broken table just means English.
  const table = lang === "en" ? Promise.resolve(null) :
    getJson(src.replace(/data\.json(\?.*)?$/, "i18n-" + lang + ".json")).catch(function () { return null; });
  Promise.all([getJson(src), table])
    .then(function (res) {
      const data = res[0];
      if (res[1]) {
        const t = buildTable(res[1], lang);
        setLanguage(lang, t);
        translateData(data, t);
      } else {
        setLanguage("en");
        root.setAttribute("lang", "en");
      }
      new App(root, data);
    })
    .catch(function (err) {
      const p = document.createElement("p");
      p.className = "ps-note";
      p.textContent = (lang === "zh" ? "游戏加载失败（" : "The game couldn’t load (") + String(err && err.message ? err.message : err) +
        (lang === "zh" ? "）。请刷新页面重试。" : "). Try refreshing the page.");
      root.innerHTML = "";
      root.appendChild(p);
    });
}
