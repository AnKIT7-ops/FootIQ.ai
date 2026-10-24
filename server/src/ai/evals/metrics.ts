/**
 * Retrieval and grounding metrics for the RAG eval (retrieval.test.ts).
 * Pure functions — the offline tests pin their arithmetic, the live run feeds
 * them real retrievals and answers.
 */

export interface RetrievalCase {
  question: string;
  /** The article that answers it; null = nothing in the corpus should (abstention case). */
  expectDocId: string | null;
  /** Optional: a phrase the answering chunk must contain (chunk-level hit, stricter than doc-level). */
  expectChunkContains?: string;
  kind: "lexical" | "paraphrase" | "unanswerable";
}

export interface CaseResult {
  case: RetrievalCase;
  /** Retrieved chunks, best first. */
  hits: { docId: string; text: string }[];
}

export interface RetrievalScore {
  answerable: number;
  hitAt1: number;
  recallAtK: number;
  mrr: number;
  /** Of answerable cases with expectChunkContains: share where a retrieved chunk holds the phrase. */
  chunkHit: number | null;
  unanswerable: number;
  /** Unanswerable cases where nothing cleared the similarity floor. */
  abstention: number | null;
}

/** 1-based rank of the first chunk from the expected doc, or null. */
export function rankOf(hits: { docId: string }[], docId: string): number | null {
  const i = hits.findIndex((h) => h.docId === docId);
  return i < 0 ? null : i + 1;
}

export function scoreRetrieval(results: CaseResult[]): RetrievalScore {
  const answerable = results.filter((r) => r.case.expectDocId !== null);
  const unanswerable = results.filter((r) => r.case.expectDocId === null);
  const ranks = answerable.map((r) => rankOf(r.hits, r.case.expectDocId!));
  const withPhrase = answerable.filter((r) => r.case.expectChunkContains);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    answerable: answerable.length,
    hitAt1: mean(ranks.map((r) => (r === 1 ? 1 : 0))),
    recallAtK: mean(ranks.map((r) => (r !== null ? 1 : 0))),
    mrr: mean(ranks.map((r) => (r !== null ? 1 / r : 0))),
    chunkHit: withPhrase.length
      ? mean(withPhrase.map((r) => (r.hits.some((h) => h.text.toLowerCase().includes(r.case.expectChunkContains!.toLowerCase())) ? 1 : 0)))
      : null,
    unanswerable: unanswerable.length,
    abstention: unanswerable.length ? mean(unanswerable.map((r) => (r.hits.length === 0 ? 1 : 0))) : null,
  };
}

const STOP = new Set(
  "a an the and or but of to in on at for from by with as is are was were be been has have had it its this that these those he she they his her their them who which what when where how than then there after before into over under up down out off so not no".split(
    " ",
  ),
);
const contentTokens = (s: string) =>
  s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1 && !STOP.has(t));

/**
 * Lexical support: the share of a sentence's content words found in the chunk.
 * Deterministic and cheap, so it runs on every answer. It can't see a
 * paraphrase that changes every word — that's what an LLM judge is for, once
 * the quota can afford one.
 */
export function supportScore(sentence: string, chunk: string): number {
  const words = contentTokens(sentence.replace(/\[[\d,\s]+\]/g, ""));
  if (words.length === 0) return 1;
  const pool = new Set(contentTokens(chunk));
  return words.filter((w) => pool.has(w)).length / words.length;
}

export const SUPPORT_THRESHOLD = 0.4;

const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });

/**
 * Grounding of one raw answer (before citations are resolved) against the
 * chunks it was given, numbered 1..n as in the prompt.
 */
export function groundedness(answer: string, chunks: { text: string }[]) {
  let cited = 0;
  let supported = 0;
  let invalidMarkers = 0;
  for (const { segment } of segmenter.segment(answer)) {
    const nums = [...segment.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)].flatMap((m) => m[1].split(",").map((n) => Number(n.trim())));
    if (nums.length === 0) continue;
    cited++;
    const valid = nums.filter((n) => chunks[n - 1]);
    invalidMarkers += nums.length - valid.length;
    if (valid.some((n) => supportScore(segment, chunks[n - 1].text) >= SUPPORT_THRESHOLD)) supported++;
  }
  return { citedSentences: cited, supportedSentences: supported, invalidMarkers };
}
