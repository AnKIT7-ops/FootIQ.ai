# AI Integrity — Chunk 1 Design

Date: 2026-07-16
Status: awaiting review

## Why this exists

A 15-priority brief (personalization engine, AI memory, knowledge graph, semantic
search, copilot, MLOps, dashboards) arrived on the premise that FootIQ "is now an
AI-native platform with real users." Two facts contradict the premise:

1. **There are no real users** — a handful of testers.
2. **There is no AI in production** — no `ANTHROPIC_API_KEY`, so `createAiProvider`
   falls back to `MockAiProvider` on every request.

A recommendation engine with no interaction history is a cold-start heuristic in a
costume, and `server/src/services/recommend.ts` already does that job with
transparent, self-explaining feature scoring. MLOps for prompts that change monthly
is a text file. Those priorities are infrastructure for a scale that does not exist.

While confirming that, a live integrity defect surfaced. It outranks the entire brief.

## The defect

`shared/contracts.ts` `AiResult` has **no confidence field**. No model has ever
reported a confidence number in FootIQ. Every number users see is a literal:

```ts
confidence: 82,                            // src/data/content.ts:446
confidence: 74 + Math.round(rand() * 12),  // src/data/content.ts:239
confidence: 78 + Math.round(rand() * 10),  // src/data/content.ts:397
```

`AIMeta` renders these as a filled progress bar, `Confidence 82%`, an
`aria-label="Confidence 82 percent"`, a "Based on:" source list, and the sentence
*"Model inference from structured performance data."*

The field is documented as derived, which is how it survived review:

```ts
/** Model confidence 0–100, derived from the underlying data. */  // content.ts:83
```

CLAUDE.md states the rule as non-negotiable: *"Every AI output renders inside
IQInsight/IQTag with AIMeta (confidence, date, sources). Never dress a guess as a
fact."* The component built to enforce honesty is the one manufacturing the
dishonesty. `Math.round(rand() * 12)` rendered in amber is still `rand()`.

Nobody has been misled yet — that is precisely why now is the cheap time to fix it.
Build the brief first and 15 new systems inherit a fake number; the brief's own
Priority 12 would then measure "confidence calibration" against a random number
generator.

Mitigating, in fairness: `MockAiProvider` labels its own output *"(demo engine)"*
and says "once real AI providers are configured." The mock is honest about itself.
The frontend is not.

## Decision

**Delete the confidence number.** Chosen over two alternatives:

- *Make it real* (model emits it in a structured field) — requires all 7 prompts to
  return JSON, all 5 providers to parse and validate it, plus a fallback path. And
  self-reported LLM confidence is weakly calibrated: a real number, still not a
  trustworthy one.
- *Derive it from data* (sample size, freshness, source reliability) — honest inputs,
  but the weighting would be invented and then defended forever. A made-up formula
  over real inputs is still made up.

Deleting matches the product's own principle — *"Confidence beats certainty. A number
the user can trace is worth more than a number that sounds impressive."* A number that
cannot be traced should not render. AIMeta keeps generation date, sources, and the
disclaimer — all three are true.

## Scope

### Part A — remove fabricated confidence (no blockers)

| File | Change |
|---|---|
| `src/components/ui/AIMeta.tsx` | Drop `confidence` prop, `level` calc, bar markup, `aria-label`. Keep date, sources, disclaimer, `FeedbackWidget`. |
| `src/pages/IntelligenceArticle.tsx:100` | Stop passing `confidence`. |
| `src/pages/PredictionDetail.tsx:155` | Stop passing `confidence`. |
| `src/data/content.ts` | Delete `ContentArticle.confidence` field + lying doc comment + ~12 literals (`:186 :239 :291 :346 :397 :446 :486 :526 :582 :635`). |
| `src/data/types.ts:214` | Delete `Prediction.confidence` — dead once PredictionDetail stops passing it. |
| `src/data/predictions.ts` | Delete the 6 `confidence:` seed literals. |

Two distinct cases, same fix:
- `ContentArticle.confidence` — pure fabrication. Gone permanently.
- `Prediction.confidence` — demo seed data. The Poisson/Elo engine (TECH_DEBT #22)
  may legitimately emit a confidence; its spec reintroduces the field with a real
  derivation. Deleting now keeps the type honest in the meantime.

Note `content.ts:346` (`Math.round(r.probability * 0.6 + r.reliability * 8)`) is the
one case computed from inputs — but the weights are invented and the inputs are demo.
It goes with the rest.

**Verification:** `npx tsc --noEmit` catches every missed call site (the field is
typed, so deletion is compiler-guided). Then `npm run verify` for the route-wide
screenshot + console-error + overflow sweep.

### Part B — "Demo engine" badge (approved 2026-07-16)

**Premise correction found while scoping.** The frontend never calls the AI backend.
`src/lib/api/client.ts` exposes only `get/post/put/patch/delete` — no AI methods.
`Scout.tsx` filters the `players` repository client-side; `ChatDock` imports the
scripted `concierge` keyword ladder. Nothing in `src/` reaches `/api/ai/*`.

Consequences:
- The AI route surface (7 endpoints, prompt registry, A/B variants, quota, evals) has
  never been invoked by the product. It is exercised only by tests.
- `MockAiProvider` is not serving users — it is unreachable from the UI.
- **A badge keyed on `AiResult.provider === "mock"` would badge nothing**, because no
  `AiResult` reaches the frontend.

Everything wearing amber today is client-generated: `content.ts` articles are
deterministic templates, the concierge is keyword matching, Scout's insight is local
filtering. No model has produced a word any user has read.

**Design.** The honest question per surface is "did a real model produce this?" —
false when client-generated, false when the provider is `mock`, true otherwise. One
optional prop on `AIMeta`:

```ts
AIMeta({ provider }: { provider?: string })
  provider === undefined   → "Demo engine" badge   // client-generated
  provider === "mock"      → "Demo engine" badge   // server, no key configured
  "claude" | "openai" | …  → no badge; show model name
```

The badge disappears automatically when a real provider is configured — no frontend
change required at swap time.

**Reuse, do not invent.** `src/lib/freshness.ts` + `DataFreshness` already implement
this exact pattern for catalog data: a `useSyncExternalStore` signal fed passively
from `meta.source` on every API response (zero extra requests), rendered as a chip
that switches between "Live data" and "Demo data". The AI badge is its sibling and
must match its visual language and mechanism. `GET /api/meta/health` already reports
`aiProvider: ai.providerName`, so the server-side signal also exists.

Both indicators then answer the same two questions consistently: is the *data* live,
and is the *AI* real.

### Part C — wire a real provider (blocked on user)

Needs a funded API key. `createAiProvider` already handles selection and fallback;
this is `AI_PROVIDER` + key in the Cloudflare Worker env, no code change.

## Explicitly not in this chunk

- **P5 + P6 (semantic search + copilot)** — chunk 2, own spec. Two realizations:
  1. They are one feature. "Fast left backs under 24" needs no embeddings and no
     vector DB — it needs a model with a `search_players({position, maxAge, minPace})`
     tool. The LLM does intent→filters; the existing O(n) catalog scan executes them.
     The chosen filters are emerald fact, the ranking commentary is amber inference.
  2. It is not an "upgrade" of the AI Scout. Since the frontend has never called
     `/api/ai/*` (see Part B), chunk 2 is the **first** connection between the UI and
     the AI backend. Budget it as integration work, not a refactor: an `api.ai.*`
     client surface, auth token plumbing, quota/error states, and streaming — none of
     which exist on the frontend today.

  Chunk 2 is gated on Part C. A copilot on the mock provider is theatre.
- **P1, P2, P7, P11, P12** — deferred until real users generate real interaction data.
  Revisit when weekly returning users are consistently double digits.
- **P3, P13** — not projects. They are the design rule, and Part A is what makes them
  true rather than claimed.
- **P4 knowledge graph** — real value at real catalog size; no user-facing payoff
  before chunk 2.

## Risks

- Removing a visible number may read as a downgrade. It is the opposite, but nobody
  outside the team will know that — worth a line in the beta changelog.
- `Prediction.confidence` deletion touches demo seed data the Poisson engine will
  rebuild. Low risk: demo data, compiler-verified, no persistence.
