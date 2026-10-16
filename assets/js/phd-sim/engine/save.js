// Browser persistence. Every access is guarded: private windows and blocked storage
// fall back to an in-memory game that simply isn't saved.
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

export function loadRun() { const r = read(RUN_KEY); return r && r.version === 4 ? r : null; }
export function saveRun(state) { return write(RUN_KEY, state); }
export function clearRun() { return write(RUN_KEY, null); }
export function loadMeta() { return read(META_KEY) || { runs: 0, runsCompleted: 0, achievements: {}, seenRuns: {}, codex: {}, settings: {} }; }
export function saveMeta(meta) { return write(META_KEY, meta); }
