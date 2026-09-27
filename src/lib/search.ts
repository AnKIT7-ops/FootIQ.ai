import { players } from "@/lib/repositories/players";
import { teams, teamById } from "@/lib/repositories/teams";
import type { Player } from "@/data/types";
import { contentLibrary, contentKindLabels } from "@/lib/repositories/content";
import { legalEntries, pageEntries, type NavEntry } from "@/lib/nav";
import { managerPathFor, playerPathFor, teamPathFor } from "@/lib/slug-builders";
import { bump, top } from "@/lib/metrics";
import { track } from "@/lib/analytics";

export interface SearchItem {
  id: string;
  kind: "player" | "team" | "manager" | "page" | "news" | "intel" | "action";
  label: string;
  sub: string;
  to: string;
  keywords: string;
}

// Players load from the API after this module does, so their entries are
// rebuilt whenever the repository swaps in a new list.
let indexedPlayers: Player[] | null = null;
let playerItems: SearchItem[] = [];
function currentPlayerItems(): SearchItem[] {
  if (indexedPlayers !== players) {
    indexedPlayers = players;
    playerItems = players.map((p) => ({
      id: `player-${p.id}`,
      kind: "player" as const,
      label: p.name,
      sub: `${p.role} · ${teamById.get(p.teamId)?.short ?? ""}`,
      to: playerPathFor(p),
      keywords: `${p.name} ${p.role} ${p.position} ${teamById.get(p.teamId)?.name ?? ""}`.toLowerCase(),
    }));
  }
  return playerItems;
}

const pageItem = (p: NavEntry): SearchItem => ({
  id: `page-${p.to}`,
  kind: "page",
  label: p.label,
  sub: p.sub,
  to: p.to,
  keywords: `${p.label} ${p.keywords}`.toLowerCase(),
});

export const searchIndex: SearchItem[] = [
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
  ...[...pageEntries, ...legalEntries].filter((p) => p.to !== "/intelligence").map(pageItem),
  // Demo news articles are retired (invented quotes about real people); real
  // headlines live on /news and link out, so they aren't indexed here.
];

/**
 * Intelligence reports exist in demo mode only (see repositories/content.ts),
 * and the mode is settled after this module loads — so they're gated per
 * query, along with the /intelligence page entry, instead of baked in above.
 */
function currentIntelItems(): SearchItem[] {
  const library = contentLibrary();
  if (!library.length) return [];
  return [
    ...pageEntries.filter((p) => p.to === "/intelligence").map(pageItem),
    ...library.map((a) => ({
      id: `intel-${a.slug}`,
      kind: "intel" as const,
      label: a.title.length > 64 ? a.title.slice(0, 61) + "…" : a.title,
      sub: `Intelligence · ${contentKindLabels[a.kind]}`,
      to: `/intelligence/${a.slug}`,
      keywords: `${a.title} ${a.tags.join(" ")} ${a.kind}`.toLowerCase(),
    })),
  ];
}

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
  return [...currentPlayerItems(), ...searchIndex, ...currentIntelItems()]
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
  track("search_used", { query_length: q.length });
}

/**
 * Trending = what this device searches most, topped up with dataset heat
 * (form leaders + the market's hottest thread) so the rail is never empty.
 */
export function trendingSearches(): string[] {
  const local = top("search", 4).map((e) => e.key);
  const formLeader = [...players].sort((a, b) => b.fantasy.form - a.fantasy.form)[0];
  const seeded = [formLeader?.name, "Fantasy", teams[0]?.name ?? "Arsenal", "young midfielder who creates chances"].filter(
    (s): s is string => Boolean(s),
  );
  const merged: string[] = [];
  for (const s of [...local, ...seeded]) {
    if (!merged.some((m) => m.toLowerCase() === s.toLowerCase())) merged.push(s);
  }
  return merged.slice(0, 6);
}
