# Data Platform (Phase 4)

Real football data behind the same shapes the product has always served. Zero env vars still means a fully working demo; each provider/key upgrades one slice independently.

## Provider abstraction

```
FootballDataProvider (interface, server/src/providers/types.ts)
├── FootballDataOrgProvider   football-data.org v4 · free 10 req/min · standings + fixtures
├── ApiFootballProvider       api-sports.io v3 · free 100 req/day · standings + fixtures
├── DemoProvider              bundled dataset through the same contract (always available)
└── MockProvider              test double with injectable fixtures
```

- Selected by `DATA_PROVIDER`; a selected-but-keyless provider degrades to demo with a boot warning (never a crash).
- Providers return **normalized slices** (`NormalizedTeamStanding`, `NormalizedMatch`) — never raw vendor payloads. Raw payloads are zod-validated first, so vendor schema drift fails the sync loudly instead of writing garbage.
- Providers are partial by design: free tiers know tables and fixtures, not xG/attributes. What a provider doesn't know stays demo/derived.

**Legal:** football-data.org free tier requires attribution ("Football data provided by the Football-Data.org API") — add to the site footer when the provider goes live. API-Football free tier is non-commercial; upgrade the plan before monetization (Phase 5 checklist item).

## Pipeline

```
FETCH        provider.fetchStandings()/fetchMatches()      (network, keyed)
VALIDATE     zod on the raw vendor payload                 (schema drift → ProviderError)
NORMALIZE    provider maps raw → normalized slices
MERGE        jobs/normalize.ts overlays onto the catalog model:
               name/TLA-matched demo team  → keeps identity+squad, takes provider numbers
               unknown provider team       → full Team synthesized (deterministic dials)
               matches                     → team refs resolved, unresolvable sides skipped
CACHE+DB     SnapshotStore: cache (24h TTL) + catalog_snapshots JSONB row   (migration 0002)
API          CatalogService: snapshot → demo fallback, per-response meta.source
FRONTEND     repositories hydrate as always — no frontend changes required
```

Every stage is independent: a failed fetch keeps the last snapshot; a missing DB keeps the cache copy; a missing everything keeps demo.

## Cache strategy (multi-layer)

```
request → TieredCache memory front (30s) → Upstash Redis / Cloudflare KV → Supabase (snapshots) → external API (jobs only)
```

- `TieredCache` fronts any remote backend; `increment()` (rate limiting) always goes to the shared back.
- TTLs per data class in `cache/types.ts` (`TTL`): matches 60s · news 5m · transfers 10m · search 10m · players/teams 6h · history 24h · AI per task (scout 24h). Snapshots 24h — sync jobs overwrite in place.
- Live requests **never** call external providers; only jobs do. Free-tier API quotas are therefore a cron-frequency concern, not a traffic concern.

## Background jobs

Registry: `server/src/jobs/registry.ts` — retry ×3 with exponential backoff, overlap guard, run records to cache (`/health`, `/api/admin/jobs`) and the `job_runs` table.

| Job | What | Trigger |
|---|---|---|
| sync_standings | provider table → teams snapshot | cron |
| sync_fixtures | ±7/14-day match window → matches snapshot | cron |
| warm_ai_reports | top-5 player scout reports pre-generated into AI cache | cron |

Triggers: Workers cron (`wrangler.toml [triggers] crons = ["*/30 * * * *"]`) → `scheduled` handler; Node runtime uses `SYNC_ENABLED=true` + `SYNC_INTERVAL_MINUTES`. Manual: `POST /api/admin/jobs/:name/run`.

## AI enrichment

Raw numbers never ship alone: every AI task explains its reasoning by prompt design (registry instructs structure + "ground every claim"), the content engine articles carry sources (`AIMeta`), and recommendations return a `reason` per item. Enrichment tasks map 1:1 to synced data via `aiTaskHint` (see GROWTH.md).

## MLOps foundation

- **Prompt versioning:** registry versions participate in AI cache keys; bumping invalidates stale generations. `promptCatalog` = admin-visible inventory (`GET /api/admin/prompts`).
- **A/B experiments:** `promptVariants` (versions 100+) selected per-user by the `prompt_experiments` flag rollout percentage — deterministic cohorts, cache-isolated, response reports `promptVersion` for measurement.
- **Evals:** `ai/evals/golden.json` + `evals.test.ts` — offline gate asserts prompts stay grounded/structured (runs in CI); `EVAL_LIVE=1` scores real completions before shipping prompt changes.
- **Model switching:** `AI_PROVIDER`/`AI_MODEL` env — config, not code.

## API versioning

Everything mounts at `/api` **and** `/api/v1` (aliases today). External integrations should use `/api/v1`; breaking changes will mount `/api/v2` while v1 keeps serving. `/api/health` reports `apiVersion`.

## New endpoints (Phase 4)

| Method | Path | Notes |
|---|---|---|
| GET | /api/search/suggest?q= | autocomplete (players/teams/managers), word-prefix, 8 results |
| GET | /api/recommendations/articles/:id | related articles + reason |
| GET | /api/recommendations/comparisons/:id | comparison suggestions + reason |
| GET | /api/recommendations/teams?favorites=a,b | style-similar teams + reason |
| GET | /api/export/players/:id · /teams/:id · /predictions/:id · /comparison?ids= | JSON report downloads (PNG = client share cards, PDF = print pipeline) |
| GET | /api/admin/jobs · POST /api/admin/jobs/:name/run | job monitoring / manual trigger |
| POST | /api/admin/cache/purge | `{target: teams\|matches\|flags}` |
| GET | /api/admin/providers · /api/admin/prompts | provider status / prompt inventory |

Health v2 (`/api/health`): mode, aiProvider, dataProvider(+availability), cache backend, last job runs, apiVersion.
