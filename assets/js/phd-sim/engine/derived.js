// Values computed from state rather than stored.
export function paperCitations(p) {
  return Math.round(p.citations || 0) + (p.bonusCites || 0);
}

export function totalCitations(G) {
  let n = G.state.bonusCitations || 0;
  G.state.papers.forEach(function (p) { n += paperCitations(p); });
  return n;
}

export function hIndex(G) {
  const c = G.state.papers.filter(function (p) { return !p.superseded; }).map(paperCitations).sort(function (a, b) { return b - a; });
  let h = 0;
  for (let i = 0; i < c.length; i++) if (c[i] >= i + 1) h = i + 1;
  return h;
}

export function acceptedPapers(G) {
  return G.state.papers.filter(function (p) { return p.status === "accepted"; });
}

export function firstAuthorPubs(G) {
  return acceptedPapers(G).filter(function (p) { return p.firstAuthor; }).length;
}

export function pendingFirstAuthor(G) {
  return G.state.papers.filter(function (p) {
    return p.firstAuthor && (p.status === "under_review" || p.status === "revise_resubmit");
  }).length;
}

export function tele(G, key) {
  const s = G.state;
  switch (key) {
    case "citations": return totalCitations(G);
    case "h_index": return hIndex(G);
    case "first_author_pubs": return firstAuthorPubs(G);
    case "coauthor_pubs": return acceptedPapers(G).filter(function (p) { return !p.firstAuthor; }).length;
    // Turns and streaks are counted in weeks; content thresholds are in two-week periods.
    case "turns": return Math.floor(s.turn / 2);
    case "overtime_streak": return Math.floor((s.telemetry.overtime_streak || 0) / 2);
    case "days_off_streak": return Math.floor((s.telemetry.days_off_streak || 0) / 2);
    default: return s.telemetry[key] || 0;
  }
}

export function statValue(G, key) {
  if (key === "citations") return totalCitations(G);
  if (key === "h_index") return hIndex(G);
  const v = G.state.stats[key];
  return v === undefined ? 0 : v;
}

export function hasStatus(G, id) {
  return G.state.statuses.some(function (s) { return s.id === id; });
}

export function hasTrait(G, id) {
  return G.state.player.traits.indexOf(id) >= 0;
}
