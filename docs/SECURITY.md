# Security Checklist

## Implemented

**Transport & headers**
- [x] Secure headers on every response (nosniff, frame-deny, CSP `default-src 'none'` — pure JSON API renders nothing).
- [x] CORS: explicit env-driven origin allowlist; unknown origins get no ACAO header; no wildcard.
- [x] 256KB body cap ahead of JSON parsing (cheap DoS guard).

**Authentication & authorization**
- [x] Supabase JWT verified locally (jose): JWKS (RS/ES256) for new projects, HS256 secret for legacy. Forged/expired tokens → anonymous, protected routes fail closed (401/403) — covered by tests.
- [x] Passwords never touch our server (browser ⇄ Supabase; OTP/OAuth/anonymous only).
- [x] Role checks server-side from verified claims; admin surface additionally behind the `admin_tools` flag (defense in depth vs leaked admin token).
- [x] RLS on every table; server-written tables have no client policies at all; `profiles.role/plan` protected by column-level grants.

**Input handling**
- [x] zod validation on body/query/params at every boundary → 422 with field details.
- [x] Sanitization before storage (control chars stripped, length caps); SQLi prevented by PostgREST parameterization; XSS by React escaping + inert stored data.
- [x] Route ids constrained to `[\w.-]{1,64}` — no traversal/injection surface.
- [x] User free-text only ever enters AI prompts in the user turn, never the system prompt (prompt-injection containment).

**Abuse & rate limiting**
- [x] Layered fixed-window limits on the shared cache: global 300/min, writes 60/min, auth 10/min, AI 10/min, public forms 5/min — keyed by user id or salted-hash IP. 429 + Retry-After. Tested.
- [x] Daily quotas per plan on AI (atomic Postgres RPC; fail closed on DB error).

**Secrets & data hygiene**
- [x] All secrets in env, validated at boot; frontend holds only public VITE_ values; service-role key server-only.
- [x] Raw IPs never stored/logged — `sha256(ip+salt)` only. Email bodies (reset/magic links) never logged; recipient addresses masked.
- [x] Error responses are opaque envelopes; internals go to logs/reporter only.
- [x] Audit trail (append-only) for logins, admin actions, denials.

**CSRF strategy (documented decision)**
The API is bearer-token only — no cookies, so classic CSRF doesn't apply (browsers can't attach the token cross-site). IF cookie sessions are ever introduced: SameSite=Strict + HttpOnly + Secure, plus Origin verification on state-changing routes, plus hono/csrf. Until then, adding CSRF tokens would be security theater.

## Before public launch (ordered)
1. Set a strong `IP_HASH_SALT`; rotate any keys ever pasted into chats/CI logs.
2. Turn on Supabase auth protections: email OTP expiry ≤1h, captcha on auth, leaked-password protection.
3. `npm audit` gate in CI + Dependabot/Renovate (lockfiles already pinned).
4. Add Sentry (adapter seam exists: `createErrorReporter`).
5. Cloudflare in front of the API (already true on Workers): bot fight mode, WAF managed rules.
6. Review CORS_ORIGINS lists only prod domains (no localhost in prod config).
7. Pen-test pass over admin endpoints with a non-admin token (tests cover the basics).
