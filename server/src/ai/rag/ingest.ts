import type { SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeDoc } from "../../providers/guardian";
import type { Embedder } from "./embed";
import { chunkDoc } from "./chunk";
import { contentHash, validateDocs, type RejectReason } from "./validate";

/**
 * One knowledge sync: fetch → hash → validate → chunk → embed → store → prune.
 *
 * Budget, per run (Workers free plan: 50 subrequests, ~10 ms CPU):
 * Guardian, two "already held?" reads, one embed call, doc upsert, chunk
 * insert, prune — 7 subrequests. MAX_DOCS_PER_RUN keeps the embed payload (and
 * the CPU spent parsing ~50k floats back) small; the 3-hour cron drains
 * anything deferred.
 *
 * Every run looks back a fixed window rather than from the newest held date:
 * the first real run (2026-10-24) deferred 40 articles from the day before,
 * which a "since newest" fetch would never have asked for again. The held-id
 * check makes the overlap free.
 */

export const MAX_DOCS_PER_RUN = 8;
export const RETAIN_DAYS = 90;
const LOOKBACK_DAYS = 3;

export interface IngestDeps {
  db: SupabaseClient;
  fetchDocs: (fromIso: string) => Promise<KnowledgeDoc[]>;
  embed: Embedder;
  now?: Date;
}

export async function ingestKnowledge({ db, fetchDocs, embed, now = new Date() }: IngestDeps): Promise<string> {
  const fromIso = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const fetched = await fetchDocs(fromIso);
  if (fetched.length === 0) return `0 fetched since ${fromIso.slice(0, 10)}`;
  const hashed = await Promise.all(fetched.map(async (d) => ({ ...d, hash: await contentHash(d.body) })));

  const [byId, byHash] = await Promise.all([
    db.from("kb_documents").select("id").in("id", hashed.map((d) => d.id)),
    db.from("kb_documents").select("content_hash").in("content_hash", hashed.map((d) => d.hash)),
  ]);
  if (byId.error || byHash.error) throw new Error(`kb read failed: ${(byId.error ?? byHash.error)!.message}`);
  const { accepted, rejected } = validateDocs(hashed, {
    knownIds: new Set((byId.data ?? []).map((r) => r.id as string)),
    knownHashes: new Set((byHash.data ?? []).map((r) => r.content_hash as string)),
    now,
  });

  const batch = accepted.slice(0, MAX_DOCS_PER_RUN);
  const chunked = batch.map((doc) => ({ doc, chunks: chunkDoc(doc) }));
  const rows = chunked.flatMap(({ doc, chunks }) => chunks.map((text, ord) => ({ doc_id: doc.id, ord, text })));

  if (rows.length > 0) {
    // Embed before writing anything: a failed embed leaves no half-ingested doc.
    const vectors = await embed(rows.map((r) => r.text), "RETRIEVAL_DOCUMENT");
    const docs = await db.from("kb_documents").upsert(
      chunked.map(({ doc, chunks }) => ({
        id: doc.id,
        source: doc.source,
        url: doc.url,
        title: doc.title,
        byline: doc.byline,
        body: doc.body,
        published_at: doc.publishedIso,
        content_hash: doc.hash,
        chunk_count: chunks.length,
      })),
    );
    if (docs.error) throw new Error(`kb doc write failed: ${docs.error.message}`);
    const chunks = await db.from("kb_chunks").insert(rows.map((r, i) => ({ ...r, embedding: JSON.stringify(vectors[i]) })));
    if (chunks.error) {
      // A doc without chunks would read as "already held" forever — undo it so the next run retries.
      await db.from("kb_documents").delete().in("id", batch.map((d) => d.id));
      throw new Error(`kb chunk write failed: ${chunks.error.message}`);
    }
  }

  const cutoff = new Date(now.getTime() - RETAIN_DAYS * 86_400_000).toISOString();
  const pruned = await db.from("kb_documents").delete({ count: "exact" }).eq("pinned", false).lt("published_at", cutoff);
  if (pruned.error) throw new Error(`kb prune failed: ${pruned.error.message}`);

  const reasons = (Object.entries(rejected) as [RejectReason, number][])
    .filter(([, n]) => n > 0)
    .map(([r, n]) => `${r} ${n}`)
    .join(", ");
  const deferred = accepted.length - batch.length;
  return (
    `${fetched.length} fetched → ${batch.length} ingested (${rows.length} chunks)` +
    (deferred ? `, ${deferred} deferred` : "") +
    `; rejected: ${reasons || "none"}; pruned ${pruned.count ?? 0}`
  );
}
