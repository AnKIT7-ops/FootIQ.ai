import { useEffect } from "react";

/** Canonical origin for absolute URLs (OG, canonical). Set by VITE_SITE_URL at build time (vite.config.ts requires it). */
export const SITE_URL: string = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") ?? window.location.origin;

export const SITE_NAME = "FootIQ";
const DEFAULT_DESCRIPTION =
  "FootIQ is the AI intelligence layer for football — match predictions, natural-language scouting, tactical analysis and transfer probabilities, algorithmically generated and clearly marked apart from verified fact.";

export interface Crumb {
  name: string;
  path: string;
}

interface PageMeta {
  /** Page title without the site suffix. */
  title: string;
  description?: string;
  /** Path for the canonical URL, e.g. "/predictions". Defaults to current pathname. */
  path?: string;
  /** Set true on pages that should not be indexed (profile, 404). */
  noIndex?: boolean;
  /** OG type — "article" adds article:published_time when publishedAt is set. */
  type?: "website" | "article" | "profile";
  /** Absolute or site-relative OG image. Defaults to /og.png. */
  image?: string;
  /** ISO date for article OG + JSON-LD datePublished. */
  publishedAt?: string;
  /** Structured data blocks; BreadcrumbList is added automatically from breadcrumbs. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** Breadcrumb trail (Home is implied first) — emitted as BreadcrumbList JSON-LD. */
  breadcrumbs?: Crumb[];
}

function upsertMeta(attr: "name" | "property", key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function removeMeta(attr: "name" | "property", key: string): void {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

function upsertLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

const abs = (pathOrUrl: string): string => (pathOrUrl.startsWith("http") ? pathOrUrl : `${SITE_URL}${pathOrUrl}`);

/** BreadcrumbList structured data from a trail (Home prepended). */
export function breadcrumbJsonLd(crumbs: Crumb[]): Record<string, unknown> {
  const trail = [{ name: "Home", path: "/" }, ...crumbs];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: abs(c.path),
    })),
  };
}

/** Apply document metadata for the current page (title, description, canonical, OG/Twitter, JSON-LD). */
export function applyPageMeta({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  noIndex = false,
  type = "website",
  image,
  publishedAt,
  jsonLd,
  breadcrumbs,
}: PageMeta): void {
  const fullTitle = `${title} · ${SITE_NAME}`;
  const url = `${SITE_URL}${path ?? window.location.pathname}`;
  const ogImage = abs(image ?? "/og.png");

  document.title = fullTitle;
  upsertMeta("name", "description", description);
  upsertMeta("name", "robots", noIndex ? "noindex, nofollow" : "index, follow");
  upsertLink("canonical", url);

  upsertMeta("property", "og:title", fullTitle);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:url", url);
  upsertMeta("property", "og:type", type);
  upsertMeta("property", "og:site_name", SITE_NAME);
  upsertMeta("property", "og:image", ogImage);
  if (type === "article" && publishedAt) upsertMeta("property", "article:published_time", publishedAt);
  else removeMeta("property", "article:published_time");

  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", fullTitle);
  upsertMeta("name", "twitter:description", description);
  upsertMeta("name", "twitter:image", ogImage);

  // one managed JSON-LD script per page — replaced wholesale on navigation
  const blocks: Record<string, unknown>[] = [
    ...(jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : []),
    ...(breadcrumbs?.length ? [breadcrumbJsonLd(breadcrumbs)] : []),
  ];
  document.getElementById("footiq-jsonld")?.remove();
  if (blocks.length) {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "footiq-jsonld";
    script.textContent = JSON.stringify(blocks.length === 1 ? blocks[0] : blocks);
    document.head.appendChild(script);
  }
}

/** Per-page metadata hook — call once at the top of every routed page. */
export function usePageMeta(meta: PageMeta): void {
  useEffect(() => {
    applyPageMeta(meta);
    // page identity is captured by title+path; objects (jsonLd/breadcrumbs) change with them
  }, [meta.title, meta.description, meta.path, meta.noIndex, meta.type, meta.image, meta.publishedAt]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ---- JSON-LD builders for the entity pages ---------------------------------

export function personJsonLd(p: { name: string; role: string }, opts: { teamName: string; path: string }): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: p.name,
    url: abs(opts.path),
    jobTitle: `Footballer — ${p.role}`,
    memberOf: { "@type": "SportsTeam", name: opts.teamName },
  };
}

export function sportsTeamJsonLd(t: { name: string; stadium: string; manager: string; league: string }, path: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name: t.name,
    sport: "Soccer",
    url: abs(path),
    location: { "@type": "Place", name: t.stadium },
    coach: { "@type": "Person", name: t.manager },
    memberOf: { "@type": "SportsOrganization", name: t.league },
  };
}

/** `kickoffIso` must be ISO 8601 — schema.org startDate rejects display strings like "Sat 15:00". */
export function sportsEventJsonLd(opts: { home: string; away: string; kickoffIso: string; venue: string; path: string }): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${opts.home} vs ${opts.away}`,
    sport: "Soccer",
    startDate: opts.kickoffIso,
    location: { "@type": "Place", name: opts.venue },
    homeTeam: { "@type": "SportsTeam", name: opts.home },
    awayTeam: { "@type": "SportsTeam", name: opts.away },
    url: abs(opts.path),
  };
}

export function articleJsonLd(opts: { headline: string; description: string; path: string; publishedAt: string; aiGenerated?: boolean }): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.headline.slice(0, 110),
    description: opts.description,
    url: abs(opts.path),
    datePublished: opts.publishedAt,
    image: abs("/og.png"),
    author: { "@type": "Organization", name: opts.aiGenerated ? `${SITE_NAME} Intelligence Engine` : SITE_NAME, url: SITE_URL },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
}
