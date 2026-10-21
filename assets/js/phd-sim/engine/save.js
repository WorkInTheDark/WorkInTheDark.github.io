// Browser persistence. Every access is guarded: private windows and blocked storage
// fall back to an in-memory game that simply isn't saved.
import { language } from "./i18n.js";

const RUN_KEY = "phdsim:run:v1";
const META_KEY = "phdsim:meta:v1";

function read(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function write(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

export function storageAvailable() {
  try {
    const k = "phdsim:probe";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch (e) {
    return false;
  }
}

export function loadRun() { const r = read(RUN_KEY); return r && r.version === 5 ? r : null; }
// Saves note the language their text was written in, so switching language can convert it (relang.js).
export function saveRun(state) { if (state) state.lang = language(); return write(RUN_KEY, state); }
export function clearRun() { return write(RUN_KEY, null); }
export function loadMeta() { return read(META_KEY) || { runs: 0, runsCompleted: 0, achievements: {}, seenRuns: {}, codex: {}, settings: {} }; }
export function saveMeta(meta) { if (meta) meta.lang = language(); return write(META_KEY, meta); }

// The player's language choice, read before the game data loads (null until they pick one).
const LANG_KEY = "phdsim:lang";
export function loadLang() { try { return window.localStorage.getItem(LANG_KEY); } catch (e) { return null; } }
export function saveLang(lang) { try { window.localStorage.setItem(LANG_KEY, lang); return true; } catch (e) { return false; } }
