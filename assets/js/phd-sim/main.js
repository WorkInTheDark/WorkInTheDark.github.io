// Entry point: loads the game data and mounts the app into #phd-sim.
import { App } from "./ui/app.js";

const root = document.getElementById("phd-sim");
if (root) {
  const src = root.getAttribute("data-src");
  fetch(src, { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (data) { new App(root, data); })
    .catch(function (err) {
      const p = document.createElement("p");
      p.className = "ps-note";
      p.textContent = "The game couldn’t load (" + String(err && err.message ? err.message : err) + "). Try refreshing the page.";
      root.innerHTML = "";
      root.appendChild(p);
    });
}
