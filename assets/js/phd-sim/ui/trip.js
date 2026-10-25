// The conference week's look (engine/trip.js): while you're away, every card sits on convention-blue
// carpet under your badge and the week's schedule, with the people you've met so far.
import { esc } from "./common.js";
import { t, T_ } from "../engine/i18n.js";
import { STEPS, PARTY } from "../engine/trip.js";

const DAY_SHORT = [T_("Sun"), T_("Mon"), T_("Tue"), T_("Wed"), T_("Thu")];
// A lanyard color for each conference, picked by its name.
const LANYARDS = ["#2f6fd6", "#d65a32", "#2f8a55", "#8a4fd6", "#c98a12", "#d6336c"];

function lanyard(venue) {
  let h = 0;
  String(venue || "").split("").forEach(function (ch) { h = (h * 31 + ch.charCodeAt(0)) >>> 0; });
  return LANYARDS[h % LANYARDS.length];
}

// The kicker over a trip card: [icon, English label].
export function tripKicker(d) {
  if (d.qa) return ["\u{1F3A4}", T_("Questions from the audience")];
  if (d.talkStart) return d.kind === "poster" ? ["\u{1F4CC}", T_("Your poster")] : ["\u{1F3A4}", T_("Your talk")];
  if (d.report) return ["\u{1F6EC}", T_("Flying home")];
  return ["\u{1F39F}️", T_("Conference week")];
}

// Sunday to Thursday, daytime and evening: done, now, or still ahead. Your talk and the party are
// marked; Sunday daytime and Thursday evening are the flights.
function weekHtml(trip) {
  return '<ol class="ps-week" aria-label="' + esc(t("The week")) + '">' + DAY_SHORT.map(function (name, d) {
    const cells = ["day", "night"].map(function (slot) {
      const i = STEPS.findIndex(function (st) { return st.day === d + 1 && st.slot === slot; });
      if (i < 0) return '<i class="ps-wk-cell ps-wk-fly" title="' + esc(t("Travel")) + '">✈︎</i>';
      const state = i < trip.step ? "ps-wk-done" : i === trip.step ? "ps-wk-now" : "ps-wk-later";
      const mark = i === trip.talkAt ? (trip.kind === "poster" ? "\u{1F4CC}" : "\u{1F3A4}") : i === PARTY ? "\u{1F389}" : "";
      const label = i === trip.talkAt ? (trip.kind === "poster" ? t("Your poster") : t("Your talk")) : i === PARTY ? t("The party") : "";
      return '<i class="ps-wk-cell ' + state + (mark ? " ps-wk-mark" : "") + '"' + (label ? ' title="' + esc(label) + '"' : "") + ">" + mark + "</i>";
    }).join("");
    return '<li><span class="ps-wk-day">' + esc(t(name)) + "</span>" + cells + "</li>";
  }).join("") + "</ol>";
}

export function tripBarHtml(G) {
  const s = G.state, trip = s.trip;
  const role = trip.kind === "poster" ? t("Poster presenter") : t("Speaker");
  return '<div class="ps-tripbar" style="--ps-lanyard:' + lanyard(trip.venue) + '">' +
    '<div class="ps-badge" aria-label="' + esc(t("Your badge")) + '"><span class="ps-badge-venue">' + esc(trip.venue) + "</span>" +
    '<b class="ps-badge-name">' + esc(s.player.name) + '</b><span class="ps-badge-role">' + esc(role) + "</span></div>" +
    '<div class="ps-tripinfo">' + weekHtml(trip) +
    '<div class="ps-tripfacts"><span>\u{1F4CD} ' + esc(trip.city) + "</span>" +
    '<span title="' + esc(t("They become Network when you fly home.")) + '">\u{1F465} ' + esc(trip.contacts === 1 ? t("1 person met") : t("{n} people met", { n: trip.contacts })) + "</span></div>" +
    "</div></div>";
}
