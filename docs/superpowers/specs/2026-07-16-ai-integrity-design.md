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

### Part B — wire a real provider (blocked on user)

Needs a funded API key. `createAiProvider` already handles selection and fallback;
this is `AI_PROVIDER` + key in the Cloudflare Worker env, no code change. Until then
prod serves `MockAiProvider`, which self-labels — acceptable, because it tells the
truth about what it is.

**Open question for review:** should the mock's honesty be enforced at the UI layer
too? Right now `AiResult.provider` is `"mock"` and the frontend ignores it. A
`provider === "mock"` check could render a "demo engine" tag rather than relying on
the model's own text to disclose it. Small, and it makes the honesty structural
instead of stylistic.

## Explicitly not in this chunk

- **P5 + P6 (semantic search + copilot)** — chunk 2, own spec. Key realization: they
  are one feature. "Fast left backs under 24" needs no embeddings and no vector DB —
  it needs a model with a `search_players({position, maxAge, minPace})` tool. The LLM
  does intent→filters; the existing O(n) catalog scan executes them. The chosen
  filters are emerald fact, the ranking commentary is amber inference. Blocked on
  Part B — a copilot on the mock provider is theatre.
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
