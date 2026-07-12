/**
 * Content repository — access point for the generated Intelligence library.
 *
 * Unlike the dataset repositories there is no backend endpoint yet: articles
 * are generated deterministically in the client from the same structured data
 * the backend serves (see src/data/content.ts). When /api/content ships, this
 * module becomes a createRepoStore like the others and no page changes.
 */
import { contentBySlug, contentLibrary, contentKindLabels, weekStamp } from "@/data/content";
import type { ContentArticle, ContentKind, ContentSection, ContentSource } from "@/data/content";

export { contentBySlug, contentLibrary, contentKindLabels, weekStamp };
export type { ContentArticle, ContentKind, ContentSection, ContentSource };

/** Articles that reference a player or team page — powers related-content blocks. */
export function contentAbout(path: string, limit = 4): ContentArticle[] {
  return contentLibrary()
    .filter((a) => a.sources.some((s) => s.path === path))
    .slice(0, limit);
}
