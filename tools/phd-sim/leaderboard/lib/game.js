// The game, as players get it: the engine and the share-link code are fetched from the site (following
// their imports), written to /tmp and imported, and the data comes from the site's data.json. So the
// server always replays runs with what players actually ran, and a game update needs no redeploy here.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { SITE, DATA_URL } from "./config.js";
import { sha } from "./http.js";

const ENTRY = ["/assets/js/phd-sim/engine/index.js", "/assets/js/phd-sim/engine/replay.js", "/assets/js/phd-sim/ui/share.js"];
const FRESH_MS = 10 * 60 * 1000;   // look for a new version at most every 10 minutes
const RETRY_MS = 60 * 1000;        // a run that doesn't verify forces a fresh look, at most once a minute

let current = null;
let loading = null;

async function getText(url) {
  if (url.indexOf("file://") === 0) return readFile(new URL(url), "utf8");
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("fetch " + url + ": HTTP " + r.status);
  return r.text();
}

// Every module the entry files need, by site path.
async function crawl() {
  const files = new Map();
  let wave = ENTRY.slice();
  while (wave.length) {
    const texts = await Promise.all(wave.map(function (p) { return getText(SITE + p); }));
    const next = [];
    wave.forEach(function (p, i) {
      files.set(p, texts[i]);
      for (const m of texts[i].matchAll(/(?:^|[;\s])(?:import|export)\s[^"';]*?from\s*["'](\.{1,2}\/[^"']+)["']/g)) {
        const dep = new URL(m[1], "https://x" + p).pathname;
        if (!files.has(dep) && next.indexOf(dep) < 0 && wave.indexOf(dep) < 0) next.push(dep);
      }
    });
    wave = next;
  }
  return files;
}

async function fetchVersion() {
  const [files, dataText] = await Promise.all([crawl(), getText(DATA_URL)]);
  const id = sha(Array.from(files.keys()).sort().map(function (k) { return k + "\n" + files.get(k); }).join("\n") + "\n" + dataText).slice(0, 16);
  if (current && current.id === id) { current.at = Date.now(); return current; }
  const root = join(tmpdir(), "phd-sim-" + id);
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "package.json"), '{ "type": "module" }');
  for (const [p, text] of files) {
    await mkdir(dirname(join(root, p)), { recursive: true });
    await writeFile(join(root, p), text);
  }
  const url = function (p) { return pathToFileURL(join(root, p)).href; };
  const engine = await import(url(ENTRY[0]));
  const replay = await import(url(ENTRY[1]));
  const share = await import(url(ENTRY[2]));
  const D = engine.prepareData(JSON.parse(dataText));
  return { id: id, at: Date.now(), D: D, replay: replay, share: share };
}

export async function game(force) {
  if (current && !force && Date.now() - current.at < FRESH_MS) return current;
  if (!loading) loading = fetchVersion().then(function (v) { current = v; loading = null; return v; }, function (e) { loading = null; throw e; });
  return loading;
}

function attempt(g, record, claim) {
  try {
    const played = g.replay.replayRun(g.D, record);
    const e = played.state.ending;
    const result = g.replay.resultOf(e);
    // The run must come out the way the player saw it.
    if (!claim || result.score !== claim.score || result.ending !== claim.ending || result.pubs !== claim.pubs || result.citations !== claim.citations) {
      return { ok: false, reason: "mismatch" };
    }
    return { ok: true, result: result, code: g.share.encodeResult(e, g.D), version: g.id };
  } catch (err) {
    return { ok: false, reason: err.code || "error", detail: String(err && err.message || err).slice(0, 200) };
  }
}

// Plays the record again and checks it against what the player claims. If it doesn't match, the
// game may have been updated since this server last looked, so it looks again once and retries.
export async function verify(record, claim) {
  let g = await game(false);
  let out = attempt(g, record, claim);
  if (!out.ok && Date.now() - g.at > RETRY_MS) {
    g = await game(true);
    out = attempt(g, record, claim);
  }
  return out;
}
