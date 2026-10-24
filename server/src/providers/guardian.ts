import { z } from "zod";
import { ProviderError } from "./types";

/**
 * Guardian Open Platform — football articles with full body text, the
 * knowledge source for retrieval (sync_knowledge). Developer keys are free
 * and non-commercial; terms and attribution are recorded in docs/RAG.md.
 * Bodies are stored for retrieval only and never served back: citations show
 * the title and link to theguardian.com.
 *
 * One call per sync: newest first over the ingest's lookback window, so a
 * capped ingest always takes the freshest articles it doesn't hold yet. `type=article` drops
 * liveblogs, galleries and audio, which are poor retrieval units.
 */

export interface KnowledgeDoc {
  id: string;
  source: string;
  url: string;
  title: string;
  byline: string | null;
  body: string;
  publishedIso: string;
}

const RAW = z.object({
  response: z.object({
    status: z.literal("ok"),
    results: z.array(
      z.object({
        id: z.string().min(1),
        webTitle: z.string(),
        webUrl: z.string().url(),
        webPublicationDate: z.string(),
        fields: z.object({ bodyText: z.string().optional(), byline: z.string().optional() }).optional(),
      }),
    ),
  }),
});

export async function fetchGuardianFootball(
  apiKey: string,
  fromIso: string,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): Promise<KnowledgeDoc[]> {
  const params = new URLSearchParams({
    section: "football",
    type: "article",
    "show-fields": "bodyText,byline",
    "order-by": "newest",
    "page-size": "50",
    "from-date": fromIso.slice(0, 10),
    "api-key": apiKey,
  });
  const res = await fetchImpl(`https://content.guardianapis.com/search?${params}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new ProviderError("guardian", `HTTP ${res.status}`, res.status);
  const raw = RAW.safeParse(await res.json());
  if (!raw.success) throw new ProviderError("guardian", `search schema drift: ${raw.error.issues[0]?.message}`);
  return raw.data.response.results.map((r) => ({
    id: r.id,
    source: "The Guardian",
    url: r.webUrl,
    title: r.webTitle,
    byline: r.fields?.byline?.trim() || null,
    body: r.fields?.bodyText?.trim() ?? "",
    publishedIso: r.webPublicationDate,
  }));
}
