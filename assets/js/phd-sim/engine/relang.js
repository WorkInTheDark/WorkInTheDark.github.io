// Switching language mid-run. The game writes text into the save as it goes (the log, the last turn's
// report, the open pop-up, tips, the Codex), in whatever language was on at the time. When the player
// switches, main.js converts that text once, using the same translation table: exact lines are
// swapped, lines built from a template have their {tokens} read back and refilled in the other
// language, and lines joined from several sentences are converted sentence by sentence. Anything
// that can't be matched stays as it was written.

const CJK = /[㐀-鿿　-〿＀-￯]/;
const TOKEN = /\{[^{}]+\}/g;

// The language a save was written in: stamped by saveRun / saveMeta, or guessed for older saves.
export function savedLanguage(obj) {
  if (!obj) return null;
  if (obj.lang) return obj.lang;
  return CJK.test(JSON.stringify(obj)) ? "zh" : "en";
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// How much fixed text a template has: a Chinese character says about as much as three letters.
function weight(lit) {
  let w = 0;
  for (const ch of lit) if (!/\s/.test(ch)) w += CJK.test(ch) ? 3 : 1;
  return w;
}
const WEAK = 8;

// One direction of the table: exact lines, and templates (lines with tokens) as regexes.
function side(pairs) {
  const exact = new Map();
  const templates = [];
  pairs.forEach(function (pr) {
    const from = pr[0], to = pr[1];
    if (!from || !to) return;
    const toks = from.match(TOKEN);
    if (!toks) { if (!exact.has(from)) exact.set(from, to); return; }
    const lit = from.split(TOKEN);
    const w = weight(lit.join(""));
    if (w < 2) return; // "{a} {b}" would match anything
    let re = "^";
    lit.forEach(function (chunk, i) { re += escapeRe(chunk); if (i < toks.length) re += "([\\s\\S]+?)"; });
    templates.push({ re: new RegExp(re + "$"), toks: toks, to: to, weight: w, same: from === to });
  });
  // Most specific first, so "{advisor} sends a long email" wins over "{advisor} sends {thing}".
  templates.sort(function (a, b) { return b.weight - a.weight; });
  return { exact: exact, templates: templates };
}

// The converter for one table ({ english: chinese }) in one direction ("en"→"zh" or "zh"→"en").
export function makeConverter(table, from, to) {
  const pairs = Object.keys(table).map(function (en) { return [en, table[en]]; });
  const dir = side(from === "en" ? pairs : pairs.map(function (p) { return [p[1], p[0]]; }));
  const toZh = to === "zh";

  // Less text left in the old language wins; then less captured text left as it was, so
  // "New project: “{title}” ({type})." plus " Stress +9." beats one token holding "“…” (type)".
  function better(a, b) { return !b || a.c < b.c || (a.c === b.c && a.u < b.u); }

  // Every result carries a cost: how much of the line stayed in the old language. Names, titles and
  // numbers read the same in both and cost nothing. Chinese left in an English line costs, and so does
  // an English sentence a token swallowed whole ("Analysis. Stress +3"), so a template that took the
  // rest of a joined line never beats splitting it.
  function leftover(v) {
    if (from === "zh") { const m = v.match(/[\u3400-\u9fff]/g); return m ? m.length : 0; }
    return /[.!]["”)]?\s+\S/.test(v) ? v.length : 0;
  }

  // A plain value: a number, or a single word such as a name or a venue.
  function plain(v) {
    return /^[\d\s.,+\-–%/:]+$/.test(v) || (!CJK.test(v) && /^[^\s,:;.!?“”"()]{1,24}$/.test(v));
  }

  // A token's value, in the other language: nested lines (Prof. {name}, a topic, a stage label),
  // ordinals, lists of those, and otherwise the value itself.
  function value(v, depth) {
    if (toZh) { const m = /^(\d+)(?:st|nd|rd|th)$/.exec(v); if (m) return { t: "第" + m[1], c: 0, u: 0, e: true }; }
    else { const m = /^第\s?(\d+)$/.exec(v); if (m) { const n = +m[1], s = ["th", "st", "nd", "rd"], r = n % 100; return { t: n + (s[(r - 20) % 10] || s[r] || s[0]), c: 0, u: 0, e: true }; } }
    const w = whole(v, depth + 1);
    if (w) return w;
    if (/^[A-Z]/.test(v) && toZh) { const lower = whole(v.charAt(0).toLowerCase() + v.slice(1), depth + 1); if (lower) return lower; }
    const sep = /, |、|，/.exec(v);
    if (sep && depth < 2) {
      const items = v.split(sep[0]).map(function (x) { return value(x, depth + 1); });
      if (items.every(function (x) { return x.c === 0; })) return { t: items.map(function (x) { return x.t; }).join(sep[0]), c: 0, u: items.reduce(function (a, x) { return a + x.u; }, 0), e: items.every(function (x) { return x.e; }) };
    }
    return { t: v, c: leftover(v), u: v.length, e: plain(v) };
  }

  function whole(str, depth) {
    if (dir.exact.has(str)) return { t: dir.exact.get(str), c: 0, u: 0, e: true };
    if (depth > 2 || str.length > 600) return null;
    let best = null, tried = 0;
    for (let i = 0; i < dir.templates.length && tried < 6; i++) {
      const tp = dir.templates[i];
      const m = tp.re.exec(str);
      if (!m) continue;
      tried++;
      const got = {};
      let ok = true, cost = 0, kept = 0;
      tp.toks.forEach(function (tok, j) {
        if (!ok) return;
        const raw = m[j + 1];
        if (got[tok] !== undefined) { if (got[tok].raw !== raw) ok = false; return; }
        const v = value(raw, depth);
        // A mostly-token template ("{venue} in {city}", "{label}.") only counts when every value it
        // captured is a plain name or number or a line straight from the table, never a sentence
        // built from another template: "Lost in Tokenization: …" is not "{venue} in {city}".
        if (tp.weight < WEAK && !(v.e && v.c === 0)) ok = false;
        got[tok] = { raw: raw, v: v, moved: v.t !== raw };
        cost += v.c;
        kept += v.u;
      });
      // ...and when it actually translates something, unless it's a one-token frame like
      // "Prof. {name}". Otherwise "Lost in Tokenization" would read as "{venue} in {city}".
      const moved = tp.same || Object.keys(got).some(function (k) { return got[k].moved; });
      if (ok && !moved && tp.weight < WEAK && (tp.toks.length > 1 || tp.weight < 4)) ok = false;
      if (!ok) continue;
      const cand = { t: tp.to.replace(TOKEN, function (tok) { return got[tok] ? got[tok].v.t : tok; }), c: cost, u: kept };
      if (better(cand, best)) best = cand;
      if (cost === 0 && kept === 0) break;
    }
    return best;
  }

  // Where a line the code joined together (an outcome plus " Stress +3.", two log lines) may split:
  // after a full stop, question or exclamation mark, with any closing quote, before the spacing.
  const BREAK = from === "zh" ? /[。！？]\s*/g : /[.!?]["”)]?\s+/g;

  // Picks the split that leaves the least text unconverted, keeping the spacing between pieces.
  function joined(str) {
    const cuts = [];
    let m;
    BREAK.lastIndex = 0;
    while ((m = BREAK.exec(str))) {
      const end = m.index + m[0].length;
      if (end < str.length) cuts.push({ at: end, gap: m[0].replace(/^[。！？.!?]["”)]?/, "") });
    }
    if (!cuts.length) return null;
    const starts = [0].concat(cuts.map(function (c) { return c.at; }));
    const gapAt = {};
    cuts.forEach(function (c) { gapAt[c.at] = c.gap; });
    const best = {};
    best[str.length] = { c: 0, u: 0, n: 0, t: "" };
    for (let i = starts.length - 1; i >= 0; i--) {
      const a = starts[i];
      let pick = null;
      for (let j = i + 1; j <= starts.length; j++) {
        const b = j < starts.length ? starts[j] : str.length;
        const gap = j < starts.length ? gapAt[b] : "";
        const piece = str.slice(a, b - gap.length);
        const w = whole(piece, 0);
        const rest = best[b];
        const sep = j < starts.length ? (gap || (toZh ? "" : " ")) : "";
        const cand = { c: (w ? w.c : piece.length) + rest.c, u: (w ? w.u : piece.length) + rest.u, n: rest.n + 1, t: (w ? w.t : piece) + sep + rest.t };
        if (!pick || better(cand, pick) || (cand.c === pick.c && cand.u === pick.u && cand.n < pick.n)) pick = cand;
      }
      best[a] = pick;
    }
    return best[0].c < str.length ? best[0] : null;
  }

  function attempt(str) {
    const w = whole(str, 0);
    if (w && w.c === 0 && w.u === 0) return w;
    const j = joined(str);
    if (!w || !j) return w || j;
    return better(j, w) ? j : w;
  }

  return function convert(str) {
    if (typeof str !== "string" || !str) return str;
    if (from === "zh" ? !CJK.test(str) : !/[A-Za-z]/.test(str)) return str;
    let r = attempt(str);
    // The turn's result card drops the "{title}: " a project line starts with; put a stand-in back.
    if (!r || r.c > 0 || r.t === str) {
      const pre = from === "zh" ? "§：" : "§: ", post = toZh ? "§：" : "§: ";
      [str, str.charAt(0).toLowerCase() + str.slice(1)].forEach(function (body) {
        const p = attempt(pre + body);
        if (p && p.t.indexOf(post) === 0 && (!r || r.t === str || p.c < r.c)) {
          const rest = p.t.slice(post.length);
          r = { t: toZh ? rest : rest.charAt(0).toUpperCase() + rest.slice(1), c: p.c };
        }
      });
    }
    return r ? r.t : str;
  };
}

// Keys that hold ids, kinds and other values the code compares: never converted.
// Some text is stored in English on purpose and translated where it's shown (the TA course, the end
// screen's stat labels): those are kept too.
const KEEP = { id: 1, kind: 1, type: 1, sys: 1, stage: 1, phase: 1, cat: 1, category: 1, rarity: 1, seed: 1, rng: 1,
  lang: 1, url: 1, status: 1, trigger: 1, tip: 1, topic: 1, field: 1, source: 1, archetype: 1, venue: 1, tier: 1,
  taCourse: 1, statLabels: 1, inputs: 1, pastSeen: 1, ref: 1, persona: 1 };

let cached = null;

// Converts every player-facing string in a saved run or meta object, in place. Returns how many changed.
// A PhD 101 pointer ({ title, url }) keeps its title: those are the English essays' own titles.
export function convertSave(obj, table, from, to) {
  if (!obj || !table || from === to) return 0;
  if (!cached || cached.table !== table || cached.from !== from || cached.to !== to) cached = { table: table, from: from, to: to, conv: makeConverter(table, from, to) };
  const conv = cached.conv;
  let n = 0;
  (function walk(o) {
    if (Array.isArray(o)) {
      for (let i = 0; i < o.length; i++) {
        if (typeof o[i] === "string") { const c = conv(o[i]); if (c !== o[i]) { o[i] = c; n++; } } else if (o[i] && typeof o[i] === "object") walk(o[i]);
      }
    } else if (o && typeof o === "object") {
      Object.keys(o).forEach(function (k) {
        if (KEEP[k] || (k === "title" && typeof o.url === "string")) return;
        const v = o[k];
        if (typeof v === "string") { const c = conv(v); if (c !== v) { o[k] = c; n++; } } else if (v && typeof v === "object") walk(v);
      });
    }
  })(obj);
  obj.lang = to;
  return n;
}
