// Title, setup, codex, achievements and the end card.
import { esc, bar } from "./common.js";
import { shareRowHtml, beatsLine } from "./share.js";
import { boardSectionHtml } from "./board.js";
import { t, T_, LANGUAGES, language } from "../engine/i18n.js";

function stripTokens(s) {
  return String(s || "").replace(/\{[^}]+\}/g, "…");
}

export function titleHtml(app) {
  const meta = app.meta;
  const endings = Object.keys((meta.codex && meta.codex.endings) || {}).length;
  const ach = Object.keys(meta.achievements || {}).length;
  const total = app.D.achievements.length;
  const careerEndings = app.D.endings.filter(function (e) { return e.id !== "founder"; }).length;
  const runs = meta.runsCompleted === 1 ? t("1 PhD finished") : t("{n} PhDs finished", { n: meta.runsCompleted });
  return '<div class="ps-hero"><div class="ps-hero-icon" aria-hidden="true">\u{1F393}</div><h2 class="ps-hero-title">' + esc(t("PhD Simulator")) + "</h2>" +
    '<p class="ps-tagline">' + t("Two weeks a turn. Run studies, survive Reviewer 2, and see where it leads. Lessons from {phd101}.", { phd101: '<a href="/phd101/">' + esc(t("PhD 101")) + "</a>" }) + "</p>" +
    '<div class="ps-menu">' +
    (app.savedRun ? '<button class="ps-btn ps-btn-primary" data-action="resume">' + esc(t("Continue your PhD")) + "</button>" : "") +
    // The two ways to start, each with a line on how it differs (playtest feedback, 2026-10-23).
    '<button class="ps-btn ps-btn-two' + (app.savedRun ? "" : " ps-btn-primary") + '" data-action="setup"><span>' + esc(t("Start a new PhD")) + "</span><small>" +
      esc(t("A random start: every PhD is different.")) + "</small></button>" +
    '<button class="ps-btn ps-btn-two" data-action="setup-daily"><span>' + esc(t("Today’s daily PhD")) + "</span><small>" +
      esc(app.board ? t("Everyone plays the same game today, with the same start and the same luck, ranked on today’s leaderboard.")
        : t("Everyone plays the same game today: the same start and the same luck. Only your choices differ.")) + "</small></button>" +
    (app.board ? '<button class="ps-btn" data-action="board">' + esc(t("Leaderboard")) + "</button>" : "") +
    '<button class="ps-btn" data-action="codex">' + esc(t("Codex")) + "</button>" +
    "</div>" +
    // Each language is named in itself, so the switch reads the same in every language.
    '<div class="ps-langs" role="group" aria-label="Language / 语言">' + LANGUAGES.map(function (l) {
      const on = l.id === language();
      return '<button class="ps-lang' + (on ? " ps-lang-on" : "") + '" data-action="lang" data-id="' + l.id + '" aria-pressed="' + on + '" lang="' + (l.id === "zh" ? "zh-Hans" : "en") + '">' + esc(l.label) + "</button>";
    }).join("") + "</div>" +
    (meta.runsCompleted ? '<p class="ps-muted ps-small" style="margin-top:1rem">' + esc(runs) + " · " +
      esc(t("{n} of {total} endings found", { n: endings, total: careerEndings })) + " · " + esc(t("{n} of {total} achievements", { n: ach, total: total })) + "</p>" : "") +
    (app.storageOk ? "" : '<p class="ps-note" style="max-width:30rem;margin:1rem auto 0">' + esc(t("Your browser is blocking storage, so progress won’t be saved if you leave this page.")) + "</p>") +
    "</div>";
}

export function setupHtml(app) {
  const st = app.setup;
  const D = app.D;
  return '<div class="ps-spread"><h2>' + esc(st.daily ? t("Today\u2019s daily PhD") : t("A new PhD")) + '</h2><button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="title">' + esc(t("Back")) + "</button></div>" +
    (st.daily ? '<p class="ps-note">' + esc(t("Everyone who plays today gets the same traits and the same world: topics, model releases and luck, until your choices diverge.")) + "</p>" : "") +
    '<div class="ps-section"><h3 class="ps-section-title">' + esc(t("Your name")) + '</h3><input class="ps-input" id="ps-name" maxlength="24" value="' + esc(st.name) + '" aria-label="' + esc(t("Your name")) + '"></div>' +
    '<div class="ps-section"><h3 class="ps-section-title">' + esc(t("Your traits")) + '</h3><p class="ps-small ps-muted">' + esc(t("Rolled at random. Everyone arrives with something.")) + '</p><div class="ps-grid">' +
    st.traits.map(function (id) {
      const tr = D.traitById[id];
      return tr ? '<div class="ps-pick ps-trait-fixed"><strong>' + esc(tr.name) + "</strong><span>+ " + esc(tr.up) + "</span><span>\u2212 " + esc(tr.down) + "</span></div>" : "";
    }).join("") + "</div></div>" +
    '<div class="ps-foot"><button class="ps-btn ps-btn-primary" data-action="start">' + esc(t("Begin your PhD")) + "</button></div>";
}

// Ending groups in codex order. The endings' group names arrive translated with the content, so a
// group is matched in English or translated; a group missing here is listed at the end.
const GROUP_ORDER = ["Academia", "Industry", "Startup", "Other", "Leaving"];

function endingGroups(endings) {
  const out = GROUP_ORDER.map(function (g) {
    return { name: g, list: endings.filter(function (e) { return e.group === g || e.group === t(g); }) };
  });
  endings.forEach(function (e) {
    if (!e.group || out.some(function (x) { return x.list.indexOf(e) >= 0; })) return;
    let x = out.find(function (o) { return o.extra && o.name === e.group; });
    if (!x) { x = { name: e.group, list: [], extra: true }; out.push(x); }
    x.list.push(e);
  });
  return out.map(function (x) { return { name: x.list.length ? x.list[0].group : x.name, list: x.list }; });
}

// Event categories as the codex names them (the ids, capitalized).
const CODEX_CATEGORY = {
  advisor: T_("Advisor"), career: T_("Career"), data: T_("Data"), exit: T_("Exit"), lab: T_("Lab"), life: T_("Life"),
  milestone: T_("Milestone"), research: T_("Research"), reviews: T_("Reviews"), teaching: T_("Teaching"), travel: T_("Travel"),
  wellbeing: T_("Wellbeing"), world: T_("World"), writing: T_("Writing")
};

// A paper's status on the end screen.
const PAPER_STATUS = { accepted: T_("accepted"), rejected: T_("rejected"), under_review: T_("under review"), revise_resubmit: T_("revise resubmit") };

export function codexHtml(app) {
  const D = app.D;
  const cx = app.meta.codex || {};
  const seen = cx.events || {};
  const cats = {};
  D.events.forEach(function (e) {
    const c = e.category === "legion" ? "advisor" : e.category;
    cats[c] = cats[c] || { total: 0, found: [] };
    cats[c].total++;
    if (seen[e.id]) cats[c].found.push(e);
  });
  const totalFound = D.events.filter(function (e) { return seen[e.id]; }).length;
  const endings = D.endings.filter(function (e) { return e.id !== "founder"; });
  const endFound = cx.endings || {};
  const ach = app.meta.achievements || {};
  let html = '<div class="ps-spread"><h2>' + esc(t("Codex")) + '</h2><button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="back">' + esc(t("Back")) + "</button></div>";
  html += '<p class="ps-muted">' + esc(t("Everything you have discovered, across every run in this browser.")) + "</p>";
  html += '<div class="ps-section"><h3 class="ps-section-title">' + esc(t("Endings · {n} / {total}", { n: Object.keys(endFound).filter(function (k) { return k !== "founder"; }).length, total: endings.length })) + "</h3><div class=\"ps-card\">" +
    endingGroups(endings).map(function (g) {
      const list = g.list;
      return "<h4>" + esc(g.name) + '</h4><ul class="ps-codex-list">' + list.map(function (e) {
        return endFound[e.id] ? "<li>" + esc(e.name) + (endFound[e.id] > 1 ? ' <span class="ps-muted">×' + endFound[e.id] + "</span>" : "") + "</li>" : '<li class="ps-unknown">???</li>';
      }).join("") + "</ul>";
    }).join("") + "</div></div>";
  html += '<div class="ps-section"><h3 class="ps-section-title">' + esc(t("Advisors met")) + '</h3><div class="ps-card"><ul class="ps-codex-list">' + D.archetypes.map(function (a) {
    const met = cx.advisors && cx.advisors[a.id];
    return met ? "<li><b>" + esc(a.label) + "</b>: " + esc(a.tagline) + "</li>" : '<li class="ps-unknown">???</li>';
  }).join("") + "</ul></div></div>";
  html += '<div class="ps-section"><h3 class="ps-section-title">' + esc(t("Achievements · {n} / {total}", { n: Object.keys(ach).length, total: D.achievements.length })) + '</h3><div class="ps-card"><ul class="ps-codex-list">' +
    D.achievements.map(function (a) {
      if (ach[a.id]) return "<li><b>" + esc(a.name) + "</b>: " + esc(a.desc) + "</li>";
      return a.secret ? '<li class="ps-unknown">' + esc(t("??? (secret)")) + "</li>" : '<li class="ps-muted">' + esc(a.name) + ": " + esc(a.desc) + "</li>";
    }).join("") + "</ul></div></div>";
  html += '<div class="ps-section"><h3 class="ps-section-title">' + esc(t("Titles")) + '</h3><div class="ps-card"><ul class="ps-codex-list">' + D.titles.map(function (ti) {
    return cx.titles && cx.titles[ti.id] ? "<li><b>" + esc(ti.name) + "</b>: " + esc(ti.desc || "") + "</li>" : '<li class="ps-unknown">???</li>';
  }).join("") + "</ul></div></div>";
  html += '<div class="ps-section"><h3 class="ps-section-title">' + esc(t("Events · {n} / {total}", { n: totalFound, total: D.events.length })) + '</h3><div class="ps-card">' +
    Object.keys(cats).sort().map(function (c) {
      const g = cats[c];
      return "<details><summary><b>" + esc(CODEX_CATEGORY[c] ? t(CODEX_CATEGORY[c]) : c.charAt(0).toUpperCase() + c.slice(1)) + "</b> · " + g.found.length + " / " + g.total + '</summary><ul class="ps-codex-list">' +
        g.found.map(function (e) {
          const outs = Object.keys(seen[e.id].o || {}).map(function (k) { return seen[e.id].o[k]; }).filter(function (x) { return typeof x === "string" && x; });
          return "<li>" + esc(stripTokens(e.title)) + (outs.length ? '<br><span class="ps-muted ps-small">' + esc(outs.slice(0, 2).join(" / ")) + "</span>" : "") + "</li>";
        }).join("") + "</ul></details>";
    }).join("") + "</div></div>";
  return html;
}

export function endHtml(app) {
  const e = app.ending;
  const n = e.numbers;
  const L = e.statLabels;
  const hidden = ["taste", "coding", "writing", "presenting", "knowledge", "advisor_rel", "labmates_rel", "family_rel", "friends_rel", "network"];
  return '<div class="ps-end"><div class="ps-end-head"><div class="ps-kicker">' + esc(e.graduated ? t("Graduated") : t("Left the PhD")) + " · " + esc(e.group) + "</div>" +
    "<h2>" + esc(e.name) + '</h2><div class="ps-end-title">' + esc(e.title.name) + "</div>" +
    (e.title.desc ? '<div class="ps-muted ps-small">' + esc(e.title.desc) + "</div>" : "") + "</div>" +
    (beatsLine(n.beats) ? '<p class="ps-share-beats" title="' + esc(t("Your research record (papers, top venues, h-index, citations, letters) against thousands of simulated runs of the game.")) + '">' + esc(beatsLine(n.beats, true)) + "</p>" : "") +
    '<div class="ps-card ps-section"><p class="ps-text">' + esc(e.text) + "</p>" + e.epilogue.map(function (l) { return '<p class="ps-small">' + esc(l) + "</p>"; }).join("") + "</div>" +
    '<div class="ps-section"><h3 class="ps-section-title">' + esc(t("Your PhD in numbers")) + '</h3><div class="ps-numbers">' +
    [[t("Years"), n.years], [t("First-author papers"), n.pubs], [t("All papers"), n.allPubs], [t("Citations"), n.citations], [t("h-index"), n.h], [t("Submissions"), n.submissions],
      [t("Rejections"), n.rejections], [t("Conferences"), n.conferences], [t("Overtime days"), n.overtime], [t("Burnouts"), n.burnouts], [t("Events"), n.events]]
      .map(function (x) { return "<div><b>" + esc(x[1]) + "</b>" + esc(x[0]) + "</div>"; }).join("") + "</div></div>" +
    '<div class="ps-section"><h3 class="ps-section-title">' + esc(t("The hidden numbers, revealed")) + '</h3><div class="ps-card ps-reveal">' +
    hidden.map(function (k) { return '<div><div class="ps-meter-label"><span>' + esc(t(L[k])) + "</span><b>" + n.stats[k] + "</b></div>" + bar(n.stats[k]) + "</div>"; }).join("") + "</div></div>" +
    (e.advisor ? '<p class="ps-small ps-muted">' + esc(t("Advisor: {name} ({type}).", { name: e.advisor.name, type: e.advisor.label })) + "</p>" : "") +
    (e.papers.length ? '<details class="ps-section"><summary class="ps-section-title">' + esc(t("Papers ({n})", { n: e.papers.length })) + '</summary><div class="ps-card">' + e.papers.map(function (p) {
      return '<div class="ps-paper"><span class="ps-tag">' + esc(p.venue) + "</span>" + esc(p.title) + '<div class="ps-meta">' + esc(PAPER_STATUS[p.status] ? t(PAPER_STATUS[p.status]) : p.status.replace("_", " ")) + (p.first ? "" : " · " + esc(t("co-author"))) + " · " + esc(t("{n} citations", { n: p.cites })) + "</div></div>";
    }).join("") + "</div></details>" : "") +
    (e.achievements.length ? '<div class="ps-section"><h3 class="ps-section-title">' + esc(t("Achievements this run")) + '</h3><div class="ps-chips">' + e.achievements.map(function (id) {
      const a = app.D.achievementById[id];
      return a ? '<span class="ps-chip ps-chip-accent" title="' + esc(a.desc) + '">' + esc(a.name) + "</span>" : "";
    }).join("") + "</div></div>" : "") +
    (e.recommendations.length ? '<div class="ps-section"><h3 class="ps-section-title">' + esc(t("From PhD 101, for how you played")) + '</h3><div class="ps-recs">' + e.recommendations.map(function (r) {
      return '<a href="' + esc(r.url) + '" target="_blank" rel="noopener"><b>' + esc(r.title) + "</b><small>" + esc(r.topic) + "</small><small>" + esc(r.why) + "</small></a>";
    }).join("") + "</div></div>" : "") +
    boardSectionHtml(app) +
    shareRowHtml(e, app.D, typeof navigator !== "undefined" && typeof navigator.share === "function") +
    '<div class="ps-foot" style="justify-content:center"><button class="ps-btn" data-action="codex">' + esc(t("Codex")) + "</button>" +
    '<button class="ps-btn ps-btn-primary" data-action="setup">' + esc(t("Play again")) + "</button></div></div>";
}

