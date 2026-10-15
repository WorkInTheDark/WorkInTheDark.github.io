// The app shell: screens, the play loop, prompts, saving, and input handling.
import { prepareData, newRun, rollTraits, Game, newSeed, storage, tOf } from "../engine/index.js";
import { Rng } from "../engine/rng.js";
import { prefersReducedMotion, esc } from "./common.js";
import { gameHtml } from "./gameview.js";
import { eventHtml, sysHtml, matchingHtml, newProjectHtml, rebuttalHtml, qaHtml, resultHtml, promptClass, slotsUsed } from "./prompts.js";
import { titleHtml, setupHtml, helpHtml, codexHtml, endHtml, summaryText, drawCard } from "./screens.js";

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

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
    this.busy = false;
    this.mode = "one";
    this.achShown = {};
    this.loopToken = 0;
    this.reduced = prefersReducedMotion();
    const self = this;
    root.addEventListener("click", function (e) { self.onClick(e); });
    root.addEventListener("change", function (e) { self.onChange(e); });
    root.addEventListener("input", function (e) { if (e.target.id === "ps-name" && self.setup) self.setup.name = e.target.value; });
    document.addEventListener("keydown", function (e) { self.onKey(e); });
    this.render();
  }

  // ---- Persistence ----------------------------------------------------------

  persist() {
    if (this.game && this.game.state.phase !== "ended") storage.saveRun(this.game.state);
    storage.saveMeta(this.meta);
  }

  // ---- Rendering ------------------------------------------------------------

  render() {
    let body = "";
    if (this.screen === "title") body = titleHtml(this);
    else if (this.screen === "setup") body = setupHtml(this);
    else if (this.screen === "help") body = helpHtml();
    else if (this.screen === "codex") body = codexHtml(this);
    else if (this.screen === "end") body = endHtml(this);
    else if (this.screen === "game" && this.game) body = gameHtml(this.game, this);
    let modal = "";
    if (this.modal) {
      const p = this.modal.prompt;
      let inner = "";
      if (p.type === "event") inner = eventHtml(p);
      else if (p.type === "sys") inner = sysHtml(p);
      else if (p.type === "matching") inner = matchingHtml(p);
      else if (p.type === "new_project") inner = newProjectHtml(p, this.sel);
      else if (p.type === "rebuttal") inner = rebuttalHtml(p, this.sel);
      else if (p.type === "qa") inner = qaHtml(p, this.sel);
      if (this.modal.result) {
        // Keep the question visible, replace the choices with the outcome.
        inner = inner.replace(/<div class="ps-choices">[\s\S]*$/, "");
        if (p.type !== "event" && p.type !== "sys") inner = '<div class="ps-kicker">Result</div><h3 id="ps-dialog-title">' + esc(p.title || "") + "</h3>";
        inner += resultHtml(this.modal.result, p, this.modal.achievements);
      }
      modal = '<div class="ps-modal"><div class="ps-dialog ' + promptClass(p) + '" role="dialog" aria-modal="true" aria-labelledby="ps-dialog-title">' + inner + "</div></div>";
    }
    const scrollY = window.scrollY;
    const dialogScroll = this.root.querySelector(".ps-dialog") ? this.root.querySelector(".ps-dialog").scrollTop : 0;
    this.root.innerHTML = '<div class="ps-app"><div class="ps-screen"' + (this.modal ? ' inert aria-hidden="true"' : "") + ">" + body + "</div>" + modal +
      (this.toast ? '<div class="ps-toast" role="status">' + esc(this.toast) + "</div>" : "") + "</div>";
    document.body.style.overflow = this.modal ? "hidden" : "";
    if (this.keepScroll) window.scrollTo(0, scrollY);
    const dlg = this.root.querySelector(".ps-dialog");
    if (dlg && this.keepDialogScroll) dlg.scrollTop = dialogScroll;
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
    const tr = rollTraits(this.D, seed, 0);
    const rng = new Rng(seed + ":name");
    this.setup = {
      seed: seed, daily: !!daily, name: rng.pick(this.D.names.first || ["Alex"]), background: null, origin: null,
      offers: tr.offers, random: tr.random, trait: null, reroll: 0
    };
    this.screen = "setup";
    this.render();
  }

  startRun() {
    const st = this.setup;
    const state = newRun(this.D, { seed: st.seed, daily: st.daily, name: (st.name || "Alex").trim().slice(0, 24) || "Alex", background: st.background, origin: st.origin, traits: [st.trait].concat(st.random) });
    this.game = new Game(this.D, this.meta, state);
    this.savedRun = state;
    this.screen = "game";
    this.achShown = {};
    this.persist();
    this.render();
    this.run("one");
  }

  resume() {
    if (!this.game || this.game.state !== this.savedRun) this.game = new Game(this.D, this.meta, this.savedRun);
    this.screen = "game";
    const s = this.game.state;
    if (s.phase === "ended") { this.finish(); return; }
    if (s.prompt) { this.showPrompt(s.prompt, !!s.prompt.ui); return; }
    this.render();
  }

  stopLoop() {
    this.loopToken++;
    this.busy = false;
  }

  async run(mode) {
    if (!this.game || this.screen !== "game") return;
    const token = ++this.loopToken;
    const game = this.game;
    const self = this;
    const live = function () { return token === self.loopToken && self.game === game && self.screen === "game"; };
    this.mode = mode;
    this.busy = true;
    this.stopRequested = false;
    this.keepScroll = true;
    this.render();
    let turns = 0;
    for (;;) {
      if (!live()) return;
      const p = game.step();
      if (p.type === "turn_end") {
        turns++;
        this.persist();
        this.checkAchievements(true);
        const t = tOf(game.state.turn);
        const semesterEnd = this.meta.settings && this.meta.settings.stopAtSemester && (t === 9 || t === 19 || t === 1);
        if (mode === "one" || this.stopRequested || semesterEnd || turns >= 26) break;
        this.keepScroll = true;
        this.render();
        await sleep(this.reduced ? 20 : 220);
        continue;
      }
      if (p.type === "ended" || p.type === "error") { this.busy = false; this.finish(); return; }
      this.busy = false;
      this.showPrompt(p);
      return;
    }
    if (!live()) return;
    this.busy = false;
    this.keepScroll = true;
    this.render();
  }

  checkAchievements(toast) {
    const list = this.game ? this.game.state.newAchievements : [];
    const shown = this.achShown;
    const fresh = list.filter(function (a) { return !shown[a.id]; });
    fresh.forEach(function (a) { shown[a.id] = true; });
    if (toast && fresh.length) this.flashToast("Achievement: " + fresh.map(function (a) { return a.name; }).join(", "));
    return fresh;
  }

  showPrompt(p, ui) {
    this.modal = { prompt: p, result: null, fresh: true, ui: !!ui };
    if (p.type === "rebuttal") this.sel = { responses: {}, flags: [] };
    else if (p.type === "qa") this.sel = { answers: {} };
    else if (p.type === "new_project") this.sel = { type: null, topic: null };
    else this.sel = {};
    this.keepScroll = true;
    this.render();
  }

  answer(resp) {
    if (!this.modal || this.modal.result) return;
    const p = this.modal.prompt;
    const res = this.game.answer(resp);
    this.persist();
    const ach = this.checkAchievements(false);
    if (this.game.state.pendingEnding || this.game.state.phase === "ended") {
      if (res && (res.text || (res.visible && res.visible.length))) { this.modal = { prompt: p, result: res, achievements: ach, fresh: true }; this.keepScroll = true; this.render(); return; }
      this.modal = null;
      this.run(this.mode);
      return;
    }
    const ui = this.modal.ui;
    if (res && (res.text || (res.visible && res.visible.length) || res.reviews || res.qa || (res.notes && res.notes.length) || ach.length)) {
      this.modal = { prompt: p, result: res, achievements: ach, fresh: true, ui: ui };
      this.keepScroll = true;
      this.render();
    } else {
      this.modal = null;
      if (ui) { this.keepScroll = true; this.render(); } else this.run(this.mode);
    }
  }

  continueAfterResult() {
    const ui = this.modal && this.modal.ui;
    this.modal = null;
    if (ui && !this.game.state.pendingEnding && !this.game.state.prompt) { this.keepScroll = true; this.render(); return; }
    this.run(this.mode);
  }

  finish() {
    const s = this.game.state;
    if (s.phase !== "ended") { this.render(); return; }
    this.ending = s.ending;
    this.modal = null;
    storage.clearRun();
    this.savedRun = null;
    storage.saveMeta(this.meta);
    this.screen = "end";
    this.render();
    window.scrollTo(0, Math.max(0, this.root.getBoundingClientRect().top + window.scrollY - 80));
  }

  // ---- Input ----------------------------------------------------------------

  routineChange(fn) {
    const s = this.game.state;
    const r = { days: Object.assign({}, s.routine.days), overtime: s.routine.overtime, overtimeTarget: s.routine.overtimeTarget };
    fn(r);
    this.game.setRoutine(r);
    this.persist();
    this.keepScroll = true;
    this.render();
  }

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
      case "title": this.stopLoop(); this.savedRun = this.game && this.game.state.phase !== "ended" ? this.game.state : storage.loadRun(); this.screen = "title"; this.render(); break;
      case "help": this.stopLoop(); this.prev = this.screen; this.screen = "help"; this.render(); break;
      case "codex": this.stopLoop(); this.prev = this.screen; this.screen = "codex"; this.render(); break;
      case "back": this.screen = this.prev || "title"; this.render(); break;
      case "pick-bg": this.setup.background = id; this.render(); break;
      case "pick-origin": this.setup.origin = id; this.render(); break;
      case "pick-trait": this.setup.trait = id; this.render(); break;
      case "reroll": {
        const tr = rollTraits(this.D, this.setup.seed, 1);
        this.setup.offers = tr.offers; this.setup.random = tr.random; this.setup.trait = null; this.setup.reroll = 1;
        this.render();
        break;
      }
      case "start": if (this.setup.background && this.setup.origin && this.setup.trait) this.startRun(); break;
      case "next": this.run("one"); break;
      case "auto": this.run("auto"); break;
      case "pause": this.stopRequested = true; break;
      case "inc": case "dec":
        this.focusSel = '[data-action="' + a + '"][data-key="' + key + '"]';
        this.routineChange(function (r) { r.days[key] = Math.max(0, Math.min(10, (r.days[key] || 0) + (a === "inc" ? 1 : -1))); });
        break;
      case "ot-inc": case "ot-dec":
        this.focusSel = '[data-action="' + a + '"]';
        this.routineChange(function (r) { r.overtime = Math.max(0, Math.min(4, (r.overtime || 0) + (a === "ot-inc" ? 1 : -1))); });
        break;
      case "shelve":
        if (window.confirm("Shelve this project? You can't bring it back.")) { this.game.shelveProject(id); this.persist(); this.keepScroll = true; this.render(); }
        break;
      case "new-project": { if (this.busy) break; const p = this.game.requestNewProject(); if (p) this.showPrompt(p, true); break; }
      case "leave": { this.stopLoop(); const p = this.game.requestLeave(); if (p) this.showPrompt(p, true); else this.render(); break; }
      case "choose": this.answer({ choice: i }); break;
      case "join": this.answer({ action: "join", idx: i }); break;
      case "rotate": this.answer({ action: "rotate", idx: i }); break;
      case "later": this.answer({ action: "later" }); break;
      case "pick-type": this.sel.type = id; this.keepDialogScroll = true; this.render(); break;
      case "pick-topic": this.sel.topic = id; this.keepDialogScroll = true; this.render(); break;
      case "cancel-project": this.game.answer({ cancel: true }); this.modal = null; this.persist(); this.render(); break;
      case "create-project": if (this.sel.type && this.sel.topic) this.answer({ type: this.sel.type, topic: this.sel.topic }); break;
      case "strat": this.sel.answers[key] = id; this.keepDialogScroll = true; this.focusSel = '[data-action="strat"][data-key="' + key + '"][data-id="' + id + '"]'; this.render(); break;
      case "submit-qa": this.answer({ answers: this.sel.answers }); break;
      case "submit-rebuttal": if (slotsUsed(this.modal.prompt, this.sel) <= this.modal.prompt.slots) this.answer({ responses: this.sel.responses, flags: this.sel.flags }); break;
      case "continue": this.continueAfterResult(); break;
      case "copy-summary": {
        const text = summaryText(this.ending) + " " + location.href;
        const done = function () { self.flashToast("Summary copied."); self.render(); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { window.prompt("Copy this:", text); });
        else window.prompt("Copy this:", text);
        break;
      }
      case "save-image": {
        const c = drawCard(this.ending);
        c.toBlob(function (blob) {
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
    if (a === "target") { this.game.setTarget(el.getAttribute("data-id"), el.value); this.persist(); this.keepScroll = true; this.render(); }
    else if (a === "ot-target") { const v = el.value; this.routineChange(function (r) { r.overtimeTarget = v; }); }
    else if (a === "respond") {
      const k = el.getAttribute("data-key");
      if (el.value === "skip") delete this.sel.responses[k]; else this.sel.responses[k] = el.value;
      this.keepDialogScroll = true; this.focusSel = '[data-action="respond"][data-key="' + k + '"]'; this.render();
    } else if (a === "flag") {
      const idx = parseInt(el.getAttribute("data-i"), 10);
      const pos = this.sel.flags.indexOf(idx);
      if (el.checked && pos < 0) this.sel.flags.push(idx); else if (!el.checked && pos >= 0) this.sel.flags.splice(pos, 1);
      this.keepDialogScroll = true; this.focusSel = '[data-action="flag"][data-i="' + idx + '"]'; this.render();
    }
  }

  onKey(e) {
    if (!this.modal || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) return;
    if (!this.modal.result && /^[1-4]$/.test(e.key)) {
      const btns = this.root.querySelectorAll(".ps-dialog .ps-choice");
      const b = btns[parseInt(e.key, 10) - 1];
      if (b) { e.preventDefault(); b.click(); }
    } else if (e.key === "Escape" && this.modal.prompt.type === "new_project" && this.modal.prompt.cancellable && !this.modal.result) {
      this.game.answer({ cancel: true }); this.modal = null; this.persist(); this.render();
    }
  }
}
