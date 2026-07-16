# Phase 5 — Public Beta Readiness (shipped 2026-07-13)

Product-quality pass for real users on top of the Phase 1–4 platform. No redesign, no new dependencies, no architecture changes — every feature builds on existing stores and the existing UI kit. Companion doc: `PHASE_5.md` (monetization, unchanged — its pre-flight item #1 "real data live" is now DONE).

## 1. Changelog

| Area | What shipped |
|---|---|
| Onboarding | First-visit 4-step skippable tour (positioning → AI Scout → Tactics/Predictions → emerald/amber honesty rule). Shows once, re-launchable from TopBar `?` and /about. |
| Feedback | 👍/👎 + optional note on every substantial AI block (AIMeta embeds it; 10 IQInsight verdict blocks opted in). Full category form on /contact → existing `/api/feedback`. Demo mode degrades to local counting / mailto. |
| Retention | Recently-viewed ring buffer (`footiq-recent`) fed by player/team/match/news/intel pages. Home "For you" rows: your clubs (with live table position), your players, continue reading, recently viewed, because-you-viewed similar CTA. Invisible until the user follows/browses. |
| Empty states | Reusable `EmptyState` (icon/title/body/suggestion chips). Profile watchlist recommends form leaders; bookmarks/predictions guide to their source pages. |
| Tactics saves | Save/load/delete boards (`footiq-boards`, 12 max) — formation lab and head-to-head both persist; saved-boards panel with guiding empty state. |
| Trust | Live data / Demo data provenance chip in TopBar driven passively by every API response's `meta.source` (zero extra requests). Disclaimer gains confidence-score legend + updated provenance copy. About credits football-data.org (attribution requirement). _(Correction, 2026-07-16: the confidence-score legend was removed in `fix/ai-integrity-chunk-1` — no model in the pipeline ever produced a confidence number to legend. See Disclaimer §3.)_ |
| Analytics | Typed `ProductEvent` catalog + single `track()` entry. Removed bump()'s GA mirror (route views were double-firing next to page_view). |
| Search | Matched-substring highlight in palette results. (Recent/trending/keyboard/voice shipped in earlier phases.) |
| Share | Player comparisons live at `?a=&b=` (shareable/deep-linkable) with ShareBar; AI Scout results get ShareBar (query already in URL). |
| Newsletter | Honest topic list + no-spam microcopy, "Get the briefing" CTA, success copy reflects live product (waitlist framing removed). |
| Insights | Fleet "Beta pulse" card — new `GET /api/stats` (subscriber + feedback counts, provider, last sync; aggregates only, no PII). |
| Data platform fix | **Workers "Illegal invocation" crash on first live sync** — stored bare `fetch` rebound `this`; wrapped in 6 classes (both football providers, 3 AI providers, Upstash). Live Premier League standings confirmed syncing (20 rows, provider source served). |

## 2. Analytics events (GA4, via `track()`)

`onboarding_completed` · `onboarding_skipped` · `ai_scout_generated` · `ai_report_generated` · `prediction_viewed` · `comparison_created` · `favorite_added` · `favorite_removed` · `bookmark_added` · `newsletter_signup` · `share_clicked` (channel) · `share_image_exported` · `feedback_submitted` (category) · `search_used` · `tactic_saved` — plus `page_view` from the router. Local mirrors for /insights stay in `lib/metrics.ts` (no PII, device-only).

## 3. Feedback system

- Inline: `FeedbackWidget` (👍 instant; 👎 opens optional "what was off?" note) → `POST /api/feedback` category `ai`, page auto-attached, rate-limited server-side, works signed-out.
- Long-form: `FeedbackForm` on /contact — idea/bug/wrong-data/AI-quality categories.
- Read side: counts in /insights fleet card; rows in Supabase `feedback` table (admin API exists for status triage).

## 4. Verification (all run 2026-07-13)

- `tsc -b` clean (root + server) · server 60 tests pass (6 live-skipped) · production build clean, no new boot-path weight (largest new chunk: FeedbackWidget 6.6 kB) · 37/37 route walk incl. mobile viewports, zero console errors · reduced-motion + skip-link + aria labels on all new components.

## 5. Launch checklist (public beta announce)

- [x] Real data syncing (standings live via football-data.org; fixtures follow when season starts — 0 rows is July off-season, not a bug)
- [x] Provenance honesty (Live/Demo chip, disclaimer, attribution)
- [x] Feedback loop end-to-end (widget → API → Supabase)
- [x] Onboarding answers "what is FootIQ" in <30s; Scout reachable in 2 clicks from it
- [ ] Deploy worker (stats endpoint) + push frontend (Vercel)
- [ ] ANTHROPIC_API_KEY on worker → real AI generations (aiProvider currently mock)
- [ ] Set VITE_GA_ID/VITE_CLARITY_ID in Vercel env (analytics silent without them)
- [ ] Smoke-test prod: onboarding, thumbs on a prediction, newsletter signup, /insights fleet card
- [ ] Rotate any keys ever pasted in chat/files (football-data key was briefly in .env.example, never committed)

## 6. Remaining issues & new tech debt

See TECH_DEBT.md #26–29 (feedback re-vote after reload, comparison URL sync players-only, off-season fixture window, per-device onboarding flag). None block beta.

## 7. Recommendations before announcing

1. Put the Anthropic key on the worker — mock AI is the only thing left that undercuts the "AI intelligence layer" claim.
2. Add GA4 + Clarity IDs; a week of quiet-beta data beats guessing.
3. Email provider (Resend adapter, ~1 file, interface ready) so newsletter + double opt-in stop being IOUs.
4. Then work PHASE_5.md monetization pre-flight #2–3 (commercial data license, public accuracy ledger).
