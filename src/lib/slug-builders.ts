/**
 * Pure slug/path builders — no repository imports, no import.meta, so the
 * sitemap plugin (vite.config), the content engine (src/data) and the server
 * can all use the exact same URL logic the app renders with.
 */
import type { HistoricalMoment, Match, NewsArticle, Player, Team } from "../data/types";

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // fold combining accents: Ødegaard → Odegaard
    .replace(/[øØ]/g, "o")
    .replace(/[æÆ]/g, "ae")
    .replace(/[ßẞ]/g, "ss")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const playerSlug = (p: Player): string => slugify(p.name);
export const teamSlug = (t: Team): string => slugify(t.name);
export const managerSlug = (t: Team): string => slugify(t.manager);
export const newsSlug = (n: NewsArticle): string => slugify(n.title).slice(0, 72).replace(/-+$/, "");
export const momentSlug = (m: HistoricalMoment): string => slugify(m.title);

/** Fixture pairs are unique in the dataset; falls back to the raw id if a side is unknown. */
export function matchSlugFor(m: Match, teams: Team[]): string {
  const home = teams.find((t) => t.id === m.homeId);
  const away = teams.find((t) => t.id === m.awayId);
  return home && away ? `${slugify(home.name)}-vs-${slugify(away.name)}` : m.id;
}

export const playerPathFor = (p: Player): string => `/players/${playerSlug(p)}`;
export const teamPathFor = (t: Team): string => `/teams/${teamSlug(t)}`;
export const managerPathFor = (t: Team): string => `/managers/${managerSlug(t)}`;
export const newsPathFor = (n: NewsArticle): string => `/news/${newsSlug(n)}`;
export const momentPathFor = (m: HistoricalMoment): string => `/history/${momentSlug(m)}`;
export const matchPathFor = (m: Match, teams: Team[]): string => `/matches/${matchSlugFor(m, teams)}`;
export const predictionPathFor = (m: Match, teams: Team[]): string => `/predictions/${matchSlugFor(m, teams)}`;
