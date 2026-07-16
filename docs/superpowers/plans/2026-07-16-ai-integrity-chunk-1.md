# AI Integrity (Chunk 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop rendering fabricated AI confidence percentages, and make it structurally visible when analysis did not come from a real model.

**Architecture:** Two independent changes to the frontend only. (A) Delete the `confidence` field from `ContentArticle` and `Prediction` and the `confidence` prop from `AIMeta` — a typed-field deletion, so `tsc` enforces completeness. (B) Add an optional `provider` prop to `AIMeta`; when it is `undefined` (client-generated prose) or `"mock"` (server with no API key), render a muted "Demo engine" chip that mirrors the existing `DataFreshness` chip. When a real provider is configured, the chip disappears with no frontend change.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind 4, Vite 7. Vitest added to the root for one pure-function test (frontend currently has no test runner; `server/` already uses vitest).

## Global Constraints

- **The honesty rule (CLAUDE.md, non-negotiable):** emerald `#10b981` = measured fact, amber `#fbbf24` = model inference. Never dress a guess as a fact.
- **No shadows.** Flat surfaces, tonal ladder, hairlines (DESIGN.md).
- **Mono tabular numbers** for numeric UI; `font-mono text-micro uppercase tracking-[0.12em]` is the established chip type style.
- **A11y bar: WCAG 2.1 AA.** Keyboard-complete, reduced-motion honored.
- **Do not add:** embeddings, vector DBs, personalization, MLOps, or any AI backend wiring. Chunk 1 is frontend-only.
- **Never render a number that cannot be traced to a measurement.** This is the whole point of the chunk.
- Copy string is exactly `Demo engine` (sentence case, as rendered; the chip CSS uppercases it).

---

### Task 1: Delete fabricated confidence

The `confidence` numbers rendered by `AIMeta` are literals (`confidence: 82`, `74 + Math.round(rand() * 12)`), not model output — `AiResult` in `shared/contracts.ts` has no confidence field and never has. This task removes them.

**Files:**
- Modify: `src/components/ui/AIMeta.tsx` (remove prop, `level` calc, bar markup)
- Modify: `src/data/content.ts:83-84` (field + doc comment), and the literals at `:186 :239 :291 :346 :397 :446 :486 :526 :582 :635`
- Modify: `src/data/types.ts:214` (`Prediction.confidence`)
- Modify: `src/data/predictions.ts` (literals at `:31 :60 :89 :118 :147 :176`)
- Modify: `src/pages/IntelligenceArticle.tsx:100` (stop passing prop)
- Modify: `src/pages/PredictionDetail.tsx:154-155` (stop passing prop)
- Modify: `server/src/ai/prompts/index.ts:126` (stop feeding the fake number into the model's prompt)
- Test: none — `tsc` is the verification (see Step 2 rationale)

**Cross-boundary warning:** `src/data/types.ts` is not frontend-only. `server/src/data/demo.ts` imports it via relative path (`../../../src/data/predictions`), so deleting `Prediction.confidence` breaks the **server** build too. The root `tsc` will not catch this — the server has its own tsconfig. Both typechecks must run (Step 8).

**Interfaces:**
- Consumes: nothing.
- Produces: `AIMeta` signature becomes `AIMeta({ generatedAt, sources, feedbackSubject, className })` — Task 2 adds `provider` to it. `ContentArticle` and `Prediction` no longer carry `confidence`.

- [ ] **Step 1: Delete the field from `ContentArticle`**

In `src/data/content.ts`, delete both the doc comment and the field (currently lines 83-84):

```ts
  /** Model confidence 0–100, derived from the underlying data. */
  confidence: number;
```

The doc comment claims derivation that does not exist. It goes with the field.

- [ ] **Step 2: Run the compiler to enumerate every call site**

Run: `npx tsc --noEmit`

Expected: FAIL. Errors of the form `Object literal may only specify known properties, and 'confidence' does not exist in type 'ContentArticle'` at `src/data/content.ts` lines `186, 239, 291, 346, 397, 446, 486, 526, 582, 635`, plus `Property 'confidence' does not exist` at `src/pages/IntelligenceArticle.tsx:100`.

This failing compile is the test for this task. The field is typed, so the compiler proves the deletion is complete in a way a unit test cannot.

- [ ] **Step 3: Delete each `confidence:` literal the compiler named in `content.ts`**

Delete these lines entirely (line numbers shift as you go — work bottom-up, or re-run `tsc` between edits):

```ts
    confidence: pred ? pred.confidence : 62,                        // :186
    confidence: 70 + Math.round(rand() * 12),                       // :239
    confidence: 74 + Math.round(rand() * 14),                       // :291
    confidence: Math.round(r.probability * 0.6 + r.reliability * 8), // :346
    confidence: 78 + Math.round(rand() * 10),                       // :397
    confidence: 82,                                                 // :446
    confidence: 76,                                                 // :486
    confidence: 71,                                                 // :526
    confidence: 68 + Math.round(rand() * 10),                       // :582
    confidence: 80,                                                 // :635
```

Note `:346` is the one case computed from inputs — but the weights (`0.6`, `8`) are invented and the inputs are demo data. It goes with the rest.

- [ ] **Step 4: Remove the `confidence` prop from `AIMeta`**

In `src/components/ui/AIMeta.tsx`, the component becomes:

```tsx
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { FeedbackWidget } from "@/components/ui/FeedbackWidget";
import { cn } from "@/lib/utils";

/**
 * AI provenance strip — every substantial AI-generated block carries one:
 * generation timestamp, source references and the disclaimer.
 * Amber = model inference, per the FootIQ semantic accent rule.
 *
 * Deliberately carries no confidence number: nothing in the pipeline produces
 * one (`AiResult` has no confidence field), and a number the user cannot trace
 * is worth less than no number at all.
 */
export function AIMeta({
  generatedAt,
  sources,
  feedbackSubject,
  className,
}: {
  /** ISO date or datetime. */
  generatedAt: string;
  sources?: { label: string; path: string }[];
  /** Labels the 👍/👎 signal, e.g. the report title. Widget always renders. */
  feedbackSubject?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-iq/25 bg-iq-soft p-4", className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-micro uppercase tracking-[0.14em] text-iq-ink">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Sparkles className="size-3.5" aria-hidden /> AI-generated analysis
        </span>
        <span>Generated {generatedAt.slice(0, 10)}</span>
      </div>
      {sources && sources.length > 0 && (
        <p className="mt-2 text-caption leading-relaxed text-ink-2">
          <span className="font-mono text-micro uppercase tracking-wider text-ink-3">Based on: </span>
          {sources.map((s, i) => (
            <span key={s.path}>
              {i > 0 && " · "}
              <Link to={s.path} className="underline decoration-iq/40 underline-offset-2 transition-colors hover:text-ink">
                {s.label}
              </Link>
            </span>
          ))}
        </p>
      )}
      <p className="mt-2 text-label leading-relaxed text-ink-3">
        Model inference from structured performance data — speculative analysis, not verified reporting. Not betting advice.
      </p>
      <FeedbackWidget subject={feedbackSubject} className="mt-3 border-t border-iq/15 pt-3" />
    </div>
  );
}
```

- [ ] **Step 5: Update the `IntelligenceArticle` call site**

`src/pages/IntelligenceArticle.tsx:100` becomes:

```tsx
      <AIMeta generatedAt={article.publishedAt} sources={article.sources} />
```

- [ ] **Step 6: Update the `PredictionDetail` call site**

In `src/pages/PredictionDetail.tsx`, delete the `confidence={pred.confidence}` line (`:155`). The call becomes:

```tsx
      <AIMeta
        generatedAt={weekStamp()}
        sources={[
          { label: `${home.name} team page`, path: teamPath(home) },
          { label: `${away.name} team page`, path: teamPath(away) },
          { label: "Match center", path: matchPath(match) },
          // preview articles are generated for matches still to play
          ...(match.status !== "finished" ? [{ label: "AI match preview", path: `/intelligence/preview-${matchSlug(match)}` }] : []),
        ]}
      />
```

- [ ] **Step 7: Delete `Prediction.confidence` and its seed literals**

`pred.confidence` is now unreferenced. In `src/data/types.ts:214`, delete:

```ts
  confidence: number;
```

Then delete the six seed literals in `src/data/predictions.ts` (`confidence: 74,` at `:31`, and the same field at `:60 :89 :118 :147 :176`).

Rationale: this is demo seed data. The Poisson/Elo engine (TECH_DEBT #22) may legitimately emit a confidence later; its own spec reintroduces the field with a real derivation. Deleting now keeps the type honest in the meantime.

- [ ] **Step 8: Stop feeding the fabricated number into the model's prompt**

`server/src/data/demo.ts` re-exports `src/data/predictions`, so the server sees this type too. In `server/src/ai/prompts/index.ts`, the `prediction_explanation` prompt currently hands the model the fake confidence (`:126`):

```ts
  modelReasoning: prediction.reasoning,
  confidence: prediction.confidence,
})}
```

Delete the `confidence` line so the serialized prompt becomes:

```ts
  modelReasoning: prediction.reasoning,
})}
```

Rationale: this is the worst instance of the defect. The prompt opens `"Do not invent probabilities beyond those given"` and then supplies an invented one. The model would explain a certainty that came from a literal, and its prose would render back to the user as reasoning — laundering `rand()` into apparent analysis. Everything else `prediction_explanation` passes (`homeWin`, `expectedGoals`, `over25`, `btts`, `reasoning`) is real seed data and stays.

- [ ] **Step 9: Run both compilers to verify the deletion is complete**

The root tsconfig does not cover `server/` — it has its own. Run both:

```bash
npx tsc --noEmit
cd server && npm run typecheck && cd ..
```

Expected: both PASS with no output. Zero references to a fabricated confidence remain on either side.

- [ ] **Step 10: Run the server test suite**

The prompt registry is covered by `server/src/ai/evals/` and `server/src/app.test.ts`; a changed prompt string can move a golden file.

Run: `cd server && npm test && cd ..`

Expected: PASS. If an eval golden fails on the `prediction_explanation` prompt shape, the golden is stale — the prompt legitimately changed — and should be regenerated, not worked around.

- [ ] **Step 11: Verify the affected pages still render**

Start the dev server in one terminal: `npm run dev`
Then run: `npm run verify`

Expected: PASS — route-wide screenshot sweep with no console errors and no overflow. Pay attention to `/intelligence/*` and `/predictions/*`, whose `AIMeta` strip lost an element and must not have collapsed its layout.

- [ ] **Step 12: Commit**

```bash
git add src/components/ui/AIMeta.tsx src/data/content.ts src/data/types.ts src/data/predictions.ts src/pages/IntelligenceArticle.tsx src/pages/PredictionDetail.tsx server/src/ai/prompts/index.ts
git commit -m "fix(ai): remove fabricated confidence percentages

AIMeta rendered a confidence bar sourced from literals in content.ts and
predictions.ts (confidence: 82, 74 + Math.round(rand() * 12)). No model
ever produced these — AiResult has no confidence field. The component
built to enforce 'never dress a guess as a fact' was manufacturing one.

The prediction_explanation prompt also fed that number to the model
while instructing it not to invent probabilities, so generated prose
could echo a literal back as reasoning. That input is gone too.

Keeps generation date, sources and the disclaimer, all of which are true.
Prediction.confidence goes with it; the Poisson/Elo engine reintroduces
it with a real derivation when it lands."
```

---

### Task 2: "Demo engine" badge

Everything wearing amber today is client-generated: `content.ts` articles are deterministic templates, `concierge.ts` is a keyword ladder, Scout filters locally. No model has produced a word any user has read. This task makes that visible, and makes it disappear on its own when a real provider is configured.

**Files:**
- Create: `src/lib/ai-provenance.ts`
- Create: `src/lib/ai-provenance.test.ts`
- Modify: `src/components/ui/AIMeta.tsx` (add `provider` prop + chip)
- Modify: `package.json` (add `vitest` devDep + `test` script)
- Modify: `vite.config.ts` (add vitest `test` block)

**Interfaces:**
- Consumes: `AIMeta` from Task 1 — signature `AIMeta({ generatedAt, sources, feedbackSubject, className })`.
- Produces: `isDemoEngine(provider?: string): boolean` from `src/lib/ai-provenance.ts`. `AIMeta` gains an optional `provider?: string` prop. Chunk 2 adds `noteAiProvider()` / `useAiProvenance()` to the same module, mirroring `src/lib/freshness.ts`.

- [ ] **Step 1: Add vitest to the root**

The frontend has no test runner (only `server/` does). Add one dev dependency — no jsdom, no testing-library. The unit under test is a pure function; a DOM harness would be unjustified for this chunk.

Run: `npm install -D vitest@^3.2.0`

Then add to `package.json` scripts:

```json
    "test": "vitest run",
```

- [ ] **Step 2: Configure vitest**

In `vite.config.ts`, add a `test` block to the exported config (Vitest reads the vite config; the existing `@` alias then resolves in tests). Add the triple-slash reference at the top of the file:

```ts
/// <reference types="vitest" />
```

and add to the config object:

```ts
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
```

- [ ] **Step 3: Write the failing test**

Create `src/lib/ai-provenance.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isDemoEngine } from "./ai-provenance";

describe("isDemoEngine", () => {
  it("flags client-generated prose (no provider ever ran)", () => {
    expect(isDemoEngine(undefined)).toBe(true);
  });

  it("flags the mock provider", () => {
    expect(isDemoEngine("mock")).toBe(true);
  });

  it("clears real providers", () => {
    expect(isDemoEngine("claude")).toBe(false);
    expect(isDemoEngine("openai")).toBe(false);
    expect(isDemoEngine("gemini")).toBe(false);
    expect(isDemoEngine("ollama")).toBe(false);
  });

  it("fails closed on an unrecognized provider", () => {
    // An unknown string is more likely a bug than a real model. Claiming
    // "real AI" wrongly breaks the honesty rule; showing the badge wrongly
    // is merely conservative.
    expect(isDemoEngine("")).toBe(true);
    expect(isDemoEngine("   ")).toBe(true);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL — `Failed to resolve import "./ai-provenance"`.

- [ ] **Step 5: Write the minimal implementation**

Create `src/lib/ai-provenance.ts`:

```ts
/**
 * AI provenance — the sibling of `freshness.ts`. Where that answers "is this
 * data live or demo?", this answers "did a real model produce this?".
 *
 * `undefined` means the text was generated client-side (content.ts templates,
 * the scripted concierge) and never touched a provider at all. `"mock"` means
 * the server answered with MockAiProvider because no API key is configured.
 * Both are the demo engine as far as a reader is concerned.
 */

const REAL_PROVIDERS = new Set(["claude", "openai", "gemini", "ollama"]);

/** True when no real model produced the output. Fails closed on unknowns. */
export function isDemoEngine(provider?: string): boolean {
  return !REAL_PROVIDERS.has((provider ?? "").trim());
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test`

Expected: PASS — 4 tests passed.

- [ ] **Step 7: Render the chip in `AIMeta`**

In `src/components/ui/AIMeta.tsx`, add the import:

```tsx
import { isDemoEngine } from "@/lib/ai-provenance";
```

Add `provider` to the props (both the destructure and the type):

```tsx
  /** Provider that produced the text (`AiResult.provider`). Omit for
   *  client-generated prose — that renders the demo-engine chip. */
  provider?: string;
```

Then add the chip as the last item of the existing header row, after the `Generated` span:

```tsx
        {isDemoEngine(provider) && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-ink-3"
            title="This analysis is generated by the demo engine, not a live AI model. It disappears once a real provider is configured."
          >
            <span className="size-1.5 rounded-full bg-ink-3" aria-hidden />
            Demo engine
          </span>
        )}
```

This mirrors `DataFreshness`'s non-live chip exactly (`border-line bg-surface text-ink-3` + muted dot), so the two provenance signals read as one system: "is the data live?" and "is the AI real?".

The chip text is a plain string inside the row — it needs no `aria-label`, unlike the confidence bar it replaces (which needed one precisely because a bar cannot speak).

- [ ] **Step 8: Verify the badge renders on the affected routes**

Start the dev server: `npm run dev`
Then run: `npm run verify`

Expected: PASS — no console errors, no overflow. Manually confirm the "Demo engine" chip appears on `/intelligence/*` and `/predictions/*`, since neither call site passes `provider` (both are client-generated).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/lib/ai-provenance.ts src/lib/ai-provenance.test.ts src/components/ui/AIMeta.tsx
git commit -m "feat(ai): add structural demo-engine badge to AIMeta

Everything wearing amber today is client-generated — content.ts is
deterministic templates, concierge.ts is a keyword ladder, and the
frontend has never called /api/ai/*. AIMeta now says so.

isDemoEngine() fails closed: only known real providers clear the badge,
so a wiring bug shows the chip rather than falsely claiming live AI.
Mirrors the freshness.ts/DataFreshness chip so data provenance and AI
provenance read as one system. Disappears with no frontend change once
AiResult.provider carries a real provider.

Adds vitest to the root (no DOM harness — the unit is a pure function)."
```

---

## Not in this plan

- **Wiring a real provider** — blocked on a funded API key. `createAiProvider` already handles selection and fallback; it is `AI_PROVIDER` + key in the Worker env, no code change.
- **`noteAiProvider()` / `useAiProvenance()` store** — YAGNI until an `AiResult` actually reaches the frontend. Chunk 1's badge is prop-driven and every call site is client-generated, so the store would have no writer. It lands in chunk 2 alongside the first real `api.ai.*` call.
- **Showing the model name when a provider is real** — no real provider exists to name yet. Chunk 2.
- **Chunk 2 (copilot + semantic search)** — own spec. Note it is first-time UI↔AI integration, not a refactor.
