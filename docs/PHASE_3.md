# Phase 3 Recommendations

Phase 1 = launch-ready demo. Phase 2 (this work) = production architecture on free tiers. Phase 3 = turning it into a business. Ordered by expected learning-per-effort:

## 1. Ship the beta loop (week 1)
Deploy per DEPLOYMENT.md (Supabase + Workers + Vercel), run the migration, flip `AI_PROVIDER=claude` with a small key budget. The AI cache means cost ≈ (unique players viewed) not (page views). Watch `/api/health`, audit logs, and quota exhaustion — they tell you which AI features people actually spend their 10 daily generations on. **That's the product signal everything else waits on.**

## 2. Auth UI + save-everything (weeks 1–2)
Sign-in modal (Google + email OTP + "continue as guest") wired to the existing AuthContext; then swap Profile/TacticalBoard/Compare localStorage for `/api/users/*` (endpoints live). Saved data is the retention hook and the upgrade lever (plan limits already enforce board/comparison caps).

## 3. Real football data (weeks 2–4, the big unlock)
Free-tier sources first (football-data.org 10 req/min free; API-Football free tier) behind a nightly sync job (Workers Cron → Supabase tables) rather than per-request proxying — free-tier quotas become a non-issue and the catalog gets a `database` source above `demo`. Only the `CatalogService` internals change. Then re-point AI prompts at the live rows: same prompt registry, drastically more valuable output.

## 4. Prediction engine v1 (weeks 3–5)
Replace static demo probabilities with a simple, honest model (Poisson/Elo on synced results) computed in the nightly job, stored per fixture, explained by the existing `prediction_explanation` prompt. Log every published prediction to `prediction_history` and publicly track accuracy — credibility is the moat for this product category.

## 5. Monetization scaffolding → Stripe (when usage proves it)
Quotas/plans/gates are live; pricing page + Stripe Checkout + one webhook that writes `profiles.plan` completes it. Suggested: Free (10 AI/day) · Pro ~€6/mo (200/day, saved everything) · Club (API access, later). Razorpay adapter for India via the same webhook seam.

## 6. Admin frontend (parallel, low risk)
`/admin` section (RequireAuth role=admin) over the finished admin API: flags, feedback triage, newsletter export, user plan overrides. First-party dogfooding of the API.

## 7. Notifications that matter (after #3)
Nightly job emits `notifications` rows for followed teams/players (transfer news, match reminders, AI digest) + Resend adapter for the email channel (interface ready). Web push later.

## 8. Observability before scale
Sentry adapter (seam exists), uptime ping on `/api/health`, a weekly cost/usage digest from audit+quota tables. Add Workers Analytics Engine counters when request volume justifies it.

## Explicitly not yet
Native apps, i18n content (prompt registry has the seam), self-hosted LLMs, microservices, Kubernetes — all premature until the beta loop (step 1) produces retention data.
