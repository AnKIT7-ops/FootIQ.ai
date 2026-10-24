import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import golden from "./retrieval.json";
import { groundedness, rankOf, scoreRetrieval, supportScore, type CaseResult, type RetrievalCase } from "./metrics";
import { loadEnv } from "../../config/env";
import { createServiceClient } from "../../db/supabase";
import { embedderFor } from "../rag/embed";
import { retrieve, RETRIEVAL, type RetrievedChunk } from "../rag/retrieve";
import { chunkDoc, DEFAULT_CHUNKING, type ChunkOptions } from "../rag/chunk";
import { prompts } from "../prompts";
import { AiService, createAiProvider } from "../service";
import { MemoryCache } from "../../cache/memory";
import { createLogger } from "../../lib/logger";

/**
 * Retrieval eval — does the knowledge base find the right article, and do
 * answers stay inside what it found?
 *
 * Offline (always): the metric arithmetic.
 * Live (EVAL_LIVE=1, keys in server/.env, migration 0006 applied):
 *   1. Production retrieval over the whole kb (RPC + HNSW) → hit@1, recall@k,
 *      MRR, chunk hit, abstention. EVAL_K / EVAL_MIN_SIM override the settings.
 *   2. EVAL_ANSWERS=1 — real /ask generations over the retrieved excerpts →
 *      cited-sentence support, invalid markers, abstention wording. Costs one
 *      Gemini generation per case.
 *   3. EVAL_EXPERIMENTS=1 — re-chunks the pinned docs in memory under each
 *      CHUNKING variant and ranks by cosine, so chunk size and the header can
 *      be compared without touching the live index.
 * Results land in retrieval-results.json for docs/RAG.md.
 */

const cases = golden.cases as RetrievalCase[];

describe("retrieval metrics (offline)", () => {
  const hit = (docId: string, text = "") => ({ docId, text });
  it("scores rank, recall, MRR, chunk hits and abstention", () => {
    const results: CaseResult[] = [
      { case: { question: "q1", expectDocId: "a", expectChunkContains: "header", kind: "lexical" }, hits: [hit("a", "a late Header")] },
      { case: { question: "q2", expectDocId: "b", kind: "paraphrase" }, hits: [hit("x"), hit("b")] },
      { case: { question: "q3", expectDocId: "c", kind: "paraphrase" }, hits: [hit("x")] },
      { case: { question: "q4", expectDocId: null, kind: "unanswerable" }, hits: [] },
      { case: { question: "q5", expectDocId: null, kind: "unanswerable" }, hits: [hit("x")] },
    ];
    expect(rankOf(results[1].hits, "b")).toBe(2);
    expect(scoreRetrieval(results)).toEqual({
      answerable: 3,
      hitAt1: 1 / 3,
      recallAtK: 2 / 3,
      mrr: (1 + 0.5 + 0) / 3,
      chunkHit: 1,
      unanswerable: 2,
      abstention: 0.5,
    });
  });

  it("measures lexical support and flags citations to nothing", () => {
    expect(supportScore("Fixture headed the winner [1].", "Sam Fixture headed the winner in the 88th minute")).toBe(1);
    expect(supportScore("Sample City were relegated.", "Sam Fixture headed the winner")).toBeLessThan(0.4);
    const chunks = [{ text: "Sam Fixture headed the winner in the 88th minute." }];
    expect(groundedness("Fixture headed the winner [1]. Arsenal are top. City collapsed [3].", chunks)).toEqual({
      citedSentences: 2,
      supportedSentences: 1,
      invalidMarkers: 1,
    });
  });
});

const live = process.env.EVAL_LIVE === "1";
if (live) (await import("dotenv")).config();

/** Chunking variants for the in-memory experiment (EVAL_EXPERIMENTS=1). */
const CHUNKING: (ChunkOptions & { label: string })[] = [
  { label: "100w + header", targetWords: 100, overlap: 1, header: true },
  { label: "150w + header (prod)", ...DEFAULT_CHUNKING },
  { label: "150w, no header", targetWords: 150, overlap: 1, header: false },
  { label: "300w + header", targetWords: 300, overlap: 1, header: true },
];

const pct = (x: number | null) => (x === null ? "—" : `${(x * 100).toFixed(1)}%`);
const row = (label: string, s: ReturnType<typeof scoreRetrieval>) => ({
  setting: label,
  "hit@1": pct(s.hitAt1),
  "recall@k": pct(s.recallAtK),
  MRR: s.mrr.toFixed(3),
  "chunk hit": pct(s.chunkHit),
  abstention: pct(s.abstention),
});

describe.runIf(live)("retrieval eval (live)", () => {
  const env = loadEnv(process.env);
  const db = createServiceClient(env);
  const embed = embedderFor(env);
  const settings = {
    k: Number(process.env.EVAL_K ?? RETRIEVAL.k),
    minSimilarity: Number(process.env.EVAL_MIN_SIM ?? RETRIEVAL.minSimilarity),
    maxPerDoc: Number(process.env.EVAL_MAX_PER_DOC ?? RETRIEVAL.maxPerDoc),
  };
  const report: Record<string, unknown> = { at: new Date().toISOString(), settings, cases: cases.length };
  const save = () => writeFileSync(new URL("./retrieval-results.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
  const retrieved = new Map<string, RetrievedChunk[]>();

  it("finds the answering article", async () => {
    expect(db, "SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY").toBeTruthy();
    expect(embed, "GEMINI_API_KEY").toBeTruthy();
    const results: CaseResult[] = [];
    for (const c of cases) {
      const chunks = await retrieve(db!, embed!, c.question, settings);
      retrieved.set(c.question, chunks);
      results.push({ case: c, hits: chunks });
    }
    const score = scoreRetrieval(results);
    const byKind = (k: RetrievalCase["kind"]) => scoreRetrieval(results.filter((r) => r.case.kind === k));
    console.table([row(`all (k=${settings.k}, floor=${settings.minSimilarity})`, score), row("lexical", byKind("lexical")), row("paraphrase", byKind("paraphrase"))]);
    const misses = results.filter((r) => r.case.expectDocId && rankOf(r.hits, r.case.expectDocId) === null);
    if (misses.length) console.log("misses:", misses.map((m) => ({ q: m.case.question, got: m.hits.slice(0, 3).map((h) => h.docId) })));
    report.retrieval = { all: score, lexical: byKind("lexical"), paraphrase: byKind("paraphrase"), misses: misses.map((m) => m.case.question) };
    save();
    // Floors: raise them as the baseline improves (docs/RAG.md).
    if (score.answerable > 0) expect(score.recallAtK).toBeGreaterThanOrEqual(0.8);
  }, 300_000);

  it.runIf(process.env.EVAL_ANSWERS === "1")("answers stay inside the excerpts", async () => {
    const ai = new AiService(createAiProvider(env, createLogger("error")), new MemoryCache(), createLogger("error"));
    let cited = 0, supported = 0, invalid = 0, answerableWithoutCitation = 0, abstained = 0, unanswerable = 0;
    for (const c of cases) {
      const sources = retrieved.get(c.question) ?? [];
      // No tables or players: this measures the excerpts alone.
      const { text } = await ai.run(prompts.concierge_answer({ question: c.question, teams: [], upcoming: [], players: [], sources }), { bypassCache: true });
      const g = groundedness(text, sources);
      cited += g.citedSentences;
      supported += g.supportedSentences;
      invalid += g.invalidMarkers;
      if (c.expectDocId === null) {
        unanswerable++;
        if (/doesn.?t hold|does not hold|don.?t hold/i.test(text)) abstained++;
      } else if (g.citedSentences === 0) answerableWithoutCitation++;
    }
    const faithfulness = {
      citedSentences: cited,
      supported: pct(cited ? supported / cited : null),
      invalidMarkers: invalid,
      answerableWithoutCitation,
      abstainedWhenUnanswerable: pct(unanswerable ? abstained / unanswerable : null),
    };
    console.table([faithfulness]);
    report.faithfulness = faithfulness;
    save();
    expect(invalid).toBe(0);
  }, 600_000);

  it.runIf(process.env.EVAL_EXPERIMENTS === "1")("compares chunking settings on the pinned docs", async () => {
    const { data, error } = await db!.from("kb_documents").select("id, title, source, published_at, body").eq("pinned", true);
    expect(error).toBeNull();
    const docs = (data ?? []).map((d) => ({ id: d.id as string, title: d.title as string, source: d.source as string, publishedIso: d.published_at as string, body: d.body as string }));
    expect(docs.length, "pin the golden docs first").toBeGreaterThan(0);
    const questions = await embed!(cases.map((c) => c.question), "RETRIEVAL_QUERY");
    const rows = [];
    for (const variant of CHUNKING) {
      const chunks = docs.flatMap((d) => chunkDoc(d, variant).map((text) => ({ docId: d.id, text })));
      const vectors = await embed!(chunks.map((c) => c.text), "RETRIEVAL_DOCUMENT");
      const results: CaseResult[] = cases.map((c, i) => ({
        case: c,
        hits: chunks
          .map((ch, j) => ({ ...ch, sim: dot(questions[i], vectors[j]) }))
          .filter((h) => h.sim >= settings.minSimilarity)
          .sort((a, b) => b.sim - a.sim)
          .slice(0, settings.k),
      }));
      rows.push({ ...row(variant.label, scoreRetrieval(results)), chunks: chunks.length });
    }
    console.table(rows);
    report.experiments = { corpus: `${docs.length} pinned docs`, rows };
    save();
  }, 600_000);
});

/** Vectors are L2-normalized, so the dot product is the cosine. */
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
