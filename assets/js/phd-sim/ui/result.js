// A finished PhD's details, shown on the end screen and on a shared result: the story and epilogue, the
// numbers, the hidden numbers, the advisor, the papers and the achievements. A shared link can carry
// less (older links have six numbers and no papers), so each part shows only what's there.
import { esc, bar, citationsText } from "./common.js";
import { t, T_ } from "../engine/i18n.js";
import { STAT_LABELS } from "../engine/state.js";

export const PAPER_STATUS = { accepted: T_("accepted"), rejected: T_("rejected"), under_review: T_("under review"), revise_resubmit: T_("revise resubmit") };

// The hidden numbers in the order they're shown. Share links carry them in this order, so add new ones
// at the end.
export const HIDDEN_SHOWN = ["taste", "coding", "writing", "presenting", "knowledge", "advisor_rel", "labmates_rel", "family_rel", "friends_rel", "network"];

const NUMBERS = [["years", T_("Years")], ["pubs", T_("First-author papers")], ["allPubs", T_("All papers")], ["citations", T_("Citations")], ["h", T_("h-index")],
  ["submissions", T_("Submissions")], ["rejections", T_("Rejections")], ["conferences", T_("Conferences")], ["overtime", T_("Overtime days")], ["burnouts", T_("Burnouts")], ["events", T_("Events")]];

const has = function (v) { return v !== null && v !== undefined; };

// Who said it: someone in your events (quotes.js), the opening line of a review, or a senior labmate's
// PhD 101 advice.
export function quoteBy(q) {
  if (q.kind === "review") return t("Reviewer {n}", { n: q.n });
  if (q.kind === "said") {
    switch (q.by) {
      case "advisor": return q.name || t("Your advisor");
      case "labmate": case "labmate2": return q.name ? t("{name}, a labmate", { name: q.name }) : t("A labmate");
      case "senior": return q.name ? t("{name}, a senior labmate", { name: q.name }) : t("A senior student");
      case "mentee": return q.name ? t("{name}, your mentee", { name: q.name }) : t("Your mentee");
      case "committee": return t("Your committee");
      case "prof": return q.name ? t("{name}, met at a conference", { name: q.name }) : t("A professor you met at a conference");
      case "stranger": return q.name ? t("{name}, met at a conference", { name: q.name }) : t("Someone you met at a conference");
      case "reviewer2": return t("Reviewer {n}", { n: 2 });
      case "partner": return t("Your partner");
      case "parent": return t("Your family");
    }
  }
  return q.by ? t("{name}, a senior labmate", { name: q.by }) : t("A senior student");
}

// Moments you lived through and what people said to you (endings.js pickMoments, pickQuotes).
function storyBitsHtml(e, own) {
  const moments = e.moments || [], quotes = (e.quotes || []).filter(function (q) { return q.text; });
  return (moments.length ? '<div class="ps-section"><h3 class="ps-section-title">' + esc(t("Moments from this PhD")) + '</h3><div class="ps-card ps-moments">' +
      moments.map(function (m) {
        return '<div class="ps-moment"><div class="ps-moment-head"><span class="ps-tag">' + esc(t("Year {n}", { n: Math.floor(m.t / 26) + 1 })) + "</span><b>" + esc(m.title) + "</b></div>" +
          (m.setup ? '<p class="ps-moment-setup">' + esc(m.setup) + "</p>" : "") +
          (m.label ? '<div class="ps-moment-pick">→ ' + esc(m.label) + "</div>" : "") + "<p>" + esc(m.text) + "</p></div>";
      }).join("") + "</div></div>" : "") +
    (quotes.length ? '<div class="ps-section"><h3 class="ps-section-title">' + esc(own ? t("Things people told you") : t("Things people said")) + '</h3><div class="ps-quotes">' +
      quotes.map(function (q) { return '<blockquote class="ps-quote"><p>“' + esc(q.text) + '”</p><cite>— ' + esc(quoteBy(q)) + "</cite></blockquote>"; }).join("") + "</div></div>" : "");
}

// own: the player's own end screen ("Your PhD in numbers") rather than someone else's result.
export function detailsHtml(e, D, own) {
  const n = e.numbers || {};
  const L = e.statLabels || STAT_LABELS;
  const stats = n.stats || {};
  const shownStats = HIDDEN_SHOWN.filter(function (k) { return has(stats[k]); });
  const nums = NUMBERS.filter(function (x) { return has(n[x[0]]); });
  const papers = e.papers || [];
  const achievements = e.achievements || [];
  return (e.text || (e.epilogue && e.epilogue.length) ? '<div class="ps-card ps-section">' + (e.text ? '<p class="ps-text">' + esc(e.text) + "</p>" : "") +
      (e.epilogue || []).map(function (l) { return '<p class="ps-small">' + esc(l) + "</p>"; }).join("") + "</div>" : "") +
    storyBitsHtml(e, own) +
    (nums.length ? '<div class="ps-section"><h3 class="ps-section-title">' + esc(own ? t("Your PhD in numbers") : t("This PhD in numbers")) + '</h3><div class="ps-numbers">' +
      nums.map(function (x) { return "<div><b>" + esc(n[x[0]]) + "</b>" + esc(t(x[1])) + "</div>"; }).join("") + "</div></div>" : "") +
    (shownStats.length ? '<div class="ps-section"><h3 class="ps-section-title">' + esc(t("The hidden numbers, revealed")) + '</h3><div class="ps-card ps-reveal">' +
      shownStats.map(function (k) { return '<div><div class="ps-meter-label"><span>' + esc(t(L[k])) + "</span><b>" + stats[k] + "</b></div>" + bar(stats[k]) + "</div>"; }).join("") + "</div></div>" : "") +
    (e.advisor ? '<p class="ps-small ps-muted">' + esc(e.advisor.name ? t("Advisor: {name} ({type}).", { name: e.advisor.name, type: e.advisor.label }) : t("Advisor: {type}.", { type: e.advisor.label })) + "</p>" : "") +
    (papers.length ? '<details class="ps-section"><summary class="ps-section-title">' + esc(t("Papers ({n})", { n: papers.length })) + '</summary><div class="ps-card">' + papers.map(function (p) {
      return '<div class="ps-paper"><span class="ps-tag">' + esc(p.venue) + "</span>" + esc(p.title || "") + '<div class="ps-meta">' + esc(PAPER_STATUS[p.status] ? t(PAPER_STATUS[p.status]) : p.status.replace("_", " ")) + (p.first ? "" : " · " + esc(t("co-author"))) + " · " + esc(citationsText(p.cites)) + "</div></div>";
    }).join("") + "</div></details>" : "") +
    (achievements.length ? '<div class="ps-section"><h3 class="ps-section-title">' + esc(own ? t("Achievements this run") : t("Achievements")) + '</h3><div class="ps-chips">' + achievements.map(function (id) {
      const a = D.achievementById[id];
      return a ? '<span class="ps-chip ps-chip-accent" title="' + esc(a.desc || "") + '">' + esc(a.name) + "</span>" : "";
    }).join("") + "</div></div>" : "");
}
