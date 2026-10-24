import type { Env } from "../../config/env";

/** Matches kb_chunks.embedding vector(768). */
export const EMBED_DIMS = 768;

export type EmbedTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";
export type Embedder = (texts: string[], task: EmbedTask) => Promise<number[][]>;

/**
 * batchEmbedContents takes at most 100 texts per call — and Google meters
 * every text as one request: the free tier's 100/minute is 100 chunks, not
 * 100 calls (found on the first backfill, 2026-10-25).
 */
const BATCH = 100;
/** A per-minute 429 clears when the window rolls over; a daily one doesn't, so only the former is retried. */
const MINUTE_RETRIES = 2;
const MINUTE_WAIT_MS = 61_000;

/**
 * Gemini embeddings via the synchronous batchEmbedContents endpoint — one
 * subrequest per 100 texts, which is what keeps an ingest under the Workers
 * cron budget (the async Batch API has no free tier). Vectors are truncated to
 * 768 dimensions, and Google only normalizes the full 3072, so we L2-normalize
 * here; cosine distance in pgvector then behaves.
 */
export async function embed(
  apiKey: string,
  model: string,
  texts: string[],
  task: EmbedTask,
  // wrapped: a stored bare `fetch` called as a method throws "Illegal invocation" on Workers
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
  wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0, retries = 0; i < texts.length; ) {
    const batch = texts.slice(i, i + BATCH);
    const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:batchEmbedContents`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: batch.map((text) => ({
          model: `models/${model}`,
          content: { parts: [{ text }] },
          taskType: task,
          outputDimensionality: EMBED_DIMS,
        })),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 500);
      if (res.status === 429 && /per minute/i.test(detail) && retries < MINUTE_RETRIES) {
        retries++;
        await wait(MINUTE_WAIT_MS);
        continue;
      }
      throw new Error(`Embedding API error ${res.status}: ${detail}`);
    }
    const body = (await res.json()) as { embeddings?: { values?: number[] }[] };
    if (body.embeddings?.length !== batch.length) {
      throw new Error(`Embedding API returned ${body.embeddings?.length ?? 0} vectors for ${batch.length} texts`);
    }
    for (const e of body.embeddings) {
      if (e.values?.length !== EMBED_DIMS) throw new Error(`Embedding has ${e.values?.length ?? 0} dimensions, expected ${EMBED_DIMS}`);
      out.push(normalize(e.values));
    }
    i += BATCH;
    retries = 0;
  }
  return out;
}

export function normalize(v: number[]): number[] {
  const norm = Math.hypot(...v);
  return norm > 0 ? v.map((x) => x / norm) : v;
}

/** The configured embedder, or null when there's no Gemini key (RAG then switches itself off). */
export function embedderFor(env: Env): Embedder | null {
  const key = env.GEMINI_API_KEY;
  if (!key) return null;
  return (texts, task) => embed(key, env.EMBED_MODEL, texts, task);
}
