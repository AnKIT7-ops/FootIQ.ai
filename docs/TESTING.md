# Testing Strategy

## What runs today

| Layer | Tool | Command | Coverage |
|---|---|---|---|
| Server unit | Vitest | `cd server && npm test` | MemoryCache (TTL, LRU, INCR windows), FlagService (defaults/env-override/rollout determinism), AiService (provider call, cache hit/miss, seed isolation, bypass) |
| Server API | Vitest + `app.request()` | same | envelope shapes, catalog 200/404/422, search, real JWT auth path (signed HS256; forged-token rejection), 401/403 gates, demo-mode 503s, AI generation via mock, flag kill-switch, rate-limit 429+Retry-After, community validation, CORS allow/deny — **34 tests, all passing** |
| Type safety | tsc strict | root `npm run build` (tsc -b) + `server npm run typecheck` | both packages, shared contracts compiled by both |
| Architecture | node script | `npm run check:imports` | dataset access only via repositories |
| E2E smoke | puppeteer (Edge) | `npm run verify` (dev server running) | 28 route/viewport checks: console errors, page errors, failed requests, horizontal overflow — passes with backend hydration live |

## Design choices
- **Mock-first seams, not mock frameworks.** The AI mock is a real provider implementing the real interface; the DB "mock" is simply `db: null` (demo mode) — the same degradation path production uses. Tests therefore exercise honest branches, not stubs.
- **Auth is tested through real crypto** — tokens signed with a test HS256 secret run the exact verification code path (jose), including a forged-signature case.
- **Rate limiting tested against the real middleware + MemoryCache**, not a fake clock abstraction.

## Gaps to close next (in order)
1. Supabase-backed integration tests (UserDataService, quotas RPC) against a local `supabase start` stack — currently these paths are covered only by types + demo-mode 503 tests.
2. Frontend repository tests (hydration swap, ApiUnavailable fallback) with Vitest + happy-dom.
3. Contract test: server route table ↔ `API_ROUTES` in shared contracts.
4. CI wiring (see DEPLOYMENT.md outline).
