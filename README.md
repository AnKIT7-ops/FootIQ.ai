# FootIQ — Football Intelligence Platform

An AI-powered football operating system: live match intelligence, scouting, tactics, predictions, fantasy and history — not another scores site.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run preview  # serve the production build
```

Works fully offline with bundled demo data. To run against the API backend:

```bash
cd server && npm install && cp .env.example .env && npm run dev   # API on :8787
# repo root: echo VITE_API_URL=http://localhost:8787 > .env.local, then npm run dev
```

## Backend (Phase 2)

Production foundation lives alongside the app — Hono API (`server/`), Supabase schema (`supabase/migrations/`), shared contracts (`shared/`), all free-tier deployable. The frontend gracefully falls back to demo data whenever the backend is absent. Start with [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); the full set: API reference, database schema, environment variables, deployment, security checklist, testing strategy, onboarding, tech debt, Phase 3 plan — all in [`docs/`](docs/).

## Stack

- **Vite 7 + React 19 + TypeScript** (strict)
- **Tailwind CSS v4** — CSS-first tokens in `src/styles/global.css`
- **react-router 7** — 16 routes, lazy-loaded pages
- **motion** (Framer Motion) — page transitions & micro-interactions
- **Hand-rolled SVG charts** — radar, momentum river, pitch/heatmap/shot/pass maps, gauges (no chart lib)
- All stats/text data is local demo data (`src/data/`) — no APIs, no keys
- **Real imagery** (club crests via FotMob CDN, player portraits from the Premier League CDN via the FPL sync, flags via flagcdn) with automatic fallback to generated SVG crests / initials when offline — `src/data/images.ts`

## Design system

"Floodlit night": deep indigo surfaces, chalk-white type. Two semantic accents:

- **Emerald** = measured fact (live scores, stats)
- **Amber "IQ"** = model inference (every AI element wears it — `IQInsight` / `IQTag`)

Type: Archivo (display, expanded width), Instrument Sans (body), IBM Plex Mono (data). Dark default, light theme via toggle (`.light` on `<html>`). Chart palette validated for colorblind separation and contrast on both surfaces.

## Pages

Home dashboard · Live Match Center (`/match/:id`) · News + article (30-second AI summaries, reliability scores) · Player profiles (`/player/:id`) · Similar Players · Compare (players / teams / managers) · Team pages (`/team/:id`) · Transfer Center · AI Predictions · AI Scout (natural-language search, voice input) · Tactical Board (drag-and-drop + AI feedback) · Fantasy Assistant · Highlights · Historical Explorer · Profile.

Global: universal search (Ctrl+K), AI concierge chat dock, notifications, theme toggle, mobile bottom nav, reduced-motion support.

## Dev scripts

`scripts/verify.mjs` — headless (Edge via puppeteer-core) screenshot + console-error + overflow sweep across every route. Requires `npm run dev` running.
