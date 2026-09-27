# Deployment Guide (free tier end-to-end)

Total monthly cost target: **$0** until validated demand.

## Live deployment (since 2026-07-12)

| Piece | URL / state |
|---|---|
| Frontend | https://footiq-omega.vercel.app (Vercel project `footiq`, SPA rewrites via vercel.json) |
| API | https://footiq-api.footiq.workers.dev (Workers, demo mode, cron */30 for sync jobs) |
| GitHub | https://github.com/AnKIT7-ops/FootIQ.ai (private) |
| Supabase / AI keys / Upstash | not yet configured — demo tier serving (see step 1 + ENVIRONMENT.md mode matrix) |

Env wiring: Vercel prod has `VITE_API_URL` + `VITE_SITE_URL`; worker `[vars]` carries `CORS_ORIGINS` (Vercel domain + localhost).

## 1. Database — Supabase (free: 500MB, 50k MAU auth)
1. Create project → SQL editor → run `supabase/migrations/0001_init.sql`.
2. Follow the post-migration checklist in `docs/DATABASE.md` (providers, redirect URLs, buckets).
3. Collect: project URL, anon key, service_role key.

## 2. Cache — Upstash Redis (free: 500k commands/month) — optional but recommended
Create a Redis database → copy REST URL + token. Skip for a single-instance beta; in-memory works.

## 3. API — pick one free host

**Cloudflare Workers (recommended: 100k req/day, no cold-sleep)**
```sh
cd server
npx wrangler login
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put ANTHROPIC_API_KEY        # if using Claude
npx wrangler secret put IP_HASH_SALT             # long random string
# non-secret vars (CORS_ORIGINS, AI_PROVIDER, AI_MODEL) → [vars] in wrangler.toml
npx wrangler deploy
```
Optional KV cache: `npx wrangler kv namespace create CACHE` → uncomment the binding in `wrangler.toml`.

**After the first deploy, merges deploy themselves.** `.github/workflows/deploy-worker.yml` runs typecheck → tests → `wrangler deploy` on every push to `main`, the same moment Vercel ships the site. It needs two repo secrets (Settings → Secrets and variables → Actions): `CLOUDFLARE_API_TOKEN` (dashboard → My Profile → API Tokens → "Edit Cloudflare Workers" template) and `CLOUDFLARE_ACCOUNT_ID`. Worker secrets set with `wrangler secret put` persist across deploys. Manual deploys still work; run one from an up-to-date `main` only.

**Render / Railway (Node)**
- Root directory `server`, build `npm install`, start `npm run start` (or `npx tsx src/index.ts`).
- Set env vars from `server/.env.example`. Render free sleeps after idle — first request is slow; the frontend's demo fallback masks it.

## 4. Frontend — Vercel (free)
- Import repo, framework Vite, defaults are fine.
- Env vars: `VITE_API_URL=https://<your-api>`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- SPA rewrite: all routes → `/index.html` (Vercel auto-handles Vite SPAs; if 404s appear add a rewrite rule).
- Then set the API's `CORS_ORIGINS` to the Vercel domain(s), comma-separated, and redeploy the API.

## 5. Post-deploy smoke test
```sh
curl https://<api>/api/health          # mode:"database", aiProvider as configured
curl https://<api>/api/players | head  # ok:true
# in the browser: app loads, DevTools network shows /api/* 200s, no CORS errors
```

## Local development
```sh
npm install && (cd server && npm install)
cd server && cp .env.example .env && npm run dev     # API on :8787
# second terminal (repo root):
echo VITE_API_URL=http://localhost:8787 >> .env.local
npm run dev                                          # app on :5173
npm run verify                                       # import guard + 28-route walk
```

## CI outline (add when a repo host is chosen)
build+typecheck (root `npm run build`), server `npm run typecheck && npm test`, `npm run check:imports`. All three are already single commands.
