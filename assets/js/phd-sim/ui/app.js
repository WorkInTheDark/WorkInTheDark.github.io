// The app shell: screens, the play loop, prompts, saving, and input handling.
import { prepareData, newRun, rollTraits, Game, newSeed, storage } from "../engine/index.js";
import { Rng } from "../engine/rng.js";
import { prefersReducedMotion, esc, setKnownTitles } from "./common.js";
import { gameHtml, orderedActions } from "./gameview.js";
import { eventHtml, sysHtml, rebuttalHtml, resultHtml, promptClass } from "./prompts.js";
import { titleHtml, setupHtml, codexHtml, endHtml } from "./screens.js";
import { readSharedFromLocation, sharedHtml, shareTargets, shareText, cardBlob } from "./share.js";

export class App {
  constructor(root, rawData) {
    this.root = root;
    this.D = prepareData(rawData);
    this.storageOk = storage.storageAvailable();
    this.meta = storage.loadMeta();
    this.savedRun = storage.loadRun();
    this.game = null;
    this.screen = "title";
    this.prev = "title";
    this.modal = null;
    this.plan = null;
    this.report = null;
    this.achShown = {};
    this.reduced = prefersReducedMotion();
    const self = this;
    root.addEventListener("click", function (e) { self.onClick(e); });
    root.addEventListener("change", function (e) { self.onChange(e); });
    root.addEventListener("input", function (e) { if (e.target.id === "ps-name" && self.setup) self.setup.name = e.target.value; });
    document.addEventListener("keydown", function (e) { self.onKey(e); });
    // A shared result link (#r=…) opens a read-only card instead of the title screen.
    this.shared = readSharedFromLocation(this.D);
    if (this.shared) this.screen = "shared";
    window.addEventListener("hashchange", function () {
      const r = readSharedFromLocation(self.D);
      if (!r) return;
      // A run in progress is saved first; "Play your own PhD" leads back to it.
      if (self.game) self.persist();
      self.modal = null; self.inspect = null; self.panel = null;
      self.shared = r; self.screen = "shared"; self.render();
    });
    this.render();
  }

  // Leaves the shared card: drop the #r=… part of the address so a reload doesn't bring it back.
  leaveShared() {
    this.shared = null;
    if (/[#&]r=/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search);
  }

  // ---- Persistence ----------------------------------------------------------

  persist() {
    if (this.game && this.game.state.phase !== "ended") storage.saveRun(this.game.state);
    storage.saveMeta(this.meta);
  }

  // ---- Rendering ------------------------------------------------------------

  // The current event or update, drawn inside the main box (or null).
  promptInner() {
    if (!this.modal) return null;
    const p = this.modal.prompt;
    let inner = "";
    if (p.type === "event") inner = eventHtml(p);
    else if (p.type === "sys") inner = sysHtml(p);
    else if (p.type === "rebuttal") inner = rebuttalHtml(p, this.psel);
    if (this.modal.result) {
      // Keep the question visible, replace the choices with the outcome.
      inner = inner.replace(/<div class="ps-choices">[\s\S]*$/, "");
      if (p.type !== "event" && p.type !== "sys") inner = '<div class="ps-kicker">Result</div><h3 id="ps-dialog-title">' + esc(p.title || "") + "</h3>";
      inner += resultHtml(this.modal.result, p);
    }
    return inner;
  }

  render() {
    if (this.game) {
      const s = this.game.state;
      setKnownTitles([].concat(
        s.projects.map(function (p) { return p.title; }), s.projects.map(function (p) { return p.short; }),
        s.papers.filter(function (p) { return p.firstAuthor; }).map(function (p) { return p.title; })));
    }
    let body = "";
    if (this.screen === "title") body = titleHtml(this);
    else if (this.screen === "setup") body = setupHtml(this);
    else if (this.screen === "codex") body = codexHtml(this);
    else if (this.screen === "end") body = endHtml(this);
    else if (this.screen === "shared" && this.shared) body = sharedHtml(this);
    else if (this.screen === "game" && this.game) body = gameHtml(this.game, this, this.promptInner(), this.modal ? promptClass(this.modal.prompt) : "");
    const scrollY = window.scrollY;
    const oldScene = this.root.querySelector(".ps-overlay") || this.root.querySelector(".ps-scene");
    const keepScene = oldScene ? oldScene.scrollTop : 0;
    this.root.innerHTML = '<div class="ps-app ps-app-' + this.screen + '"><div class="ps-screen">' + body + "</div>" +
      (this.toast ? '<div class="ps-toast" role="status">' + esc(this.toast) + "</div>" : "") + "</div>";
    if (this.keepScroll) window.scrollTo(0, scrollY);
    const scene = this.root.querySelector(".ps-overlay") || this.root.querySelector(".ps-scene");
    if (scene && this.keepDialogScroll) scene.scrollTop = keepScene;
    this.keepScroll = false;
    this.keepDialogScroll = false;
    this.restoreFocus();
  }

  restoreFocus() {
    if (this.focusSel) {
      const el = this.root.querySelector(this.focusSel);
      this.focusSel = null;
      if (el) { el.focus({ preventScroll: true }); return; }
    }
    if (this.modal && this.modal.fresh) {
      this.modal.fresh = false;
      const first = this.root.querySelector(".ps-dialog .ps-choice, .ps-dialog [data-action='continue'], .ps-dialog .ps-btn-primary, .ps-dialog button, .ps-dialog select");
      if (first) first.focus({ preventScroll: true });
    }
  }

  flashToast(text) {
    const self = this;
    this.toast = text;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(function () {
      self.toast = null;
      const t = self.root.querySelector(".ps-toast");
      if (t) t.remove();
    }, 3500);
  }

  // ---- Flow -----------------------------------------------------------------

  newSetup(daily) {
    const seed = daily ? "daily-" + new Date().toISOString().slice(0, 10) : newSeed();
    const rng = new Rng(seed + ":name");
    this.setup = { seed: seed, daily: !!daily, name: rng.pick(this.D.names.first || ["Alex"]), traits: rollTraits(this.D, seed) };
    this.screen = "setup";
    this.render();
  }

  startRun() {
    const st = this.setup;
    const state = newRun(this.D, { seed: st.seed, daily: st.daily, name: (st.name || "Alex").trim().slice(0, 24) || "Alex", traits: st.traits });
    this.game = new Game(this.D, this.meta, state);
    this.savedRun = state;
    this.screen = "game";
    this.achShown = {};
    this.report = null;
    this.inspect = null;
    this.persist();
    this.advance();
  }

  resume() {
    if (!this.game || this.game.state !== this.savedRun) this.game = new Game(this.D, this.meta, this.savedRun);
    this.screen = "game";
    const s = this.game.state;
    this.report = s.report || null;
    this.inspect = null;
    if (s.phase === "ended") { this.finish(); return; }
    if (s.prompt) this.showPrompt(s.prompt, !!s.prompt.ui);
    else this.advance();
  }

  // Runs the game forward until it needs the player: a prompt, or the next turn's focus.
  advance() {
    if (!this.game || this.screen !== "game") return;
    for (let guard = 0; guard < 200; guard++) {
      const p = this.game.step();
      if (p.type === "turn_end") {
        this.report = p.report;
        this.persist();
        this.checkAchievements();
        continue;
      }
      if (p.type === "plan") {
        this.setPlan(p);
        this.planShownAt = Date.now();
        this.persist();
        this.keepScroll = true;
        this.render();
        return;
      }
      if (p.type === "ended" || p.type === "error") { this.finish(); return; }
      this.showPrompt(p);
      return;
    }
  }

  setPlan(p) {
    if (!this.plan || !p || this.plan.turn !== p.turn) this.sidePick = null;
    this.plan = p;
  }

  // One click sets the turn's focus. A quick double click shouldn't also pick the next turn's.
  doAction(id) {
    if (!this.game || !this.plan || this.modal) return;
    if (Date.now() - (this.planShownAt || 0) < 400) return;
    if (!this.game.submitPlan({ action: id, side: this.sidePick })) return;
    this.sidePick = null;
    this.plan = null;
    this.advance();
  }

  checkAchievements() {
    const list = this.game ? this.game.state.newAchievements : [];
    const shown = this.achShown;
    const fresh = list.filter(function (a) { return !shown[a.id]; });
    fresh.forEach(function (a) { shown[a.id] = true; });
    this.popAchievements(fresh);
    return fresh;
  }

  // Like a game platform: a card slides in at the lower right of the screen, then leaves.
  popAchievements(list) {
    if (!list.length || typeof document === "undefined") return;
    if (!this.achLayer || !this.achLayer.isConnected) {
      this.achLayer = document.createElement("div");
      this.achLayer.className = "ps-ach-layer";
      this.achLayer.setAttribute("aria-live", "polite");
      document.body.appendChild(this.achLayer);
    }
    const layer = this.achLayer;
    list.forEach(function (a, i) {
      setTimeout(function () {
        const el = document.createElement("div");
        el.className = "ps-ach-pop";
        el.innerHTML = '<span class="ps-ach-icon" aria-hidden="true">\u{1F3C6}</span><span class="ps-ach-body"><small>Achievement unlocked</small><b>' +
          esc(a.name) + "</b><span>" + esc(a.desc || "") + "</span></span>";
        layer.appendChild(el);
        setTimeout(function () { el.classList.add("ps-ach-out"); setTimeout(function () { el.remove(); }, 450); }, 5200);
      }, i * 700);
    });
  }

  showPrompt(p, ui) {
    this.modal = { prompt: p, result: null, fresh: true, ui: !!ui };
    // The cards seen so far this turn, for the pop-up's "where am I" strip.
    const turn = this.game.state.turn;
    if (!this.trail || this.trail.turn !== turn) this.trail = { turn: turn, items: [] };
    this.trail.items.push({ title: p.title || "Update", event: p.type === "event" });
    if (p.type === "rebuttal") this.psel = { responses: {} };
    else this.psel = {};
    this.keepScroll = true;
    this.render();
  }

  answer(resp) {
    if (!this.modal || this.modal.result) return;
    const p = this.modal.prompt;
    const ui = this.modal.ui;
    const res = this.game.answer(resp);
    this.persist();
    this.checkAchievements();
    if (res && (res.text || (res.visible && res.visible.length) || res.reviews || res.qa || (res.notes && res.notes.length))) {
      this.modal = { prompt: p, result: res, fresh: true, ui: ui };
      this.keepScroll = true;
      this.render();
      return;
    }
    this.modal = null;
    this.afterPrompt(ui);
  }

  continueAfterResult() {
    const ui = this.modal && this.modal.ui;
    this.modal = null;
    this.afterPrompt(ui);
  }

  afterPrompt(ui) {
    const s = this.game.state;
    if (ui && !s.pendingEnding && !s.prompt && s.stage === "plan") {
      this.setPlan(this.game.planPrompt());
      this.keepScroll = true;
      this.render();
      return;
    }
    this.advance();
  }

  finish() {
    const s = this.game.state;
    if (s.phase !== "ended") { this.render(); return; }
    this.ending = s.ending;
    this.modal = null;
    // The share sheet must open within the click, so the image is ready before anyone taps Share.
    const self = this;
    this.cardFile = null;
    if (typeof navigator.share === "function" && typeof File === "function") {
      cardBlob(s.ending, function (blob) { if (blob && self.ending === s.ending) self.cardFile = new File([blob], "phd-simulator.png", { type: "image/png" }); });
    }
    storage.clearRun();
    this.savedRun = null;
    storage.saveMeta(this.meta);
    this.screen = "end";
    this.render();
    window.scrollTo(0, Math.max(0, this.root.getBoundingClientRect().top + window.scrollY - 80));
  }

  // ---- Input ----------------------------------------------------------------

  onClick(e) {
    const el = e.target.closest("[data-action]");
    if (!el || !this.root.contains(el)) return;
    if (el.tagName === "SELECT" || el.type === "checkbox") return;
    const a = el.getAttribute("data-action");
    const id = el.getAttribute("data-id");
    const key = el.getAttribute("data-key");
    const i = parseInt(el.getAttribute("data-i"), 10);
    const self = this;
    switch (a) {
      case "setup": this.newSetup(false); break;
      case "setup-daily": this.newSetup(true); break;
      case "resume": this.resume(); break;
      case "title": this.savedRun = this.game && this.game.state.phase !== "ended" ? this.game.state : storage.loadRun(); this.screen = "title"; this.render(); break;
      case "codex": this.prev = this.screen; this.screen = "codex"; this.render(); break;
      case "back": this.screen = this.prev || "title"; this.render(); break;
      case "inspect": if (!this.modal) { this.inspect = id; this.keepScroll = true; this.render(); } break;
      case "close-inspect": this.inspect = null; this.keepScroll = true; this.render(); break;
      case "achievements": if (!this.modal) { this.panel = this.panel === "ach" ? null : "ach"; this.inspect = null; this.keepScroll = true; this.render(); } break;
      case "close-panel": this.panel = null; this.keepScroll = true; this.render(); break;
      case "start": this.startRun(); break;
      case "do": this.doAction(id); break;
      case "side": this.sidePick = this.sidePick === id ? null : id; this.keepScroll = true; this.render(); break;
      case "shelve":
        if (window.confirm("Shelve this project? You can't bring it back.")) { this.game.shelveProject(id); this.inspect = null; this.persist(); this.setPlan(this.game.planPrompt()); this.keepScroll = true; this.render(); }
        break;
      case "new-project": {
        const before = this.game.state.stats.sanity;
        const p = this.game.startNewProject();
        if (p) {
          this.persist();
          const up = Math.round(before - this.game.state.stats.sanity);
          this.flashToast("New project: " + p.short + (up > 0 ? ". Stress +" + up + "." : "."));
          this.setPlan(this.game.planPrompt());
          this.keepScroll = true; this.render();
        }
        break;
      }
      case "leave": { const p = this.game.requestLeave(); if (p) this.showPrompt(p, true); break; }
      case "choose": this.answer({ choice: i }); break;
      case "submit-rebuttal": this.answer({ responses: this.psel.responses }); break;
      case "continue": this.continueAfterResult(); break;
      case "shared-play": this.leaveShared(); this.savedRun = storage.loadRun(); this.screen = "title"; this.render(); break;
      case "shared-daily": this.leaveShared(); this.newSetup(true); break;
      case "copy-link": {
        const url = shareTargets(this.ending, this.D).url;
        const done = function () { self.flashToast("Link copied."); self.render(); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { window.prompt("Copy this link:", url); });
        else window.prompt("Copy this link:", url);
        break;
      }
      case "share-native": {
        // The device's share sheet, with the image attached where the browser allows files.
        const t = shareTargets(this.ending, this.D);
        const data = { title: "PhD Simulator", text: shareText(this.ending), url: t.url };
        const file = this.cardFile;
        navigator.share(file && navigator.canShare && navigator.canShare({ files: [file] }) ? Object.assign({ files: [file] }, data) : data).catch(function () {});
        break;
      }
      case "save-image": {
        cardBlob(this.ending, function (blob) {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url; link.download = "phd-simulator.png";
          document.body.appendChild(link); link.click(); link.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        });
        break;
      }
    }
  }

  onChange(e) {
    const el = e.target;
    const a = el.getAttribute("data-action");
    if (!a) return;
    if (a === "target") { this.game.setTarget(el.getAttribute("data-id"), el.value); this.persist(); this.setPlan(this.game.planPrompt()); this.keepScroll = true; this.render(); }
    else if (a === "respond") {
      const ri = el.getAttribute("data-i");
      this.psel.responses[ri] = el.value;
      this.keepDialogScroll = true; this.focusSel = '[data-action="respond"][data-i="' + ri + '"]'; this.render();
    }
  }

  onKey(e) {
    if (e.altKey || e.ctrlKey || e.metaKey || this.screen !== "game") return;
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA")) return;
    if (this.panel) { if (e.key === "Escape") { this.panel = null; this.render(); } return; }
    if (this.inspect) { if (e.key === "Escape") { this.inspect = null; this.render(); } return; }
    if (!/^[1-9]$/.test(e.key)) return;
    const n = parseInt(e.key, 10) - 1;
    // Number keys pick the numbered choice: an event's choices, or this turn's focus.
    if (this.modal) {
      if (this.modal.result) return;
      const b = this.root.querySelectorAll(".ps-dialog .ps-choice")[n];
      if (b) { e.preventDefault(); b.click(); }
    } else if (this.plan) {
      const a = orderedActions(this.plan)[n];
      if (a) { e.preventDefault(); this.doAction(a.id); }
    }
  }
}
