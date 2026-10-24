import { describe, expect, it } from "vitest";
import { chunkDoc } from "./chunk";
import { contentHash, validateDocs, type HashedDoc } from "./validate";
import { resolveCitations } from "./citations";
import { ingestKnowledge, MAX_DOCS_PER_RUN } from "./ingest";
import { embed, EMBED_DIMS, type Embedder } from "./embed";
import type { RetrievedChunk } from "./retrieve";
import type { KnowledgeDoc } from "../../providers/guardian";
import { JobRegistry } from "../../jobs/registry";
import { MemoryCache } from "../../cache/memory";
import { createLogger } from "../../lib/logger";

const NOW = new Date("2026-10-20T12:00:00Z");
/** n sentences of exactly ten words each. */
const body = (n: number) => Array.from({ length: n }, (_, i) => `Sentence ${i} has exactly ten words in it for testing.`).join(" ");
const doc = (id: string, sentences = 40, publishedIso = "2026-10-19T15:00:00Z"): KnowledgeDoc => ({
  id,
  source: "The Guardian",
  url: `https://www.theguardian.com/${id}`,
  title: `Title ${id}`,
  byline: null,
  body: `${body(sentences)} About ${id}.`, // unique text per id, or the duplicate check (rightly) fires
  publishedIso,
});

describe("chunkDoc", () => {
  it("packs whole sentences to the target, overlaps one sentence, and heads every chunk", () => {
    const chunks = chunkDoc(doc("a"));
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) expect(c.startsWith("Title a (The Guardian, 2026-10-19): ")).toBe(true);
    const sentencesOf = (c: string) => c.split(": ").slice(1).join(": ").match(/Sentence \d+/g)!;
    for (let i = 1; i < chunks.length; i++) {
      expect(sentencesOf(chunks[i])[0]).toBe(sentencesOf(chunks[i - 1]).at(-1)); // the overlap
    }
    // nothing lost: every sentence lands in some chunk
    const all = new Set(chunks.flatMap(sentencesOf));
    expect(all.size).toBe(40);
    expect(chunks.at(-1)).toContain("About a.");
  });

  it("always moves forward, even when one sentence exceeds the target", () => {
    const long = { ...doc("b"), body: `${"word ".repeat(400).trim()}. Short tail.` };
    const chunks = chunkDoc(long, { targetWords: 50, overlap: 1, header: false });
    expect(chunks.length).toBe(2);
  });
});

describe("validateDocs", () => {
  it("counts every rejection under its reason", async () => {
    const h = async (d: KnowledgeDoc): Promise<HashedDoc> => ({ ...d, hash: await contentHash(d.body) });
    const fresh = await h(doc("fresh"));
    const docs = [
      fresh,
      await h({ ...doc("held"), body: body(41) }),
      await h({ ...doc("empty"), body: "" }),
      await h(doc("stub", 5)),
      await h({ ...doc("old", 50, "2026-08-01T00:00:00Z") }),
      await h({ ...doc("tv"), title: "Premier League today: How to watch Chelsea v Spurs, TV channels & live stream" }),
      { ...doc("republished"), hash: fresh.hash }, // same text, new id
    ];
    const { accepted, rejected } = validateDocs(docs, { knownIds: new Set(["held"]), knownHashes: new Set(), now: NOW });
    expect(accepted.map((d) => d.id)).toEqual(["fresh"]);
    expect(rejected).toEqual({ empty: 1, too_short: 1, too_old: 1, boilerplate: 1, already_held: 1, duplicate: 1 });
  });

  it("hashes normalized text, so whitespace and case don't hide a duplicate", async () => {
    expect(await contentHash("Saka  scored\nTwice")).toBe(await contentHash("saka scored twice"));
  });
});

describe("resolveCitations", () => {
  const chunk = (n: number, url = `https://g/${n}`): RetrievedChunk => ({
    chunkId: n,
    docId: `d${n}`,
    text: "x",
    similarity: 0.8,
    title: `T${n}`,
    url,
    source: "The Guardian",
    publishedIso: "2026-10-19T15:00:00Z",
  });

  it("drops citations to nothing, renumbers by first use, and merges chunks of one article", () => {
    const chunks = [chunk(1), chunk(2), chunk(3, "https://g/2")];
    const { text, sources } = resolveCitations("Saka scored [2]. Rice assisted [3]. Made up [9]. Both [1, 9].", chunks);
    expect(text).toBe("Saka scored [1]. Rice assisted [1]. Made up. Both [2].");
    expect(sources.map((s) => [s.n, s.url])).toEqual([
      [1, "https://g/2"],
      [2, "https://g/1"],
    ]);
  });

  it("returns no sources for an answer without markers", () => {
    expect(resolveCitations("Arsenal are top.", [chunk(1)])).toEqual({ text: "Arsenal are top.", sources: [] });
  });
});

/** Just enough of supabase-js's query builder to run an ingest, counting each round trip. */
function fakeDb(held: { ids?: string[]; hashes?: string[] } = {}) {
  const calls: string[] = [];
  const writes: Record<string, Record<string, unknown>[]> = {};
  const from = (table: string) => {
    let op = "select";
    let cols = "";
    const q = {
      select(c: string) {
        cols = c;
        return q;
      },
      order: () => q,
      limit: () => q,
      eq: () => q,
      lt: () => q,
      in: () => q,
      upsert(rows: Record<string, unknown>[]) {
        op = "upsert";
        writes[table] = rows;
        return q;
      },
      insert(rows: Record<string, unknown>[]) {
        op = "insert";
        writes[table] = rows;
        return q;
      },
      delete() {
        op = "delete";
        return q;
      },
      then(resolve: (r: unknown) => void) {
        calls.push(`${table}:${op}`);
        if (op === "select" && cols === "id") return resolve({ data: (held.ids ?? []).map((id) => ({ id })), error: null });
        if (op === "select" && cols === "content_hash") return resolve({ data: (held.hashes ?? []).map((h) => ({ content_hash: h })), error: null });
        if (op === "delete") return resolve({ count: 0, error: null });
        return resolve({ data: [], error: null });
      },
    };
    return q;
  };
  return { db: { from } as never, calls, writes };
}

function fakeEmbedder() {
  const batches: number[] = [];
  const embed: Embedder = async (texts) => {
    batches.push(texts.length);
    return texts.map(() => Array.from({ length: EMBED_DIMS }, () => 0.01));
  };
  return { embed, batches };
}

describe("ingestKnowledge", () => {
  it("stores valid docs with one vector per chunk, within the cron's subrequest budget", async () => {
    const { db, calls, writes } = fakeDb();
    const { embed, batches } = fakeEmbedder();
    const detail = await ingestKnowledge({ db, embed, now: NOW, fetchDocs: async () => [doc("a"), doc("b"), doc("stub", 3)] });

    expect(detail).toMatch(/^3 fetched → 2 ingested \(\d+ chunks\); rejected: too_short 1; pruned 0$/);
    expect(writes.kb_documents.map((d) => d.id)).toEqual(["a", "b"]);
    const chunks = writes.kb_chunks;
    expect(chunks.length).toBe(writes.kb_documents.reduce((n, d) => n + (d.chunk_count as number), 0));
    expect(JSON.parse(chunks[0].embedding as string)).toHaveLength(EMBED_DIMS);
    // Guardian (1) + embed calls + DB round trips must stay well under 50.
    expect(1 + batches.length + calls.length).toBeLessThanOrEqual(10);
  });

  it("caps a run at MAX_DOCS_PER_RUN and reports the rest as deferred", async () => {
    const { db, writes } = fakeDb();
    const many = Array.from({ length: MAX_DOCS_PER_RUN + 3 }, (_, i) => doc(`d${i}`));
    const detail = await ingestKnowledge({ db, embed: fakeEmbedder().embed, now: NOW, fetchDocs: async () => many });
    expect(writes.kb_documents).toHaveLength(MAX_DOCS_PER_RUN);
    expect(detail).toContain("3 deferred");
  });

  it("writes nothing when every doc is already held", async () => {
    const { db, writes } = fakeDb({ ids: ["a"] });
    const { embed, batches } = fakeEmbedder();
    await ingestKnowledge({ db, embed, now: NOW, fetchDocs: async () => [doc("a")] });
    expect(batches).toHaveLength(0);
    expect(writes.kb_documents).toBeUndefined();
  });
});

describe("embed", () => {
  const ok = (n: number) => new Response(JSON.stringify({ embeddings: Array.from({ length: n }, () => ({ values: Array(EMBED_DIMS).fill(1) })) }));
  const quota = (window: string) => new Response(`{"error":{"message":"Embed content requests ${window} limit exceeded"}}`, { status: 429 });

  it("waits out a per-minute 429 and returns normalized vectors", async () => {
    const replies = [quota("per minute"), ok(2)];
    const waits: number[] = [];
    const vectors = await embed("k", "m", ["a", "b"], "RETRIEVAL_DOCUMENT", async () => replies.shift()!, async (ms) => void waits.push(ms));
    expect(waits).toHaveLength(1);
    expect(vectors).toHaveLength(2);
    expect(Math.hypot(...vectors[0])).toBeCloseTo(1);
  });

  it("fails at once on a daily 429 — waiting a minute won't fix it", async () => {
    const waits: number[] = [];
    await expect(embed("k", "m", ["a"], "RETRIEVAL_QUERY", async () => quota("per day"), async (ms) => void waits.push(ms))).rejects.toThrow(/429/);
    expect(waits).toHaveLength(0);
  });
});

describe("JobRegistry cron routing", () => {
  it("runs a job with its own cron only on that tick, never in the main pass", async () => {
    const ran: string[] = [];
    const registry = new JobRegistry(new MemoryCache(), null, createLogger("error"));
    registry.register({ name: "main", description: "", run: async () => void ran.push("main") });
    registry.register({ name: "kb", description: "", cron: "17 */3 * * *", run: async () => void ran.push("kb") });

    await registry.runCron("*/30 * * * *");
    expect(ran).toEqual(["main"]);
    await registry.runCron("17 */3 * * *");
    expect(ran).toEqual(["main", "kb"]);
  });
});
