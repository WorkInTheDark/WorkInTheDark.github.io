// Title, setup, help, codex, achievements and the end card.
import { esc, bar } from "./common.js";

function stripTokens(s) {
  return String(s || "").replace(/\{[^}]+\}/g, "…");
}

export function titleHtml(app) {
  const meta = app.meta;
  const endings = Object.keys((meta.codex && meta.codex.endings) || {}).length;
  const ach = Object.keys(meta.achievements || {}).length;
  const total = app.D.achievements.length;
  const careerEndings = app.D.endings.filter(function (e) { return e.id !== "founder"; }).length;
  return '<div class="ps-hero">' +
    '<p class="ps-tagline">Pick an advisor, run studies, survive Reviewer 2, and find out where it all leads. Every run is different, and the lessons along the way come from <a href="/phd101/">PhD 101</a>.</p>' +
    '<div class="ps-menu">' +
    (app.savedRun ? '<button class="ps-btn ps-btn-primary" data-action="resume">Continue your PhD</button>' : "") +
    '<button class="ps-btn' + (app.savedRun ? "" : " ps-btn-primary") + '" data-action="setup">Start a new PhD</button>' +
    '<button class="ps-btn" data-action="setup-daily">Today’s daily PhD</button>' +
    '<button class="ps-btn" data-action="help">How to play</button>' +
    '<button class="ps-btn" data-action="codex">Codex</button>' +
    "</div>" +
    (meta.runsCompleted ? '<p class="ps-muted ps-small" style="margin-top:1rem">' + meta.runsCompleted + " PhD" + (meta.runsCompleted === 1 ? "" : "s") + " finished · " +
      endings + " of " + careerEndings + " endings found · " + ach + " of " + total + " achievements</p>" : "") +
    (app.storageOk ? "" : '<p class="ps-note" style="max-width:30rem;margin:1rem auto 0">Your browser is blocking storage, so progress won’t be saved if you leave this page.</p>') +
    "</div>";
}

export function setupHtml(app) {
  const st = app.setup;
  const D = app.D;
  return '<div class="ps-spread"><h2>' + (st.daily ? "Today\u2019s daily PhD" : "A new PhD") + '</h2><button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="title">Back</button></div>' +
    (st.daily ? '<p class="ps-note">Everyone who plays today gets the same traits and the same world: topics, model releases and luck, until your choices diverge.</p>' : "") +
    '<div class="ps-section"><h3 class="ps-section-title">Your name</h3><input class="ps-input" id="ps-name" maxlength="24" value="' + esc(st.name) + '" aria-label="Your name"></div>' +
    '<div class="ps-section"><h3 class="ps-section-title">Your traits</h3><p class="ps-small ps-muted">Rolled at random. Everyone arrives with something.</p><div class="ps-grid">' +
    st.traits.map(function (id) {
      const t = D.traitById[id];
      return t ? '<div class="ps-pick ps-trait-fixed"><strong>' + esc(t.name) + "</strong><span>+ " + esc(t.up) + "</span><span>\u2212 " + esc(t.down) + "</span></div>" : "";
    }).join("") + "</div></div>" +
    '<div class="ps-foot"><button class="ps-btn ps-btn-primary" data-action="start">Begin your PhD</button></div>';
}

export function helpHtml() {
  return '<div class="ps-spread"><h2>How to play</h2><button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="back">Back</button></div><div class="ps-card">' +
    "<p><b>Each turn is one week.</b> Classes, TA duty and meetings take some of it; you choose <b>one thing</b> to do with the rest, and the week plays out as soon as you choose.</p>" +
    "<p>A few choices are always there: work on a project, read and learn, recharge, or get healthy. Other things come up: a writing retreat, a friend in town, an empty GPU cluster, the holidays. Those show up under <b>This week only</b> and are gone if you don't take them.</p>" +
    "<p>After each week, the <b>report</b> shows how your bars and projects changed, and what happened. Now and then something happens that needs a decision.</p>" +
    "<p>Three bars to balance. <b>Energy</b> powers work: a normal work week costs about 9, and below 60 everything gets less done. <b>Stress</b> builds with work, deadlines and rejections; at 100 you burn out for a few weeks. <b>Health</b> wears down slowly at a desk, faster when you're exhausted or stressed; when it's low you get sick more often. <b>Recharge</b> brings Energy back and Stress down; <b>Get healthy</b> rebuilds Health. Weekends are off unless you crunch for a deadline.</p>" +
    "<p>Your skills, relationships and network are <b>hidden</b>, like in real life; watch for hints. Everything is revealed at the end.</p>" +
    "<p>Choices show <b>arrows</b> (\u2191 up, \u2193 down, doubled when big, \u2195 when it depends on how it goes). Green is good for you, red is bad. Numbers only appear after you choose.</p>" +
    "<p>Each <b>project</b> is one progress bar that moves through phases. Related work is mostly reading, so a week of <b>Read and learn</b> moves it faster. Some phases just take calendar time (IRB review, recruiting, annotation): the project waits a few weeks and you do something else. New projects get their kind and topic on their own. In a deadline week, a <b>Polish and submit</b> choice appears; you need at least half a draft. Skip it and the paper waits for the next deadline.</p>" +
    "<p>When reviews arrive, you choose <b>one response per reviewer</b> (Clarify unless you change it). Reviews are noisy. Responses help.</p>" +
    "<p><b>To graduate</b> you pass quals, propose your thesis, publish at least three first-author papers, spend about three months preparing, and defend. Or don't: leaving is never losing.</p>" +
    "<p>Your progress saves in this browser. The <b>Codex</b> remembers everything you've discovered across runs.</p></div>";
}

const GROUP_ORDER = ["Academia", "Industry", "Startup", "Other", "Leaving"];

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
  let html = '<div class="ps-spread"><h2>Codex</h2><button class="ps-btn ps-btn-sm ps-btn-ghost" data-action="back">Back</button></div>';
  html += '<p class="ps-muted">Everything you have discovered, across every run in this browser.</p>';
  html += '<div class="ps-section"><h3 class="ps-section-title">Endings · ' + Object.keys(endFound).filter(function (k) { return k !== "founder"; }).length + " / " + endings.length + "</h3><div class=\"ps-card\">" +
    GROUP_ORDER.map(function (g) {
      const list = endings.filter(function (e) { return e.group === g; });
      return "<h4>" + esc(g) + '</h4><ul class="ps-codex-list">' + list.map(function (e) {
        return endFound[e.id] ? "<li>" + esc(e.name) + (endFound[e.id] > 1 ? ' <span class="ps-muted">×' + endFound[e.id] + "</span>" : "") + "</li>" : '<li class="ps-unknown">???</li>';
      }).join("") + "</ul>";
    }).join("") + "</div></div>";
  html += '<div class="ps-section"><h3 class="ps-section-title">Advisors met</h3><div class="ps-card"><ul class="ps-codex-list">' + D.archetypes.map(function (a) {
    const met = cx.advisors && cx.advisors[a.id];
    return met ? "<li><b>" + esc(a.nick) + "</b> (" + esc(a.label) + "): " + esc(a.tagline) + "</li>" : '<li class="ps-unknown">???</li>';
  }).join("") + "</ul></div></div>";
  html += '<div class="ps-section"><h3 class="ps-section-title">Achievements · ' + Object.keys(ach).length + " / " + D.achievements.length + '</h3><div class="ps-card"><ul class="ps-codex-list">' +
    D.achievements.map(function (a) {
      if (ach[a.id]) return "<li><b>" + esc(a.name) + "</b>: " + esc(a.desc) + "</li>";
      return a.secret ? '<li class="ps-unknown">??? (secret)</li>' : '<li class="ps-muted">' + esc(a.name) + ": " + esc(a.desc) + "</li>";
    }).join("") + "</ul></div></div>";
  html += '<div class="ps-section"><h3 class="ps-section-title">Titles</h3><div class="ps-card"><ul class="ps-codex-list">' + D.titles.map(function (t) {
    return cx.titles && cx.titles[t.id] ? "<li><b>" + esc(t.name) + "</b>: " + esc(t.desc || "") + "</li>" : '<li class="ps-unknown">???</li>';
  }).join("") + "</ul></div></div>";
  html += '<div class="ps-section"><h3 class="ps-section-title">Events · ' + totalFound + " / " + D.events.length + '</h3><div class="ps-card">' +
    Object.keys(cats).sort().map(function (c) {
      const g = cats[c];
      return "<details><summary><b>" + esc(c.charAt(0).toUpperCase() + c.slice(1)) + "</b> · " + g.found.length + " / " + g.total + '</summary><ul class="ps-codex-list">' +
        g.found.map(function (e) {
          const outs = Object.keys(seen[e.id].o || {}).map(function (k) { return seen[e.id].o[k]; }).filter(function (t) { return typeof t === "string" && t; });
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
  return '<div class="ps-end"><div class="ps-end-head"><div class="ps-kicker">' + (e.graduated ? "Graduated" : "Left the PhD") + " · " + esc(e.group) + "</div>" +
    "<h2>" + esc(e.name) + '</h2><div class="ps-end-title">' + esc(e.title.name) + "</div>" +
    (e.title.desc ? '<div class="ps-muted ps-small">' + esc(e.title.desc) + "</div>" : "") + "</div>" +
    '<div class="ps-card ps-section"><p class="ps-text">' + esc(e.text) + "</p>" + e.epilogue.map(function (l) { return '<p class="ps-small">' + esc(l) + "</p>"; }).join("") + "</div>" +
    '<div class="ps-section"><h3 class="ps-section-title">Your PhD in numbers</h3><div class="ps-numbers">' +
    [["Years", n.years], ["First-author papers", n.pubs], ["All papers", n.allPubs], ["Citations", n.citations], ["h-index", n.h], ["Submissions", n.submissions],
      ["Rejections", n.rejections], ["Conferences", n.conferences], ["Overtime days", n.overtime], ["Burnouts", n.burnouts], ["Events", n.events]]
      .map(function (x) { return "<div><b>" + esc(x[1]) + "</b>" + esc(x[0]) + "</div>"; }).join("") + "</div></div>" +
    '<div class="ps-section"><h3 class="ps-section-title">The hidden numbers, revealed</h3><div class="ps-card ps-reveal">' +
    hidden.map(function (k) { return '<div><div class="ps-meter-label"><span>' + esc(L[k]) + "</span><b>" + n.stats[k] + "</b></div>" + bar(n.stats[k]) + "</div>"; }).join("") + "</div></div>" +
    (e.advisor ? '<p class="ps-small ps-muted">Advisor: ' + esc(e.advisor.name) + ", known as " + esc(e.advisor.nick) + " (" + esc(e.advisor.label) + ").</p>" : "") +
    (e.papers.length ? '<details class="ps-section"><summary class="ps-section-title">Papers (' + e.papers.length + ')</summary><div class="ps-card">' + e.papers.map(function (p) {
      return '<div class="ps-paper"><span class="ps-tag">' + esc(p.venue) + "</span>" + esc(p.title) + '<div class="ps-meta">' + esc(p.status.replace("_", " ")) + (p.first ? "" : " · co-author") + " · " + p.cites + " citations</div></div>";
    }).join("") + "</div></details>" : "") +
    (e.achievements.length ? '<div class="ps-section"><h3 class="ps-section-title">Achievements this run</h3><div class="ps-chips">' + e.achievements.map(function (id) {
      const a = app.D.achievementById[id];
      return a ? '<span class="ps-chip ps-chip-accent" title="' + esc(a.desc) + '">' + esc(a.name) + "</span>" : "";
    }).join("") + "</div></div>" : "") +
    (e.recommendations.length ? '<div class="ps-section"><h3 class="ps-section-title">From PhD 101, for how you played</h3><div class="ps-recs">' + e.recommendations.map(function (r) {
      return '<a href="' + esc(r.url) + '" target="_blank" rel="noopener"><b>' + esc(r.title) + "</b><small>" + esc(r.topic) + "</small><small>" + esc(r.why) + "</small></a>";
    }).join("") + "</div></div>" : "") +
    '<div class="ps-foot" style="justify-content:center"><button class="ps-btn" data-action="copy-summary">Copy summary</button>' +
    '<button class="ps-btn" data-action="save-image">Save as image</button><button class="ps-btn" data-action="codex">Codex</button>' +
    '<button class="ps-btn ps-btn-primary" data-action="setup">Play again</button></div></div>';
}

export function summaryText(e) {
  const n = e.numbers;
  return "PhD Simulator: " + e.name + " — “" + e.title.name + "”. " + n.years + " years, " + n.pubs + " first-author papers, " +
    n.citations + " citations (h " + n.h + "), " + n.rejections + " rejections, " + n.burnouts + " burnouts.";
}

export function drawCard(e) {
  const c = document.createElement("canvas");
  c.width = 1200; c.height = 630;
  const x = c.getContext("2d");
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  x.fillStyle = dark ? "#1c1c1d" : "#ffffff"; x.fillRect(0, 0, 1200, 630);
  x.fillStyle = dark ? "#8db0f6" : "#2569ed"; x.fillRect(0, 0, 1200, 10);
  const fg = dark ? "#e6e6e6" : "#1f2328";
  const mute = dark ? "#a1a1aa" : "#6b7280";
  x.fillStyle = mute; x.font = "600 26px system-ui, sans-serif"; x.fillText("PHD SIMULATOR", 70, 90);
  x.fillStyle = fg; x.font = "700 64px system-ui, sans-serif"; x.fillText(e.name, 70, 180, 1060);
  x.fillStyle = dark ? "#8db0f6" : "#2569ed"; x.font = "600 36px system-ui, sans-serif"; x.fillText(e.title.name, 70, 240, 1060);
  const n = e.numbers;
  const cells = [["Years", n.years], ["Papers", n.pubs], ["Citations", n.citations], ["h-index", n.h], ["Rejections", n.rejections], ["Burnouts", n.burnouts]];
  cells.forEach(function (cell, i) {
    const cx = 70 + (i % 3) * 360, cy = 330 + Math.floor(i / 3) * 120;
    x.fillStyle = fg; x.font = "700 52px system-ui, sans-serif"; x.fillText(String(cell[1]), cx, cy);
    x.fillStyle = mute; x.font = "400 26px system-ui, sans-serif"; x.fillText(cell[0], cx, cy + 36);
  });
  x.fillStyle = mute; x.font = "400 24px system-ui, sans-serif"; x.fillText(location.host + location.pathname, 70, 590);
  return c;
}
