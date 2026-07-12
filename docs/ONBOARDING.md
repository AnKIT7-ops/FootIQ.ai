# Developer Onboarding

## Day one (10 minutes, zero accounts needed)
```sh
git clone <repo> && cd FootIQ.ai
npm install
cd server && npm install && cp .env.example .env && npm run dev   # API :8787 (demo mode)
# new terminal, repo root:
echo VITE_API_URL=http://localhost:8787 > .env.local
npm run dev                                                        # app :5173
```
Open http://localhost:5173 — everything works: bundled dataset, mock AI, guest mode. The demo IS the fallback tier of production, so what you see offline is exactly what users get if every provider goes down.

## Mental model (read in this order)
1. `docs/ARCHITECTURE.md` — the layer map and the five load-bearing decisions.
2. `shared/contracts.ts` — every type that crosses the wire.
3. `src/lib/repositories/store.ts` + `players.ts` — how the frontend gets data (10 min read, the other 8 repos are the same pattern).
4. `server/src/app.ts` — middleware order + dependency container.
5. One vertical slice: `routes/ai.ts` → `ai/service.ts` → `ai/prompts/index.ts` → `ai/providers/claude.ts`.

## House rules
- Pages/components import data from `@/lib/repositories/*`, never `@/data/*` (CI guard: `npm run check:imports`). `@/data/types`, `@/data/images`, `@/data/generators` are fine anywhere.
- Server code never reads `process.env` — add to `config/env.ts` schema instead.
- Routes: throw `ApiError` for expected failures; never `c.json()` an error by hand.
- Prompts only in `server/src/ai/prompts/` — bump `version` when editing (auto-invalidates cached generations).
- Every new table ships with RLS in the same migration.
- Design system: "floodlit night" — emerald = measured fact, amber = AI inference (`IQInsight`/`IQTag` for model output). Preserve it.

## Commands cheat sheet
| Where | Command | Does |
|---|---|---|
| root | `npm run dev` / `build` / `preview` | Vite app |
| root | `npm run verify` | import guard + 28-route headless walk (needs dev server + Edge) |
| root | `npm run check:imports` | architecture guard only |
| server | `npm run dev` | API with watch reload |
| server | `npm test` / `npm run typecheck` | vitest 34 tests / strict tsc |
| server | `npm run deploy:workers` | wrangler deploy |

## Enabling real services locally
See `docs/ENVIRONMENT.md` mode matrix. Typical next step: create a free Supabase project, run the migration (`docs/DATABASE.md`), fill both env files — accounts and saved data light up; nothing else changes.
