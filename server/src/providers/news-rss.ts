import type { NewsHeadline } from "../../../shared/contracts";

/**
 * Real football headlines from publishers' public RSS feeds — free, current,
 * and meant for exactly this: headline + the publisher's own summary + a link
 * back. We never copy article bodies.
 *
 * Parsed with regexes rather than an XML library: RSS items are flat, and
 * Workers has no DOMParser. ponytail: regex RSS parsing; swap for a real XML
 * parser if a feed starts nesting elements we care about.
 */

export const FEEDS: { source: NewsHeadline["source"]; url: string; keep?: (link: string) => boolean }[] = [
  { source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/football/rss.xml" },
  { source: "The Guardian", url: "https://www.theguardian.com/football/rss" },
  // Sky's football feed also carries tennis/cricket; keep football URLs only.
  { source: "Sky Sports", url: "https://www.skysports.com/rss/12040", keep: (link) => link.includes("/football/") },
];

const MAX_ITEMS = 80;
const SUMMARY_MAX = 280;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Text content of the first <tag>…</tag>, CDATA unwrapped, entities decoded. */
function field(item: string, tag: string): string {
  const m = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return "";
  const raw = m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
  return decode(raw).trim();
}

/** Plain text from a summary that may be HTML (the Guardian's is): first paragraph only. */
export function plainSummary(html: string): string {
  const firstPara = html.match(/<p>([\s\S]*?)<\/p>/i)?.[1] ?? html;
  const text = decode(firstPara.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  return text.length > SUMMARY_MAX ? `${text.slice(0, SUMMARY_MAX - 1).replace(/\s+\S*$/, "")}…` : text;
}

export function categorize(title: string, summary: string): NewsHeadline["category"] {
  const t = `${title} ${summary}`.toLowerCase();
  // Whole words only: a bare "fee" matched "feel", "scan" matched "scandal".
  if (/\b(injury|injuries|injured|ruled out|hamstring|surgery|knee injury|ankle|groin|sidelined|fitness doubt)\b/.test(t)) return "Injuries";
  if (/\b(transfers?|sign(s|ed|ing)?|loan(ed)?|bid|fee|joins?|joined|release clause|new deal|new contract|swoop|linked with|gossip|done deals?|agree terms)\b/.test(t)) return "Transfers";
  if (/\b\d{1,2}-\d{1,2}\b|\b(beat|beats|draw with|thrash(es)?|win at|win over|defeat|match report)\b/.test(t)) return "Results";
  return "News";
}

/**
 * RFC-822 dates with a zone abbreviation. JS parses "GMT" but not "BST" —
 * Sky dates every item in BST, so without this all of them were dropped.
 */
const ZONES: Record<string, string> = { BST: "+0100", CET: "+0100", CEST: "+0200", IST: "+0100", UTC: "+0000", GMT: "+0000" };
export function parseRssDate(raw: string): Date {
  return new Date(raw.trim().replace(/\b([A-Z]{3,4})$/, (z) => ZONES[z] ?? z));
}

/** FNV-1a — stable short id from the URL, no crypto needed. */
function hashId(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function parseFeed(xml: string, source: NewsHeadline["source"], keep?: (link: string) => boolean): NewsHeadline[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const out: NewsHeadline[] = [];
  for (const item of items) {
    const title = field(item, "title");
    // Strip tracking params ("?at_medium=RSS…") so the same story dedupes across refreshes.
    const url = field(item, "link").replace(/\?at_medium=[^#]*/, "");
    const published = parseRssDate(field(item, "pubDate"));
    if (!title || !/^https:\/\//.test(url) || Number.isNaN(published.getTime())) continue;
    if (keep && !keep(url)) continue;
    const summary = plainSummary(field(item, "description"));
    const imageUrl =
      item.match(/<media:thumbnail[^>]*\burl="([^"]+)"/)?.[1] ??
      item.match(/<media:content[^>]*\burl="([^"]+)"/)?.[1] ??
      item.match(/<enclosure[^>]*\burl="([^"]+)"/)?.[1];
    out.push({
      id: hashId(url),
      title,
      summary,
      url,
      source,
      publishedIso: published.toISOString(),
      ...(imageUrl && /^https:\/\//.test(imageUrl) ? { imageUrl: decode(imageUrl) } : {}),
      category: categorize(title, summary),
    });
  }
  return out;
}

/**
 * Fetch every feed; one failing feed never blanks the others. Throws only when
 * all fail, so the job records the outage and the last snapshot stands.
 */
export async function fetchHeadlines(fetchImpl: typeof fetch = (i, init) => fetch(i, init)): Promise<NewsHeadline[]> {
  const results = await Promise.allSettled(
    FEEDS.map(async (f) => {
      const res = await fetchImpl(f.url, {
        headers: { "User-Agent": "FootIQ/1.0 (+https://footiq-omega.vercel.app)", Accept: "application/rss+xml, application/xml" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`${f.source} HTTP ${res.status}`);
      return parseFeed(await res.text(), f.source, f.keep);
    }),
  );
  const ok = results.filter((r): r is PromiseFulfilledResult<NewsHeadline[]> => r.status === "fulfilled");
  if (ok.length === 0) {
    const reasons = results.map((r) => (r.status === "rejected" ? String(r.reason) : "")).join("; ");
    throw new Error(`all news feeds failed — ${reasons}`);
  }
  const seen = new Set<string>();
  return ok
    .flatMap((r) => r.value)
    .filter((h) => (seen.has(h.id) ? false : (seen.add(h.id), true)))
    .sort((a, b) => b.publishedIso.localeCompare(a.publishedIso))
    .slice(0, MAX_ITEMS);
}
