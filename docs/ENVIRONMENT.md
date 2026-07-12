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
| ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY / OLLAMA_BASE_URL | — | credentials per provider; missing key ⇒ mock fallback + warning log |
| UPSTASH_REDIS_REST_URL + _TOKEN | — | shared cache/rate-limit backend; unset ⇒ in-memory |
| IP_HASH_SALT | dev value | REQUIRED to change in prod — salts IP hashes in logs/audit |
| RATE_LIMIT_DISABLED | false | tests only |
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
