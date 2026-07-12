# Phase 5 Recommendations — Monetization

Phases 1–4 built product, platform, growth and data. Phase 5 charges for it. Every gate below already exists in code — monetization is configuration plus a payment webhook, not a rewrite.

## Pre-flight (blockers, do first)
1. **Deploy + real data live** (tasks parked from the deploy phase): Workers + Vercel + Supabase, `DATA_PROVIDER=football-data`, cron running. No one pays for demo data.
2. **Data licensing for commercial use:** football-data.org free tier and API-Football free tier are non-commercial. Before the first paid subscription: API-Football paid plan (~$0→$29/mo tiers) or Sportmonks; the provider interface makes this a key swap.
3. **Accuracy ledger public** (Phase 4 #6 → prediction settlement) — the sales page IS the track record.

## The offer (maps to existing plan gates)
- **Free:** 10 AI generations/day (PLAN_LIMITS.free), 3 boards/comparisons, follows + digest.
- **Pro (~€6/mo):** 200 AI/day, unlimited saves, exports, early features (`beta_features` flag).
- **Club (later):** API access (`/api/v1` + per-key quotas), bulk exports, priority models.

## Build order
1. **Stripe Checkout + one webhook** — webhook writes `profiles.plan`; `requirePlan`/`consumeQuota`/plan limits enforce everywhere already. Razorpay adapter behind the same webhook seam for India.
2. **Pricing page + upgrade CTAs** at quota-exceeded moments (the 429 quota response is the highest-intent surface in the product).
3. **Billing portal link** (Stripe-hosted; zero UI to build).
4. **Usage visibility:** show remaining daily quota in the profile (endpoint data already exists in usage_quotas).
5. **Dunning/grace:** webhook downgrade on failed payment after N days — one status field, plan flips back to free.

## Metrics that decide success
Conversion at quota-hit, week-4 retention of paid vs free, AI cost per paying user (cache hit rate keeps this near zero), churn reason survey (feedback table exists).

## Explicitly not yet
Seats/teams, invoicing, self-hosted models, ads (never — wrong product), enterprise SSO.
