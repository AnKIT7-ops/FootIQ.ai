import { players } from "@/lib/repositories/players";
import { teams } from "@/lib/repositories/teams";
import { news } from "@/lib/repositories/news";
import { contentLibrary, contentKindLabels } from "@/lib/repositories/content";
import { legalEntries, pageEntries } from "@/lib/nav";
import { managerPathFor, newsPathFor, playerPathFor, teamPathFor } from "@/lib/slug-builders";
import { bump, top } from "@/lib/metrics";

export interface SearchItem {
  id: string;
  kind: "player" | "team" | "manager" | "page" | "news" | "intel" | "action";
  label: string;
  sub: string;
  to: string;
  keywords: string;
}

export const searchIndex: SearchItem[] = [
  ...players.map((p) => ({
    id: `player-${p.id}`,
    kind: "player" as const,
    label: p.name,
    sub: `${p.role} · ${p.nationality}`,
    to: playerPathFor(p),
    keywords: `${p.name} ${p.role} ${p.nationality} ${p.position}`.toLowerCase(),
  })),
  ...teams.map((t) => ({
    id: `team-${t.id}`,
    kind: "team" as const,
    label: t.name,
    sub: `${t.league} · ${t.manager}`,
    to: teamPathFor(t),
    keywords: `${t.name} ${t.short} ${t.tla} ${t.league} ${t.manager}`.toLowerCase(),
  })),
  ...teams.map((t) => ({
    id: `manager-${t.id}`,
    kind: "manager" as const,
    label: t.manager,
    sub: `Manager · ${t.name}`,
    to: managerPathFor(t),
    keywords: `${t.manager} manager coach ${t.name} tactics`.toLowerCase(),
  })),
  ...[...pageEntries, ...legalEntries].map((p) => ({
    id: `page-${p.to}`,
    kind: "page" as const,
    label: p.label,
    sub: p.sub,
    to: p.to,
    keywords: `${p.label} ${p.keywords}`.toLowerCase(),
  })),
  ...news.map((n) => ({
    id: `news-${n.id}`,
    kind: "news" as const,
    label: n.title.length > 64 ? n.title.slice(0, 61) + "…" : n.title,
    sub: `${n.category} · ${n.source}`,
    to: newsPathFor(n),
    keywords: `${n.title} ${n.tags.join(" ")}`.toLowerCase(),
  })),
  ...contentLibrary().map((a) => ({
    id: `intel-${a.slug}`,
    kind: "intel" as const,
    label: a.title.length > 64 ? a.title.slice(0, 61) + "…" : a.title,
    sub: `Intelligence · ${contentKindLabels[a.kind]}`,
    to: `/intelligence/${a.slug}`,
    keywords: `${a.title} ${a.tags.join(" ")} ${a.kind}`.toLowerCase(),
  })),
];

// ---- typo tolerance ---------------------------------------------------------

/** Bounded Levenshtein — bails at >max so the common case stays cheap. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const tolerance = (len: number): number => (len < 4 ? 0 : len < 7 ? 1 : 2);

/** True when `word` fuzzily matches any token of `keywords`. */
function fuzzyHit(word: string, keywords: string): boolean {
  const max = tolerance(word.length);
  if (max === 0) return false;
  for (const token of keywords.split(/[^a-z0-9]+/)) {
    if (token.length < 3) continue;
    if (editDistance(word, token, max) <= max) return true;
  }
  return false;
}

export function runSearch(query: string, limit = 9): SearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/);
  return searchIndex
    .map((item) => {
      let score = 0;
      const label = item.label.toLowerCase();
      if (label.startsWith(q)) score += 6;
      if (label.includes(q)) score += 3;
      for (const w of words) {
        if (item.keywords.includes(w)) score += 1;
        else if (fuzzyHit(w, item.keywords)) score += 0.6; // typo-tolerant partial credit
      }
      // surface players/teams above news for short queries
      if (score > 0 && (item.kind === "player" || item.kind === "team")) score += 1.5;
      return { item, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.item);
}

// ---- recent / trending -------------------------------------------------------

const RECENT_KEY = "footiq-recent-searches";

export function recentSearches(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

/** Record a committed search — feeds Recent, local popularity and GA. */
export function recordSearch(query: string): void {
  const q = query.trim();
  if (q.length < 2) return;
  try {
    const list = [q, ...recentSearches().filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* best-effort */
  }
  bump("search", q.toLowerCase());
}

/**
 * Trending = what this device searches most, topped up with dataset heat
 * (form leaders + the market's hottest thread) so the rail is never empty.
 */
export function trendingSearches(): string[] {
  const local = top("search", 4).map((e) => e.key);
  const formLeader = [...players].sort(
    (a, b) => b.form.slice(-3).reduce((x, y) => x + y, 0) - a.form.slice(-3).reduce((x, y) => x + y, 0),
  )[0];
  const seeded = [formLeader?.name ?? "Erling Haaland", "Best XI", teams[0]?.name ?? "Arsenal", "left-footed winger under €30M"];
  const merged: string[] = [];
  for (const s of [...local, ...seeded]) {
    if (!merged.some((m) => m.toLowerCase() === s.toLowerCase())) merged.push(s);
  }
  return merged.slice(0, 6);
}
