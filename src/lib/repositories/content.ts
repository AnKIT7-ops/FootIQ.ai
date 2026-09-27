/**
 * Content repository — access point for the generated Intelligence library.
 *
 * Unlike the dataset repositories there is no backend endpoint yet: articles
 * are generated deterministically in the client from the same structured data
 * the backend serves (see src/data/content.ts). When /api/content ships, this
 * module becomes a createRepoStore like the others and no page changes.
 *
 * The generator only knows the bundled demo dataset, so on live data its
 * articles contradict the real table ("1st, 69 pts" for a side that is 2nd on
 * 12). Until it is rebuilt on live data the library exists in demo mode only:
 * every reader (pages, search, notifications) goes through the gate below.
 */
import { contentBySlug as demoBySlug, contentLibrary as demoLibrary, contentKindLabels, weekStamp } from "@/data/content";
import type { ContentArticle, ContentKind, ContentSection, ContentSource } from "@/data/content";
import { demoContentAllowed } from "@/lib/freshness";

export { contentKindLabels, weekStamp };
export type { ContentArticle, ContentKind, ContentSection, ContentSource };

export const contentLibrary = (): ContentArticle[] => (demoContentAllowed() ? demoLibrary() : []);

export const contentBySlug = (slug: string): ContentArticle | undefined =>
  demoContentAllowed() ? demoBySlug(slug) : undefined;

/** Articles that reference a player or team page — powers related-content blocks. */
export function contentAbout(path: string, limit = 4): ContentArticle[] {
  return contentLibrary()
    .filter((a) => a.sources.some((s) => s.path === path))
    .slice(0, limit);
}
