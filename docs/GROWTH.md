# Growth Layer (Phase 3)

Phase 3 turned the platform into an acquisition machine: a self-generating SEO content library, entity URLs worth ranking, share loops, and retention surfaces (profiles, notifications, digest) — all still $0/month and fully functional with zero env vars.

## AI content engine

`src/data/content.ts` generates the **Intelligence library** (~90 unique articles) deterministically from the structured dataset:

| Kind | Count | Source data | Server AI task when live |
|---|---|---|---|
| match-preview | per upcoming/live match | teams, predictions, star players | prediction_explanation |
| team-form | 13 | table, form, squad ratings | tactics_feedback |
| player-analysis | starters + 7.2+ rated | stats, xG/xA, form trend | scout_report |
| transfer-analysis | per rumour | probability, package, sentiment | transfer_analysis |
| manager-style | 13 | tactical dials, style tags | tactics_feedback |
| best-xi / rising-players / fantasy-briefing / weekly-digest | weekly | form curves, fantasy board | scout_report / fantasy_advice / news_summary |
| historical-comparison | top pairs per position | ratings, market values | player_compare |

**Uniqueness invariant:** every sentence interpolates that entity's own numbers, and phrase variants are picked by a PRNG seeded from the article slug — no two pages share copy, and `weekStamp()` re-stamps the library every Monday (fresh-content signal without duplication).

**Pipeline (matches the AI workflow spec):** entity data → prompt/template (versioned registry server-side, seeded templates client-side) → LLM when `AI_PROVIDER` configured / deterministic generator otherwise → cached (AiService per task+input+prompt-version) → rendered with `AIMeta` provenance. Articles declare `aiTaskHint` so the server upgrade path is 1:1.

**AI quality rule (P12):** every article and prediction page carries `AIMeta` — confidence %, generation date, source references (internal links to the structured pages it was derived from), and the disclaimer. Amber = inference, emerald = measured fact, everywhere.

## URL architecture

Canonical slug routes (legacy id routes still resolve — resolvers accept either):

```
/players/erling-haaland      /teams/arsenal        /managers/mikel-arteta
/matches/arsenal-vs-liverpool  /news/{title-slug}  /predictions/{match-slug}
/history/{moment-slug}       /intelligence         /intelligence/{article-slug}
```

`src/lib/slug-builders.ts` is pure (no repositories, no import.meta) and shared by the app, the sitemap plugin and (later) the server — URLs can't drift.

## SEO report

- **Meta:** every page sets title/description/canonical/OG/Twitter via `usePageMeta`; article pages add `og:type=article` + published time.
- **JSON-LD:** WebSite (index.html), Person (players/managers), SportsTeam, SportsEvent (matches/predictions), Article (news/intelligence/history), BreadcrumbList on every entity page — one managed `#footiq-jsonld` script, replaced per navigation.
- **Sitemap:** `vite.config.ts` plugin emits `dist/sitemap.xml` at build (193 URLs) from the same slug builders + content engine; `robots.txt` allows all, disallows `/profile` + `/insights`, points at the sitemap.
- **Internal linking:** breadcrumbs, AIMeta source references, related-intelligence blocks, related-moments, manager↔team↔player cross-links, Predictions→full report, History cards→moment pages.
- **Known limit (honest):** the app is a client-rendered SPA — crawlers that don't execute JS see the shell meta only. Google renders JS; for the rest, build-time prerendering of the content library is the top Phase 4 SEO item (route list already comes from the sitemap plugin).

## Search

Typo-tolerant scoring (bounded Levenshtein, tolerance scales with word length), the Intelligence library and managers in the index, slug URLs in results, Recent searches (localStorage), Trending rail (device-popular merged with dataset heat), Ctrl+K keyboard-first as before, long queries still route to AI Scout.

## Shareability

`ShareBar` on player/team/match/news/intelligence/prediction/history pages: copy link, native share sheet (clipboard fallback), and **downloadable 1200×630 PNG share card** rendered from a hand-built branded SVG (zero dependencies). Social previews come from per-page OG tags.

## Retention surfaces

- **Follows:** star any team/player → drives the notification feed and profile watchlist (local-first, mirrored to `/api/users/*` best-effort when a backend is configured).
- **Bookmarks:** save news/intelligence reports; listed on the profile.
- **Prediction history:** every prediction report viewed is logged with the probabilities at view time.
- **Notifications:** bell feed derived from follows (match reminders, breaking news, transfer moves, fresh AI reports), preference toggles on the profile, read-state persisted. Server inbox merges on top later; lazy-loaded so the shell chunk stays clean.
- **Newsletter:** waitlist CTAs on the Intelligence hub, every article and the weekly digest article; joins hit `/api/newsletter/subscribe` when configured (Supabase-stored, rate-limited), localStorage otherwise.

## Metrics (meaningful only)

`src/lib/metrics.ts` counts entity views, searches, shares, AI usage and signups — localStorage, privacy-friendly, capped; every bump mirrors to GA4 when `VITE_GA_ID` is set. `/insights` (noIndex) renders the dashboards: most viewed, top searches, most shared, AI feature usage, totals. Server-side aggregation is Phase 4.

## Growth opportunities (next bets, ordered)

1. **Prerender the content library at build** — unlocks non-Google crawlers + instant first paint on article pages.
2. **Real data via free APIs** (football-data.org / API-Football nightly sync) — content engine instantly produces live-relevant articles; every preview becomes searchable the week it matters.
3. **Publish accuracy** — settle `prediction_history` publicly; "we were right N%" is the shareable credibility loop.
4. **Digest email send** (Resend free tier, adapter seam exists) — the digest article is already the email body.
5. **Share-card OG endpoint** — serve the SVG card as each page's `og:image` (Workers route) so links preview with live stats.
