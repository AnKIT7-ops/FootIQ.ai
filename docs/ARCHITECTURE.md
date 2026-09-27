# FootIQ — Architecture

**The AI intelligence layer for football.** Frontend demo → production-ready AI SaaS foundation, at $0/month until validated demand.

## System overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  FRONTEND  React 19 + Vite (Vercel free tier)                       │
│    pages/components                                                 │
│      │  imports ONLY @/lib/repositories (enforced by import guard)  │
│    repositories (demo-seeded stores, live ESM bindings, hooks)      │
│      │  api client (typed envelope, timeout, bearer injection)      │
│      ▼            fallback: bundled demo data (src/data)            │
├─────────────────────────────────────────────────────────────────────┤
│  API LAYER  Hono (Cloudflare Workers / Render / Railway free tier)  │
│    middleware: requestId → secure headers → CORS → body limit →     │
│                access log → auth (JWT) → rate limit                 │
│    routes: /api/{health,flags,players,teams,matches,news,           │
│            transfers,predictions,clips,history,fantasy,search,      │
│            ai/*,auth/*,users/*,settings,notifications,              │
│            newsletter/*,feedback,feature-requests,admin/*}          │
├─────────────────────────────────────────────────────────────────────┤
│  BUSINESS LOGIC  services/                                          │
│    CatalogService (football reads)   UserDataService (owned rows)   │
│    AiService (provider+cache+quota)  FlagService  QuotaService      │
│    NotificationService  CommunityService  AuditService              │
├─────────────────────────────────────────────────────────────────────┤
│  DATA  Supabase Postgres (free tier) — 15 tables, RLS everywhere    │
│        Cache: Upstash Redis REST / Cloudflare KV / in-memory        │
├─────────────────────────────────────────────────────────────────────┤
│  AI SERVICES  AiProvider interface                                  │
│    Claude (@anthropic-ai/sdk) · OpenAI · Gemini · Ollama · Mock     │
│    Prompt registry (versioned, typed inputs) — prompts ≠ transport  │
├─────────────────────────────────────────────────────────────────────┤
│  EXTERNAL PROVIDERS (future)                                        │
│    paid football data API → slots into CatalogService only          │
│    Stripe/Razorpay → sets profiles.plan; gates already exist        │
│    Resend/SES → implements EmailProvider                            │
└─────────────────────────────────────────────────────────────────────┘
```

## Layer independence — the load-bearing decisions

1. **Repository pattern on both sides.** The frontend's repositories are demo-seeded stores hydrated from the API when configured (`VITE_API_URL`); the server's `CatalogService` is the single place a real football data provider will plug in. Neither pages nor routes know where data originates (`meta.source` reports it for ops).
2. **Graceful degradation is the contract, not a feature.** No env vars → the entire product works from bundled data: mock AI, guest mode, in-memory cache. Each subsystem independently upgrades when its config appears (DB, cache, AI key, auth). `ApiUnavailableError` is the designed signal for "fall back to demo".
3. **Live ESM bindings for zero-churn hydration.** Repositories re-export the exact names pages already used (`players`, `getTeam`, `matchById`…) as `export let` bindings swapped on hydration — 21 files migrated with import-path changes only, no page rewrites, and `scripts/check-imports.mjs` keeps it that way.
4. **One dependency container.** `createApp(env, overrides)` builds every service once; tests inject mocks, Workers/Node share the factory, no module-level singletons.
5. **Contracts are shared code.** `shared/contracts.ts` (envelope, error codes, plans, flags, DTOs, route table) is imported by both sides — a drift between frontend and backend is a compile error, not a runtime surprise.

## Folder structure

```
FootIQ.ai/
├── src/                        # React app (Vercel)
│   ├── pages/ components/      # UI (untouched by the backend work)
│   ├── data/                   # bundled demo dataset + types (fallback source)
│   └── lib/
│       ├── config.ts           # VITE_* readers; backendConfigured/authConfigured
│       ├── api/client.ts       # typed fetch, envelope unwrap, token injection
│       ├── auth/               # optional Supabase auth (lazy chunk) + RequireAuth
│       └── repositories/       # store engine + 9 dataset repositories
├── server/                     # Hono API (Workers/Render/Railway)
│   └── src/
│       ├── app.ts index.ts worker.ts        # factory + Node + Workers entries
│       ├── config/env.ts                    # zod-validated env (fail fast)
│       ├── middleware/                      # auth, rate-limit, validate, entitlements
│       ├── routes/                          # catalog, ai, auth, users, admin, meta…
│       ├── services/                        # business logic
│       ├── ai/                              # providers + prompts + AiService
│       ├── cache/                           # Memory / Upstash / KV behind CacheStore
│       ├── platform/                        # email, storage, observability seams
│       ├── db/supabase.ts data/demo.ts      # service client + demo bridge
│       └── *.test.ts                        # vitest (34 tests)
├── shared/contracts.ts         # cross-boundary types (single source of truth)
├── supabase/migrations/        # 0001_init.sql — schema + RLS + RPC
├── scripts/check-imports.mjs   # architectural guard (runs in npm run verify)
└── docs/                       # this folder
```

## Request lifecycle (backend)

```
request → requestId + child logger → secure headers → CORS allowlist
        → 256KB body cap → access log → optionalAuth (JWT verify, never rejects)
        → global rate limit (300/min) → route
route   → scope rate limit → requireUser/requireRole → validate (zod, 422)
        → requirePlan → service → ok()/ApiError
        (AI: AiService charges the user's quota + global ceiling on cache miss only)
error   → onError: ApiError => safe envelope; unknown => captured + opaque 500
```

## Scaling path (documented, not built)

| Pressure | Next move (no rewrite needed) |
|---|---|
| Real football data | Implement provider inside `CatalogService`; demo stays as fallback tier |
| Multi-instance API | Cache already external (Upstash); limiter/quota follow it automatically |
| Search outgrows local scoring | Swap `CatalogService.search` body → Postgres FTS/Typesense; contract fixed |
| Heavy AI traffic | AI results already cached per input+prompt-version; add queue in front |
| Payments | Stripe webhook writes `profiles.plan`; `requirePlan`/quotas already gate |
```
