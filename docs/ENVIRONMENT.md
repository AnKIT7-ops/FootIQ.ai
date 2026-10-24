# Environment Variables

Two files, two trust levels. **Frontend `VITE_*` values are public** (baked into the bundle). **Server values are secrets** — never prefix them with VITE_, never import them client-side.

## Frontend (`.env.local`, template: `.env.example`)

| Variable | Default | Effect when set |
|---|---|---|
| VITE_API_URL | *(empty = demo mode)* | Repositories hydrate from this API origin; waitlist posts there |
| VITE_SUPABASE_URL | *(empty)* | With anon key: enables auth (email OTP, Google, guest sessions) |
| VITE_SUPABASE_ANON_KEY | *(empty)* | Public key, RLS-enforced — safe to expose |
| VITE_SITE_URL / VITE_GA_ID / VITE_CLARITY_ID | *(empty)* | Existing SEO/analytics knobs (unchanged) |

## Server (`server/.env`, template: `server/.env.example`)

All optional — validated by zod at boot (`server/src/config/env.ts`); a malformed value fails fast with a readable message.

| Variable | Default | Purpose |
|---|---|---|
| NODE_ENV / PORT / LOG_LEVEL | development / 8787 / info | runtime basics |
| CORS_ORIGINS | http://localhost:5173 | comma-separated origin allowlist |
| SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY | — | enables database mode (accounts, quotas, admin). Service key bypasses RLS: server-only, rotate on exposure |
| SUPABASE_JWT_SECRET | — | HS256 verification for legacy projects; unset = JWKS (new projects) |
| AI_PROVIDER | mock | claude · openai · gemini · ollama · mock |
| AI_MODEL | claude-opus-4-8 | model id passed to the provider |
| AI_MAX_TOKENS | 2048 | per-completion cap (prompts define their own lower caps) |
| AI_GLOBAL_DAILY_LIMIT | 200 | real (uncached) AI generations per UTC day across all users; over it ⇒ the "daily AI allowance is used up" error. DB-backed (migration 0005) when Supabase is configured |
| ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY / OLLAMA_BASE_URL | — | credentials per provider; missing key ⇒ mock fallback + warning log |
| GUARDIAN_API_KEY | — | Guardian Open Platform developer key for `sync_knowledge` (RAG, see docs/RAG.md). Missing ⇒ the job skips and `/ask` answers from FootIQ data alone. Worker secret |
| EMBED_MODEL | gemini-embedding-001 | embedding model (uses GEMINI_API_KEY). Changing it means re-embedding `kb_chunks` |
| UPSTASH_REDIS_REST_URL + _TOKEN | — | shared cache/rate-limit backend; unset ⇒ in-memory (remote backends get a 30s memory front) |
| DATA_PROVIDER | demo | football-data · api-football · demo — live football data source |
| FOOTBALL_DATA_API_KEY / FOOTBALL_DATA_COMPETITION | — / PL | football-data.org (free 10 req/min; attribution required) |
| API_FOOTBALL_KEY / API_FOOTBALL_LEAGUE | — / 39 | api-sports.io (free 100 req/day; league 39 = Premier League) |
| SYNC_ENABLED / SYNC_INTERVAL_MINUTES | false / 30 | Node-runtime sync loop (Workers use the wrangler cron instead) |
| IP_HASH_SALT | dev value | REQUIRED to change in prod — salts IP hashes in logs/audit |
| RATE_LIMIT_DISABLED | false | tests only |
| TRUST_PROXY | false | Node behind a reverse proxy: client IP = rightmost X-Forwarded-For entry. Unset = socket peer. Ignored on Workers (cf-connecting-ip) |
| RATE_LIMIT_API/_WRITES/_AUTH/_AI/_FORMS | presets | per-scope requests/minute overrides |
| SENTRY_DSN | — | reserved hook for the error-reporter adapter |
| FLAG_* | — | e.g. `FLAG_AI_SCOUT=false` — ops kill-switch, beats DB and defaults |

## Mode matrix

| Config present | You get |
|---|---|
| nothing | full demo: bundled data, mock AI, guest-only, memory cache |
| + VITE_API_URL | frontend hydrates from API (still demo data server-side) |
| + Supabase (both sides) | real accounts, saved data, quotas, admin, audit |
| + ANTHROPIC_API_KEY & AI_PROVIDER=claude | real scout reports/analysis (cached) |
| + Upstash | cache/limits survive restarts and scale past one instance |
| + FOOTBALL_DATA_API_KEY & DATA_PROVIDER=football-data (+cron) | real standings/fixtures merged into the catalog, meta.source="provider" |
