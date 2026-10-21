// Entry point: picks the language, loads the game data (and its translation table), and mounts the
// app into #phd-sim.
import { App } from "./ui/app.js";
import { setLanguage, buildTable, translateData, language, LANGUAGES } from "./engine/i18n.js";
import { loadLang, loadRun, saveRun, loadMeta, saveMeta } from "./engine/save.js";
import { savedLanguage, convertSave } from "./engine/relang.js";

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
  // A run or Codex saved in another language needs that language's table too, to convert its text.
  const run = loadRun();
  const meta = loadMeta();
  const runLang = savedLanguage(run), metaLang = savedLanguage(meta);
  const tableLang = lang !== "en" ? lang : [runLang, metaLang].filter(function (l) { return l && l !== "en"; })[0] || null;
  // A missing or broken table just means English.
  const table = !tableLang ? Promise.resolve(null) :
    getJson(src.replace(/data\.json(\?.*)?$/, "i18n-" + tableLang + ".json")).catch(function () { return null; });
  Promise.all([getJson(src), table])
    .then(function (res) {
      const data = res[0];
      const t = res[1] ? buildTable(res[1], tableLang) : null;
      if (lang !== "en" && t) {
        setLanguage(lang, t);
        translateData(data, t);
      } else {
        setLanguage("en");
        root.setAttribute("lang", "en");
      }
      // Text the game already wrote (the log, the open pop-up, tips, the Codex) is in the language
      // it was written in. After a switch, convert it once so the run carries on in one language.
      const now = language();
      [[run, runLang, saveRun], [meta, metaLang, saveMeta]].forEach(function (x) {
        const obj = x[0], was = x[1];
        if (!t || !obj || !was || was === now || [was, now].indexOf(tableLang) < 0 || [was, now].indexOf("en") < 0) return;
        try { if (convertSave(obj, t, was, now)) x[2](obj); } catch (e) { /* keep the save as it was */ }
      });
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
