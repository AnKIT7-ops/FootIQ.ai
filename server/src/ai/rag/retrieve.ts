import type { SupabaseClient } from "@supabase/supabase-js";
import type { Embedder } from "./embed";

export interface RetrievedChunk {
  chunkId: number;
  docId: string;
  text: string;
  similarity: number;
  title: string;
  url: string;
  source: string;
  publishedIso: string;
}

/**
 * Production retrieval settings, from the retrieval eval's sweeps (2026-10-25,
 * docs/RAG.md). Floor 0.6 abstains on 5/6 off-topic questions without losing
 * an answer (0.65 abstains on all six but drops real ones). maxPerDoc 2 took
 * recall@6 from 96.7% to 100%: uncapped, an older Forest article filled 5 of 6
 * slots and pushed out the match report holding the current points total.
 */
export const RETRIEVAL: RetrievalOptions = { k: 6, minSimilarity: 0.6, maxPerDoc: 2 };

export interface RetrievalOptions {
  k: number;
  minSimilarity: number;
  /**
   * Cap on chunks from one article. The article title heads every chunk, so an
   * article's chunks score almost alike and one article can fill all k slots —
   * crowding out the article that actually answers.
   */
  maxPerDoc: number;
}

/** Top-k chunks for a question by cosine similarity, dropping anything under the floor. */
export async function retrieve(db: SupabaseClient, embed: Embedder, question: string, opts: RetrievalOptions = RETRIEVAL): Promise<RetrievedChunk[]> {
  const [vector] = await embed([question], "RETRIEVAL_QUERY");
  const capped = Number.isFinite(opts.maxPerDoc);
  const { data, error } = await db.rpc("match_kb_chunks", {
    query_embedding: JSON.stringify(vector),
    match_count: capped ? 20 : opts.k, // over-fetch so the cap has candidates to fill with
    min_similarity: opts.minSimilarity,
  });
  if (error) throw new Error(`match_kb_chunks failed: ${error.message}`);
  const perDoc = new Map<string, number>();
  return ((data ?? []) as Record<string, unknown>[])
    .filter((r) => {
      const n = (perDoc.get(String(r.doc_id)) ?? 0) + 1;
      perDoc.set(String(r.doc_id), n);
      return n <= opts.maxPerDoc;
    })
    .slice(0, opts.k)
    .map((r) => ({
    chunkId: Number(r.chunk_id),
    docId: String(r.doc_id),
    text: String(r.text),
    similarity: Number(r.similarity),
    title: String(r.title),
    url: String(r.url),
    source: String(r.source),
    publishedIso: String(r.published_at),
  }));
}
