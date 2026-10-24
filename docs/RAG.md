# Retrieval-augmented answers (RAG)

The concierge chat (`POST /api/ai/ask`) answers from two kinds of grounding:

- **FootIQ data:** tables, fixtures, the Poisson forecast and FPL stats. This is measured fact, so it needs no citation.
- **News excerpts retrieved from a knowledge base of Guardian football articles:** every claim taken from them carries a `[n]` citation, which the chat renders as a link to the article.

## Knowledge source and how it is validated

**Source:** the [Guardian Open Platform](https://open-platform.theguardian.com/) content API, used with a free developer key for the `football` section with `type=article`. Liveblogs, galleries and audio are excluded.

**Terms (confirm and fill in before production):**

| Term | What the developer key allows |
|---|---|
| Use | Non-commercial (FootIQ's position on free tiers, see PHASE_5.md) |
| Rate limit | TODO: confirm (believed about 1 call/second, 500 calls/day) |
| Attribution | The chat links every cited article to theguardian.com and names "The Guardian" |
| Storing body text | TODO: confirm. If the terms forbid it, drop `kb_documents.body` and stop the job |

**How bodies are used:** bodies are stored only for retrieval and are never served back. `AiSource` carries the title, link, publisher and date, and nothing else. This is a deliberate, single exception to the RSS rule "we never copy article bodies".

**Validation gate (`server/src/ai/rag/validate.ts`).** Every fetched article is either accepted or counted under the reason it was rejected:

| Reason | Rule |
|---|---|
| `already_held` | The Guardian id is already in `kb_documents` |
| `empty` | The article has no body text |
| `too_short` | The body is under 150 words (stubs and short notices) |
| `too_old` | The article was published more than 30 days ago |
| `boilerplate` | The title matches a templated service page ("How to watch … TV channels & live stream"). The first real fetch on 2026-10-24 turned up 2 of these in 50 articles: long enough to pass the word check, but useless for retrieval |
| `duplicate` | The sha256 of the normalized body matches a stored article (the same text re-published under a new id) |

Every run writes a line like `50 fetched → 8 ingested (52 chunks), 3 deferred; rejected: already_held 31, too_short 8; pruned 0` to `job_runs.detail`. That makes `job_runs` the audit trail for the knowledge source.

## Pipeline

```
sync_knowledge  (own cron "17 */3 * * *", ≈ 7 subrequests)
  Guardian search (newest first, last 3 days; held ids skipped)
  → sha256 → validate → chunk → embed → kb_documents + kb_chunks → prune
/ask
  embed question (RETRIEVAL_QUERY) → match_kb_chunks (HNSW cosine, 20 candidates, floor 0.6) → ≤2 per article → top 6
  → concierge_answer v3 (numbered excerpts) → Gemini → resolveCitations → AiResult.sources
```

**Chunking (`chunk.ts`).** Sentences come from `Intl.Segmenter` and are packed into chunks of about 150 words. Each chunk repeats the last sentence of the previous one, and starts with a header in the form `"{title} ({publisher}, {date}): "`.

**Embeddings (`embed.ts`).** `gemini-embedding-001` through `batchEmbedContents`, which takes up to 100 texts per call. Vectors are 768-dimensional and L2-normalized, which is needed because Google only normalizes the full 3072-dimension output.

**Storage (migration `0006_knowledge.sql`).**
- Tables: `kb_documents` (with a `pinned` flag, `content_hash` unique) and `kb_chunks` (`vector(768)` with an HNSW index).
- RPC: `match_kb_chunks`.
- Both tables are server-only: RLS is on with no policies, and the RPC's EXECUTE is revoked from `anon` and `authenticated`.

**Budgets (Workers free plan).**
- Each run ingests at most 8 documents (`MAX_DOCS_PER_RUN`), which keeps the CPU spent parsing the embed response small.
- The job has its own cron, so it never shares the main tick's 50-subrequest budget.
- Each `/ask` costs one embedding call (about 1,000 per day on the free tier).
- Gemini counts every text in a `batchEmbedContents` call as one request, so the free tier's 100/minute means 100 chunks, not 100 calls. `embed()` waits out a per-minute 429 and fails straight away on a daily one.

**Citations (`citations.ts`).**
- A marker that points at no retrieved chunk is deleted.
- Citations are renumbered 1..m in order of first use.
- Two chunks from the same article share one number.
- Excerpts are labelled as quoted material in the prompt, and the model is told to ignore any instructions inside them.

**Retention.** Unpinned documents older than 90 days are pruned. Pinned documents are the golden set and are never pruned.

## Measuring retrieval

`server/src/ai/evals/retrieval.test.ts`, with its golden set in `retrieval.json`.

1. After the first ingest, choose 15 articles and pin them:
   ```sql
   update kb_documents set pinned = true where id in (...);
   ```
2. For each pinned article, write two questions: one that reuses the article's wording (`lexical`) and one that doesn't (`paraphrase`). Give each its `expectDocId` and, optionally, an `expectChunkContains` phrase. Six `unanswerable` cases are already in the file.
3. Run the eval:
   ```
   cd server
   EVAL_LIVE=1 npx vitest run src/ai/evals/retrieval.test.ts                        # retrieval metrics
   EVAL_LIVE=1 EVAL_ANSWERS=1 npx vitest run src/ai/evals/retrieval.test.ts         # + grounded answers (1 Gemini call per case)
   EVAL_LIVE=1 EVAL_EXPERIMENTS=1 npx vitest run src/ai/evals/retrieval.test.ts     # + chunking comparison
   EVAL_K=10 EVAL_MIN_SIM=0.6 ...                                                    # sweep k and the floor
   ```
   Results are written to `retrieval-results.json`.

**Metrics:**

| Metric | What it measures |
|---|---|
| hit@1 | The right article is the top result |
| recall@k | The right article is anywhere in the top k |
| MRR | The mean of 1/rank of the right article |
| chunk hit | A retrieved chunk contains the expected phrase |
| abstention | For unanswerable questions, nothing clears the similarity floor |
| answer faithfulness | The share of cited sentences that pass lexical support (at least 40% of their content words appear in the cited chunk); `[n]` markers that point at nothing (must be 0); answerable questions answered without a citation; unanswerable questions answered with "FootIQ doesn't hold that" |

**Floor:** recall@k must be at least 0.8. Raise it once a baseline exists.

### Results

**Setup (2026-10-25):**
- The corpus is 48 articles and 308 chunks, published 21–24 Oct 2026.
- The golden set is 15 pinned articles × 2 questions (15 lexical, 15 paraphrase), plus 6 unanswerable questions.
- Five expected phrases also occur in a second article, so those cases have deliberate near-duplicate distractors: two Saka injury stories, two Villa v City pieces, several Manchester United manager stories, and Rice's equaliser, which appears in both the match report and a profile.

**Step 1: the baseline, then a sweep of the similarity floor (k=6, no per-article cap).**

| Floor | hit@1 | recall@6 | MRR | abstention |
|---|---|---|---|---|
| 0.5 (initial guess) | 86.7% | 96.7% | 0.917 | 0% |
| **0.6** | 86.7% | 96.7% | 0.917 | 83.3% |
| 0.65 | 86.7% | 93.3% | 0.900 | 100% |
| 0.7 | 83.3% | 90.0% | 0.867 | 100% |

Lexical questions scored 100% on every metric. All the losses were on paraphrases (hit@1 73.3%). At the 0.5 floor every off-topic question still pulled chunks in: "What is the capital of Australia?" matched a Melbourne derby article at 0.57.

**Step 2: a cap on chunks per article (floor 0.6).**

The one remaining miss was "How many points has Glasner's side collected?" An older article, *Forest's false start*, filled 5 of the 6 slots and pushed out the match report that holds the current total. The title header makes every chunk of an article score almost alike, so one article can crowd out the rest.

| Max chunks per article | hit@1 | recall@6 | MRR | chunk hit |
|---|---|---|---|---|
| no cap | 86.7% | 96.7% | 0.917 | 96.7% |
| 3 | 86.7% | 100% | 0.923 | 93.3% |
| **2 (production)** | 86.7% | **100%** | **0.925** | 93.3% |
| 1 | 86.7% | 100% | 0.928 | 80.0% |

**Production settings:** k=6, floor 0.6, at most 2 chunks per article. The results are recall@6 100%, hit@1 86.7%, MRR 0.925 and abstention 83.3%. Grounded-answer faithfulness (`EVAL_ANSWERS=1`) has not been measured yet.

### Chunking experiments (pinned docs, in memory)

| Setting | hit@1 | recall@k | MRR | chunks |
|---|---|---|---|---|
| 100w + header | — | — | — | — |
| 150w + header (prod) | — | — | — | — |
| 150w, no header | — | — | — | — |
| 300w + header | — | — | — | — |

### Known limits
- **Lexical support is not entailment.** A cited sentence that paraphrases every word fails the check, and a sentence that copies words while reversing their meaning passes it. An LLM judge is the upgrade, once the Gemini quota allows one.
- **The abstention floor is a blunt tool inside one domain.** A football question with no answer in the corpus still lands near football chunks. The model's "doesn't hold" behaviour is the real guard, and EVAL_ANSWERS measures it.
- **The experiment corpus is the pinned documents only.** It has fewer distractors than production, so compare variants with each other, not with the production row.
