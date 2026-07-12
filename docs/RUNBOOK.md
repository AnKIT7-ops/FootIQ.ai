# Runbook — incident recovery

First move in every incident: `GET /api/health` — it names the mode, data provider (+availability), cache backend, AI provider and last job runs.

## Symptoms → actions

**Site up, data looks stale**
1. `/api/health` → check `jobs[]` timestamps and statuses.
2. Failed runs: `GET /api/admin/jobs` for the error detail (schema drift shows the zod path; HTTP 429 = provider quota).
3. Manual retry: `POST /api/admin/jobs/sync_standings/run` (then sync_fixtures).
4. Still failing: set `DATA_PROVIDER=demo` and redeploy — product stays fully functional on demo tier while you investigate. Nothing else changes.

**Provider quota exhausted (429 in job detail)**
Lower the cron frequency (wrangler.toml) or switch provider (`DATA_PROVIDER=api-football` ↔ `football-data`). Quotas are consumed by jobs only — user traffic is never the cause.

**Wrong/garbage synced data visible**
`POST /api/admin/cache/purge {"target":"teams"}` (and `matches`) → next request reads DB snapshot; if the DB row is also bad, run the sync jobs after fixing the provider, or flip to demo. Snapshot rows are disposable — deleting from `catalog_snapshots` is always safe.

**AI endpoints erroring/expensive**
Kill switch without deploy: env `FLAG_AI_SCOUT=false` (or DB flag via `PATCH /api/admin/flags/ai_scout`). Provider swap: `AI_PROVIDER=mock` keeps the product interactive at zero cost.

**Cache backend down (Upstash outage)**
API keeps serving (tiered memory front + demo fallback). Rate limiting degrades per-instance. If prolonged: unset `UPSTASH_*` and redeploy → pure memory mode.

**Database down**
All catalog reads fall back to cache→demo automatically; user-data endpoints return 503 `service_unavailable` by design. No action required beyond Supabase status watching; nothing corrupts.

**Leaked secret (service key / AI key / salt)**
1. Rotate at the source (Supabase dashboard / provider console).
2. `wrangler secret put <NAME>` with the new value (or host env), redeploy.
3. Supabase service key: also verify RLS wasn't touched — `select * from pg_policies` count should match migrations.
4. Audit trail: `audit_logs` table records admin actions with hashed IPs.

**Roll back a bad deploy**
Workers: `npx wrangler rollback`. Vercel: promote previous deployment in the dashboard. DB migrations are additive-only so old code runs against new schema.

## Routine ops

- **Weekly:** glance at `/api/admin/jobs` (or health) — three green jobs, done.
- **Prompt changes:** run `EVAL_LIVE=1 npm test` in server/ against the real provider before shipping; version bump invalidates caches.
- **Prune job history:** `delete from job_runs where ran_at < now() - interval '30 days';`
