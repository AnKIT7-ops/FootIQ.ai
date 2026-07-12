/**
 * Slug layer — human-readable, SEO-friendly URLs for every entity.
 *
 * Canonical paths (used by links, canonical meta and the sitemap):
 *   /players/erling-haaland     /teams/arsenal          /managers/mikel-arteta
 *   /matches/arsenal-vs-liverpool  /news/{slug}  /predictions/{match-slug}
 *   /history/{moment-slug}      /intelligence/{article-slug}
 *
 * Legacy id routes (/player/:id, /team/:id, /match/:id, /news/:id) keep
 * working: every resolver accepts a slug OR a raw id. Resolvers scan the
 * live repository arrays on each call (n ≤ 40 per dataset) so hydration can
 * never leave a stale map behind. Pure builders live in slug-builders.ts so
 * the sitemap plugin and content engine share the exact same URL logic.
 */
import { players } from "@/lib/repositories/players";
import { teams } from "@/lib/repositories/teams";
import { matches } from "@/lib/repositories/matches";
import { news } from "@/lib/repositories/news";
import { historicalMoments } from "@/lib/repositories/history";
import type { HistoricalMoment, Match, NewsArticle, Player, Team } from "@/data/types";
import {
  managerSlug,
  matchSlugFor,
  momentSlug,
  newsSlug,
  playerSlug,
  slugify,
  teamSlug,
} from "./slug-builders";

export { slugify, playerSlug, teamSlug, managerSlug, newsSlug, momentSlug };

export const matchSlug = (m: Match): string => matchSlugFor(m, teams);

// ---- canonical path builders (single source for links + canonical + sitemap)

export const playerPath = (p: Player): string => `/players/${playerSlug(p)}`;
export const teamPath = (t: Team): string => `/teams/${teamSlug(t)}`;
export const managerPath = (t: Team): string => `/managers/${managerSlug(t)}`;
export const matchPath = (m: Match): string => `/matches/${matchSlug(m)}`;
export const newsPath = (n: NewsArticle): string => `/news/${newsSlug(n)}`;
export const predictionPath = (m: Match): string => `/predictions/${matchSlug(m)}`;
export const momentPath = (m: HistoricalMoment): string => `/history/${momentSlug(m)}`;

// ---- resolvers (slug or legacy id → entity) --------------------------------

export function resolvePlayer(param: string | undefined): Player | null {
  if (!param) return null;
  return players.find((p) => playerSlug(p) === param) ?? players.find((p) => p.id === param) ?? null;
}

export function resolveTeam(param: string | undefined): Team | null {
  if (!param) return null;
  return teams.find((t) => teamSlug(t) === param) ?? teams.find((t) => t.id === param) ?? null;
}

export function resolveManager(param: string | undefined): Team | null {
  if (!param) return null;
  return teams.find((t) => managerSlug(t) === param) ?? null;
}

export function resolveMatch(param: string | undefined): Match | null {
  if (!param) return null;
  return matches.find((m) => matchSlug(m) === param) ?? matches.find((m) => m.id === param) ?? null;
}

export function resolveNews(param: string | undefined): NewsArticle | null {
  if (!param) return null;
  return news.find((n) => newsSlug(n) === param) ?? news.find((n) => n.id === param) ?? null;
}

export function resolveMoment(param: string | undefined): HistoricalMoment | null {
  if (!param) return null;
  return historicalMoments.find((m) => momentSlug(m) === param) ?? historicalMoments.find((m) => m.id === param) ?? null;
}
