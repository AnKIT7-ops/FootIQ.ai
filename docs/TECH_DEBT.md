# Technical Debt Register

Honest list, ordered by risk × effort-to-fix-later. None block beta.

## Added in Phase 5 (beta readiness)

26. **Feedback re-votes aren't deduped across reloads** — widget state is per-mount; a reload lets the same device vote again. Fine for directional beta signal; add a sessionStorage/user guard if counts start driving decisions.
27. **Comparison URL sync covers players only** — teams/managers modes keep local state; their shares land on the default pair. Extend the same `?a=&b=` pattern when those modes earn traffic.
28. **Fixture sync window misses the off-season** — provider returns 0 fixtures in July (correct), so the fixtures rail stays demo until the season starts. Consider widening the provider date window to "next 30 days with fixtures".
29. **Onboarding flag is per-device** (`footiq-onboarded` in localStorage) — signed-in users see the tour again on a new device. Sync to profile settings when the auth UI phase lands.

## Added in Phase 4 (data platform)

20. **Snapshots are whole-collection JSONB** (`catalog_snapshots`) — right for collection reads at this scale; per-entity queries need relational catalog tables (`ponytail:` note in services/snapshots.ts).
21. **Synced-only teams have no squad** — teamPlayers returns [], generators fall back to placeholder lineups, and client-side visuals for unknown team ids use the first demo team's look. Resolves when a squad-capable provider tier lands.
22. **Provider matches carry no predictions** — the demo prediction set stays keyed to demo match ids; live-fixture predictions arrive with the Poisson/Elo engine (Phase 4 roadmap #4 → now Phase 5 pre-flight).
23. **Search index (frontend) and content library still snapshot at chunk load** (extends #15) — server search/suggest are live; the Ctrl+K index rebuild on hydration remains open.
24. **Live evals are manual** (`EVAL_LIVE=1`) — fine while prompt changes are rare; wire a scheduled eval run when they aren't.
25. **A/B measurement is client-blind** — `promptVersion` is returned but nothing logs exposure→outcome yet; add an analytics event when the first real experiment runs.

## From Phase 3

## Added in Phase 3 (growth layer)

14. **SPA-only rendering limits SEO reach.** Meta/JSON-LD/sitemap are complete, but non-JS crawlers see the shell. Fix = build-time prerender (Phase 4 #2); the route list already exists in the sitemap plugin.
15. **Search index + content library snapshot at chunk load.** Both derive from repository state when their chunk first loads — backend hydration that changes datasets later won't rebuild them until reload. Same class as debt #13; revisit when live data lands (subscribe to `store.onChange`).
16. **Share-card fonts are system stack.** Webfonts don't load inside canvas-rasterised SVG; cards use bold system sans instead of Archivo. Server-rendered OG cards (Phase 4 #7) fix typography properly.
17. **Bookmark remote-delete not mirrored.** Local removal works; server copy needs the row id mapping — lands with the auth UI phase (`ponytail:` comment in lib/user.ts).
18. **Metrics are device-local.** /insights reads this browser only; GA4 holds the fleet view. Server aggregation deferred until volume justifies it.
19. **Weekly digest slug changes weekly** (`digest-YYYY-MM-DD`) — old digest URLs 404 (redirect to hub) after regeneration. Acceptable while the library is client-generated; archive persistence arrives with server-side content.

## From Phase 2

1. **Match detail is demo-derived even in backend mode.** `repositories/matches.ts#matchDetail` delegates to the deterministic demo generator; `/api/matches/:id` exists but isn't consumed per-id. Fine while both sides share the dataset; must become an async fetch when a live provider lands. (Seam + endpoint already exist.)
2. **Live-binding repositories don't re-render non-hook consumers.** Pages read fresh data on their next render (route changes trigger one), but a page sitting open during hydration won't repaint until then. Hooks (`usePlayers` etc.) exist; migrate high-churn pages (Home, Matches) to them when live data arrives.
3. **Sync `getPlayer`/`getTeam` keep the original forgiving fallback** (unknown id → first item) for demo parity. Real data should surface not-found UI — needs page-level handling, done together with #2.
4. **In-memory cache/rate-limit on multi-instance Node** would fragment per instance (Workers isolates likewise). Non-issue on single free instance; flipping on Upstash fixes it with zero code (documented in ENVIRONMENT.md).
5. **KV `increment` is read-modify-write** (KV has no atomic INCR) — coarse limits only; strict limiting needs Upstash. Documented in `cache/kv.ts`.
6. **No Supabase-backed integration tests** — user-data/quota SQL paths verified by types + RLS design, not runtime tests. Add `supabase start` suite (TESTING.md gap #1).
7. **Auth UI is minimal**: AuthContext + RequireAuth + guarded /profile exist, but there's no sign-in page/modal wired to `signInWithGoogle`/`signInWithEmailOtp`. Deliberate: UI polish after Supabase project exists.
8. **Admin has no frontend** (by spec). API is complete; a `/admin` SPA section is Phase 3.
9. **Email provider is console-only** (by spec). Interface + templates ready; Resend adapter ~1 file.
10. **Not a true monorepo** (no workspaces). Frontend at root + `server/` + `shared/` keeps Vercel zero-config and avoided moving 100+ files without git history. Revisit npm workspaces (`apps/web`, `apps/api`, `packages/shared`) when a second app (admin) appears. ~~Also: the repo isn't under git~~ — resolved 2026-07-12 (`git init`, initial commit covers Phases 1–3). Remaining: add a GitHub remote + CI (DEPLOYMENT.md outline).
11. **`fixtureDifficulty`/`transferTips` typing leans on `typeof seed`** in the fantasy repo — fine, but a shared DTO in contracts would be cleaner once the backend shape firms up.
12. **Search is O(n) scans** per query (cached). Right up to ~10⁴ entities; swap point documented in ARCHITECTURE.md.
13. **`concierge.ts`/`search.ts` snapshot repo arrays at module load** — they see hydrated data only because live bindings refresh on each function call… verify this assumption when live data lands; if stale, subscribe them to `store.onChange`.
