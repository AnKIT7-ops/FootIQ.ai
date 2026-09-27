# FootIQ Database Schema (Supabase Postgres)

Apply: paste `supabase/migrations/0001_init.sql` into the Supabase SQL editor (or `supabase db push`). Everything is idempotent-per-fresh-project; version future changes as `0002_*.sql` etc.

## Principles
- **RLS on every table, fail closed.** User tables: owner-only policies on `auth.uid()`. Server-written tables (audit, flags, newsletter): NO client policies at all — invisible to anon/authenticated keys; only the API's service role touches them.
- **Privilege comes from the server, never the client.** `profiles.role/plan` are protected by column-level grants (clients literally cannot UPDATE them), and set only via the API/admin.
- **No raw IPs anywhere** — audit rows store `sha256(ip+salt)`.
- **Timestamps:** `timestamptz` UTC; `updated_at` maintained by trigger.

## Tables

| Table | Purpose | Key structure & indexes |
|---|---|---|
| profiles | 1:1 with auth.users (auto-created by trigger on signup, incl. anonymous) | PK=auth.users.id; role/plan CHECK-constrained |
| favorites | followed teams/players | UNIQUE(user,kind,ref); idx (user,kind) |
| bookmarks | saved news/matches/players/teams | UNIQUE(user,kind,ref); idx (user, created desc) |
| notifications | in-app inbox | partial idx on unread (user, created desc) WHERE read_at IS NULL |
| tactical_boards | saved boards (state JSONB ≤64KB) | idx (user, updated desc) |
| saved_comparisons | comparison sets (2–4 player ids) | idx (user, created desc) |
| prediction_history | probability snapshot per user+match, settled later | UNIQUE(user,match) |
| search_history | recent queries | idx (user, created desc) |
| newsletter_subscribers | waitlist/newsletter; regex-validated email | UNIQUE(email); partial idx active |
| feedback | user feedback w/ moderation status | idx (status, created desc) |
| feature_requests | public roadmap items + votes | idx (status, votes desc) |
| user_settings | typed prefs + extras JSONB (≤16KB) | PK=user_id |
| feature_flags | runtime flags (+rollout_pct 0-100) | PK=key; seeded with 8 flags |
| usage_quotas | per-user per-day metering | PK(user,metric,day) |
| global_quotas | app-wide per-day metering (AI generation ceiling), service role only | PK(metric,day) |
| audit_logs | append-only security/admin trail | identity PK; idx (actor, created), (action, created) |

## Functions
- `handle_new_user()` — trigger on auth.users insert → provisions profile row (security definer).
- `increment_quota(user, metric, limit) → int` — atomic check-and-increment, returns -1 when over limit; EXECUTE revoked from client roles (server-only RPC).
- `increment_global_quota(metric, limit) → int` — same contract on `global_quotas` (migration 0005); backs `AI_GLOBAL_DAILY_LIMIT`.
- `set_updated_at()` — shared updated_at trigger.

## Post-migration checklist (Supabase dashboard)
1. Auth → Providers: enable Email (OTP/magic link), Google (add OAuth client), Anonymous sign-ins.
2. Auth → URL config: site URL + redirect URLs (localhost:5173 + prod domain).
3. Storage: create buckets `avatars`, `boards`, `exports` (private; API serves signed URLs).
4. Settings → API: copy URL + anon key (frontend) and service_role key (server env only).
5. To make yourself admin: `update profiles set role='admin' where id='<your uid>';` then mirror into JWT claims via Auth hook (or re-login) — the API reads `app_metadata.role`.
