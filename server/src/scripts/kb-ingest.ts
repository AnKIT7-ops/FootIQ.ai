import "dotenv/config";
import { loadEnv } from "../config/env";
import { createServiceClient } from "../db/supabase";
import { embedderFor } from "../ai/rag/embed";
import { fetchGuardianFootball } from "../providers/guardian";
import { ingestKnowledge } from "../ai/rag/ingest";
import { contentHash, validateDocs, wordCount } from "../ai/rag/validate";
import { chunkDoc } from "../ai/rag/chunk";
import { retrieve, RETRIEVAL } from "../ai/rag/retrieve";

/**
 * Run sync_knowledge once from a dev machine (the admin trigger needs an
 * admin JWT, which nothing issues yet). Reads server/.env.
 *   npm run kb:ingest -- --dry   fetch + validate + chunk only: no embeddings, no writes
 *   npm run kb:ingest            the real job, against the configured Supabase
 *   npm run kb:ingest -- --search "who scored for Arsenal?"
 *                                what retrieval returns (doc id, similarity, title) —
 *                                for writing the golden set in evals/retrieval.json
 */

const env = loadEnv(process.env);
const key = env.GUARDIAN_API_KEY;
if (!key) {
  console.error("GUARDIAN_API_KEY is not set in server/.env");
  process.exit(1);
}

if (process.argv.includes("--dry")) {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const docs = await fetchGuardianFootball(key, since);
  const hashed = await Promise.all(docs.map(async (d) => ({ ...d, hash: await contentHash(d.body) })));
  const { accepted, rejected } = validateDocs(hashed, { knownIds: new Set(), knownHashes: new Set(), now: new Date() });
  console.log(`${docs.length} fetched since ${since.slice(0, 10)}; ${accepted.length} pass validation; rejected:`, rejected);
  console.log(`chunks per accepted doc: ${accepted.map((d) => chunkDoc(d).length).join(", ")}`);
  for (const d of accepted.slice(0, 8)) console.log(`- ${d.publishedIso.slice(0, 10)}  ${d.title}  (${wordCount(d.body)} words)`);
} else {
  const db = createServiceClient(env);
  const embed = embedderFor(env);
  if (!db || !embed) {
    const missing = (["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "GEMINI_API_KEY"] as const).filter((k) => !env[k]);
    console.error(`Missing in server/.env: ${missing.join(", ")}`);
    process.exit(1);
  }
  const q = process.argv.indexOf("--search");
  if (q > 0) {
    const hits = await retrieve(db, embed, process.argv[q + 1] ?? "", { ...RETRIEVAL, minSimilarity: 0 });
    for (const h of hits) {
      const floor = h.similarity >= RETRIEVAL.minSimilarity ? " " : "×"; // × = below the production floor
      console.log(`${floor} ${h.similarity.toFixed(3)}  ${h.docId}\n          ${h.text.slice(h.text.indexOf("): ") + 3, 160)}…`);
    }
  } else {
    console.log(await ingestKnowledge({ db, embed, fetchDocs: (from) => fetchGuardianFootball(key, from) }));
  }
}
