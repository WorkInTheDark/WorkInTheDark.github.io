// What people say in the events, for the end card's "Things people told you" (endings.js pickQuotes):
// the quoted lines in an event's text whose speaker is clear from the same sentence. They're found once
// in the English, before any translation (annotateQuotes), so a run records the same quotes in every
// language; the words are then taken from the k-th quote of the line in the language shown (quoteAt).
// Quoted phrases that aren't speech ("quick question", a paper title) and lines with no clear speaker
// (often your own) are left out.

const QUOTE = /"([^"]+)"|“([^”]+)”/g;
const END = /[.!?。！？]/;
// Who, by what sits next to the quote. Tokens first; then the people the events name in words.
const SPEAKERS = [
  [/\{advisor\}/, "advisor"], [/\{labmate2\}/, "labmate2"], [/\{labmate\}/, "labmate"], [/\{senior\}/, "senior"], [/\{mentee\}/, "mentee"],
  [/\{committee\}/, "committee"], [/\{prof\}/, "prof"], [/\{stranger\}/, "stranger"], [/Reviewer 2|2 号审稿人/, "reviewer2"], [/[Yy]our partner|你对象|对象/, "partner"],
  [/[Yy]our parent|家人/, "parent"]
];

// Said, not just quoted: words (not "!!!!!" or a lone {paper}), and a whole sentence or a long phrase.
function speechLike(q) {
  const words = q.replace(/\{[a-z0-9_.]+\}/g, "");
  if (!/[A-Za-z\u4e00-\u9fff]/.test(words)) return false;
  if (END.test(q) || /…/.test(q)) return true;
  return /[\u4e00-\u9fff]/.test(q) ? q.length >= 12 : q.trim().split(/\s+/).length >= 7;
}

function speakerIn(seg, last) {
  let best = null, at = last ? -1 : Infinity;
  SPEAKERS.forEach(function (sp) {
    const re = new RegExp(sp[0].source, "g");
    let m;
    while ((m = re.exec(seg))) {
      if (last ? m.index > at : m.index < at) { at = m.index; best = sp[1]; }
      if (!last) break;
    }
  });
  return best;
}

// The quotes in one line of text (a template, tokens and all): [{ k, raw, kind }], where k counts
// every quote in the line, so the same quote can be found again from an id and k.
export function findQuotes(text) {
  const out = [];
  if (typeof text !== "string") return out;
  let m, k = 0;
  QUOTE.lastIndex = 0;
  while ((m = QUOTE.exec(text))) {
    const raw = m[1] !== undefined ? m[1] : m[2];
    const before = text.slice(0, m.index);
    const cut = Math.max(before.lastIndexOf(". "), before.lastIndexOf("! "), before.lastIndexOf("? "), before.lastIndexOf("。"), before.lastIndexOf("！"), before.lastIndexOf("？"));
    const segBefore = before.slice(cut + 1);
    const after = text.slice(m.index + m[0].length);
    const stop = after.search(/[.!?。！？]/);
    const segAfter = stop < 0 ? after : after.slice(0, stop);
    // A quote that opens its sentence ("{advisor} reads it twice. "Good."") belongs to the person in the
    // sentence before, if there's exactly one.
    let kind = speakerIn(segBefore, true) || speakerIn(segAfter, false);
    if (!kind && !segBefore.trim() && cut >= 0) {
      const prev = before.slice(0, cut);
      const pcut = Math.max(prev.lastIndexOf(". "), prev.lastIndexOf("! "), prev.lastIndexOf("? "), prev.lastIndexOf("。"), prev.lastIndexOf("！"), prev.lastIndexOf("？"));
      const prevSentence = prev.slice(pcut + 1);
      const found = SPEAKERS.filter(function (sp) { return sp[0].test(prevSentence); });
      if (found.length === 1 && !/(^|\s)(You|you)\s|你/.test(prevSentence.replace(/\{[a-z0-9_.]+\}/g, ""))) kind = found[0][1];
    }
    if (kind && speechLike(raw)) out.push({ k: k, raw: raw, kind: kind });
    k++;
  }
  return out;
}

// Marks every event's English text with its quotes: ev.says = { setup: [per setup line], choices:
// [{ out, success, failure }] }, each a list of { k, kind, n } (n: the English length, for ranking).
// Runs before translation (i18n.js translateData) or, for English, when the data is prepared.
export function annotateQuotes(events) {
  const list = Array.isArray(events) ? events : Object.keys(events || {}).reduce(function (a, f) { return a.concat(events[f] || []); }, []);
  const meta = function (t) { return findQuotes(t).map(function (q) { return { k: q.k, kind: q.kind, n: q.raw.length }; }); };
  list.forEach(function (ev) {
    if (!ev || ev.says) return;
    const texts = Array.isArray(ev.text) ? ev.text : ev.text ? [ev.text] : [];
    ev.says = { setup: texts.map(meta), choices: (ev.choices || []).map(function (c) {
      return { out: meta(c.text), success: meta(c.success && c.success.text), failure: meta(c.failure && c.failure.text) };
    }) };
  });
}

// The k-th quote in a line, counting every quote, in whatever language the line is in.
export function quoteAt(text, k) {
  if (typeof text !== "string") return null;
  let m, i = 0;
  QUOTE.lastIndex = 0;
  while ((m = QUOTE.exec(text))) {
    if (i === k) { QUOTE.lastIndex = 0; return m[1] !== undefined ? m[1] : m[2]; }
    i++;
  }
  return null;
}
