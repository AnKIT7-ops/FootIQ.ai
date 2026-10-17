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

### Request budgets and API caching (checked Oct 2026)
- **Vercel Hobby is the first wall, not the Worker.** Hobby includes 1,000,000 CDN Requests per *month* (~33k/day), and every request counts — HTML, each JS/CSS/font asset, cache hits included; going over means waiting out 30 days ([Hobby plan](https://vercel.com/docs/plans/hobby), [CDN usage](https://vercel.com/docs/manage-cdn-usage)). A first visit costs ~12–15 Vercel requests vs ~5 Worker requests per *session* (repositories hydrate once per app load), against the Worker's 100k/*day*.
- **So `/api` is NOT proxied through Vercel.** An external rewrite would be CDN-cached ([rewrites](https://vercel.com/docs/routing/rewrites#caching-rewrites-to-external-origins)), but every proxied call — hit or miss — would move from the 100k/day Worker budget to the 1M/month Vercel one. Revisit only on Vercel Pro. Prerequisites then: a rewrite `{"source": "/api/:path*", "destination": "https://footiq-api.footiq.workers.dev/api/:path*"}` placed before the SPA catch-all, a same-origin API base in `src/lib/config.ts`, and rate limiting keyed on a client IP that Vercel forwards. That IP must be authenticated with an origin-secret header: behind a proxy, `cf-connecting-ip` is Vercel's egress IP, so every visitor would share one bucket.
- **Cloudflare-side caching does not save Worker requests.** The Cache API runs inside the Worker, and [Workers Cache](https://developers.cloudflare.com/workers/cache/) bills cache hits as requests.
- The API is CDN-ready anyway. Public catalog GETs send `public, max-age=N, s-maxage=N, stale-while-revalidate=N, stale-if-error=86400` (via `publicCache()`), and everything else gets `private, no-store` (the default-deny middleware in `server/src/app.ts`). That covers user, AI, admin, export, writes, preflights and any 4xx/5xx.

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
