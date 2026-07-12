# FootIQ API Reference

Base URL: `http://localhost:8787` (dev) · your Workers/Render URL (prod).
Every response is the shared envelope from `shared/contracts.ts`:

```jsonc
{ "ok": true,  "data": …, "meta": { "source": "demo", "requestId": "…" } }
{ "ok": false, "error": { "code": "not_found", "message": "…", "details": {…} } }
```

Auth: `Authorization: Bearer <supabase access token>`. Guests can read the catalog; anything user-owned or AI-metered needs a session (anonymous Supabase sessions count).

Headers returned: `X-Request-Id`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After` (on 429).

## Meta
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/health | — | mode (demo/database), AI provider, uptime |
| GET | /api/flags | — | effective flags for caller (env > DB > defaults, rollout applied) |

## Catalog (public reads, 300/min global limit)
| Method | Path | Notes |
|---|---|---|
| GET | /api/players | full player list |
| GET | /api/players/:id | 404 envelope if unknown |
| GET | /api/players/:id/similar | similar-player list |
| GET | /api/teams · /api/teams/table · /api/teams/:id · /api/teams/:id/players | |
| GET | /api/matches | `{ live, upcoming, finished }` |
| GET | /api/matches/:id | full MatchDetail |
| GET | /api/news · /api/news/:id | |
| GET | /api/transfers | trending rumours |
| GET | /api/predictions · /api/predictions/:id | `:id` = match id |
| GET | /api/clips · /api/history · /api/fantasy | |
| GET | /api/search?q= | global search (players/teams/news), cached 10 min |

## AI (auth + 10/min + daily quota by plan; `ai_scout` flag gates all)
| Method | Path | Body |
|---|---|---|
| POST | /api/ai/scout/:id/report | — |
| POST | /api/ai/news/:id/summary | — |
| POST | /api/ai/transfers/:id/analysis | — |
| POST | /api/ai/predictions/:id/explanation | — |
| POST | /api/ai/fantasy/advice | `{ question }` |
| POST | /api/ai/tactics/feedback | `{ formation, teamId?, notes? }` |
| POST | /api/ai/compare | `{ playerIds: [2..4] }` |

Responses: `AiResult` `{ task, text, provider, model, cached, generatedAt }`. Identical inputs are served from cache (per prompt version + provider) — regeneration doesn't burn quota upstream.

## Auth (10/min)
| Method | Path | Notes |
|---|---|---|
| GET | /api/auth/me | `{ user: SessionUser | null }` from bearer token |
| POST | /api/auth/session | call once after sign-in; audit log + future welcome email |

Sign-in itself is browser ⇄ Supabase (email OTP, Google OAuth, anonymous). The server only verifies JWTs (JWKS or HS256) — it never sees credentials.

## User data (auth required; 503 `service_unavailable` in demo mode)
| Method | Path | Body |
|---|---|---|
| GET | /api/users/profile | — |
| PATCH | /api/users/profile | `{ displayName?, favoriteTeam?, country? }` |
| GET/PUT/DELETE | /api/users/favorites | `{ kind: team\|player, refId }` |
| GET/PUT | /api/users/bookmarks | `{ kind, refId }` |
| DELETE | /api/users/bookmarks/:id | — |
| GET/PUT | /api/users/boards | `{ id?, name, formation, state }` — plan-limited |
| DELETE | /api/users/boards/:id | — |
| GET/POST | /api/users/comparisons | `{ playerIds, note? }` — plan-limited |
| DELETE | /api/users/comparisons/:id | — |
| GET/PATCH | /api/settings | `{ theme?, language?, emailNews?, emailMatchAlerts? }` |
| GET | /api/notifications?unread=true | — |
| POST | /api/notifications/read | `{ ids: [...] }` |

## Community (public, 5/min per identity)
| Method | Path | Body |
|---|---|---|
| POST | /api/newsletter/subscribe | `{ email, source? }` |
| POST | /api/newsletter/unsubscribe | `{ email }` |
| POST | /api/feedback | `{ message, category?, email?, page? }` |
| POST | /api/feature-requests | `{ title, description? }` |

## Admin (role=admin + `admin_tools` flag + DB required)
| Method | Path | Notes |
|---|---|---|
| GET | /api/admin/stats | counts overview |
| GET | /api/admin/users?cursor= | cursor-paginated (50/page) |
| PATCH | /api/admin/users/:id | `{ role?, plan? }` — audited |
| GET | /api/admin/feedback?status= | moderation queue |
| PATCH | /api/admin/feedback/:id | `{ status }` — audited |
| GET | /api/admin/newsletter | subscriber list |
| GET | /api/admin/flags | flag table |
| PATCH | /api/admin/flags/:key | `{ enabled?, rolloutPct? }` — audited, cache-busted |

## Error codes
`bad_request 400 · validation_failed 422 (+details) · unauthorized 401 · forbidden 403 · not_found 404 · rate_limited 429 · quota_exceeded 429 · payload_too_large 413 · conflict 409 · upstream_error 502 · internal_error 500 · service_unavailable 503`
