-- ============================================================================
-- FootIQ — initial schema
-- Target: Supabase (Postgres 15+). Apply via `supabase db push` or SQL editor.
--
-- Conventions
--   * Every user-owned table has RLS ON with owner-only policies (fail closed).
--   * `auth.users` is Supabase-managed; `profiles` extends it 1:1.
--   * Timestamps are timestamptz, UTC.
--   * Service-role key (server only) bypasses RLS by design — the API server
--     still scopes queries by user id; RLS is defense in depth, not the only
--     gate.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- profiles — 1:1 with auth.users; role/plan live here (never client-writable)
-- ----------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text check (char_length(display_name) <= 60),
  avatar_url    text check (avatar_url is null or avatar_url ~ '^https://'),
  role          text not null default 'user'  check (role in ('user','admin')),
  plan          text not null default 'free'  check (plan in ('free','pro','club')),
  favorite_team text,
  country       text check (country is null or char_length(country) = 2),
  is_anonymous  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-provision a profile on signup (works for anonymous sign-ins too).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, is_anonymous)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.is_anonymous, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);
-- role/plan are excluded from updates via a column grant, not just RLS:
revoke update on public.profiles from authenticated;
grant  update (display_name, avatar_url, favorite_team, country)
  on public.profiles to authenticated;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- favorites — teams/players a user follows
-- ----------------------------------------------------------------------------

create table public.favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('team','player')),
  ref_id     text not null,          -- domain id (e.g. 'liverpool', 'p-salah')
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);
create index idx_favorites_user on public.favorites (user_id, kind);

alter table public.favorites enable row level security;
create policy "favorites: crud own" on public.favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- bookmarks — saved news/matches/players/teams
-- ----------------------------------------------------------------------------

create table public.bookmarks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('news','match','player','team')),
  ref_id     text not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);
create index idx_bookmarks_user on public.bookmarks (user_id, created_at desc);

alter table public.bookmarks enable row level security;
create policy "bookmarks: crud own" on public.bookmarks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- notifications — in-app inbox (email/push fan-out handled by the API)
-- ----------------------------------------------------------------------------

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('system','match','transfer','ai')),
  title      text not null check (char_length(title) <= 140),
  body       text not null check (char_length(body) <= 2000),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
-- partial index: the hot query is "unread for user", keep it tiny
create index idx_notifications_unread on public.notifications (user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;
create policy "notifications: read own" on public.notifications
  for select using (auth.uid() = user_id);
create policy "notifications: mark own read" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- inserts come from the server (service role) only — no insert policy.

-- ----------------------------------------------------------------------------
-- tactical_boards — saved boards from the tactics editor
-- ----------------------------------------------------------------------------

create table public.tactical_boards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  formation  text not null,
  state      jsonb not null default '{}'::jsonb check (pg_column_size(state) < 65536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_boards_user on public.tactical_boards (user_id, updated_at desc);
create trigger trg_boards_updated before update on public.tactical_boards
  for each row execute function public.set_updated_at();

alter table public.tactical_boards enable row level security;
create policy "boards: crud own" on public.tactical_boards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- saved_comparisons — player comparison sets
-- ----------------------------------------------------------------------------

create table public.saved_comparisons (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  player_ids text[] not null check (array_length(player_ids, 1) between 2 and 4),
  note       text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index idx_comparisons_user on public.saved_comparisons (user_id, created_at desc);

alter table public.saved_comparisons enable row level security;
create policy "comparisons: crud own" on public.saved_comparisons
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- prediction_history — user's viewed/locked predictions for later accuracy UX
-- ----------------------------------------------------------------------------

create table public.prediction_history (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  match_id     text not null,
  snapshot     jsonb not null,      -- probabilities at the time the user saw them
  outcome      text check (outcome in ('home','draw','away')),
  settled_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (user_id, match_id)
);
create index idx_pred_history_user on public.prediction_history (user_id, created_at desc);

alter table public.prediction_history enable row level security;
create policy "prediction_history: crud own" on public.prediction_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- search_history — recent searches (client may also keep localStorage copy)
-- ----------------------------------------------------------------------------

create table public.search_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  query      text not null check (char_length(query) between 1 and 120),
  created_at timestamptz not null default now()
);
create index idx_search_history_user on public.search_history (user_id, created_at desc);

alter table public.search_history enable row level security;
create policy "search_history: crud own" on public.search_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- newsletter_subscribers — waitlist + newsletter (no auth required)
-- ----------------------------------------------------------------------------

create table public.newsletter_subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique
                  check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' and char_length(email) <= 254),
  source          text not null default 'waitlist' check (source in ('waitlist','footer','settings')),
  confirmed_at    timestamptz,
  unsubscribed_at timestamptz,
  created_at      timestamptz not null default now()
);
create index idx_newsletter_active on public.newsletter_subscribers (created_at)
  where unsubscribed_at is null;

alter table public.newsletter_subscribers enable row level security;
-- Writes go through the API (service role) so rate limiting + validation apply.
-- No anon policies: the table is invisible to client keys (fail closed).

-- ----------------------------------------------------------------------------
-- feedback + feature_requests
-- ----------------------------------------------------------------------------

create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete set null,
  email      text check (email is null or email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  category   text not null default 'general' check (category in ('general','bug','data','ai')),
  message    text not null check (char_length(message) between 3 and 4000),
  page       text,
  status     text not null default 'new' check (status in ('new','triaged','resolved','spam')),
  created_at timestamptz not null default now()
);
create index idx_feedback_status on public.feedback (status, created_at desc);

alter table public.feedback enable row level security;
create policy "feedback: read own" on public.feedback
  for select using (auth.uid() = user_id);
-- inserts via API only (service role) so we can rate limit + sanitize.

create table public.feature_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (id) on delete set null,
  title       text not null check (char_length(title) between 3 and 120),
  description text check (char_length(description) <= 4000),
  votes       integer not null default 1 check (votes >= 0),
  status      text not null default 'open'
              check (status in ('open','planned','building','shipped','declined')),
  created_at  timestamptz not null default now()
);
create index idx_feature_requests_status on public.feature_requests (status, votes desc);

alter table public.feature_requests enable row level security;
create policy "feature_requests: read all" on public.feature_requests
  for select using (true);   -- public roadmap
-- writes via API only.

-- ----------------------------------------------------------------------------
-- user_settings — key/value with typed columns for the common ones
-- ----------------------------------------------------------------------------

create table public.user_settings (
  user_id            uuid primary key references public.profiles (id) on delete cascade,
  theme              text not null default 'dark' check (theme in ('dark','light','system')),
  language           text not null default 'en' check (char_length(language) <= 8),
  email_news         boolean not null default false,
  email_match_alerts boolean not null default false,
  extras             jsonb not null default '{}'::jsonb check (pg_column_size(extras) < 16384),
  updated_at         timestamptz not null default now()
);
create trigger trg_settings_updated before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;
create policy "settings: crud own" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- feature_flags — server-evaluated; clients read via /api/flags only
-- ----------------------------------------------------------------------------

create table public.feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  description text,
  -- percentage rollout (0-100) hashed on user id; null = all-or-nothing
  rollout_pct integer check (rollout_pct between 0 and 100),
  updated_at  timestamptz not null default now()
);
create trigger trg_flags_updated before update on public.feature_flags
  for each row execute function public.set_updated_at();

alter table public.feature_flags enable row level security;
-- no client policies: only the service role (API) reads flags.

insert into public.feature_flags (key, enabled, description) values
  ('premium',         false, 'Premium plan gating'),
  ('experimental_ai', false, 'Unreleased AI features'),
  ('beta_features',   false, 'Beta feature set'),
  ('admin_tools',     false, 'Admin panel endpoints'),
  ('ai_scout',        true,  'AI Scout generation'),
  ('ai_concierge',    true,  'Chat concierge'),
  ('notifications',   true,  'In-app notifications'),
  ('newsletter',      true,  'Newsletter signups');

-- ----------------------------------------------------------------------------
-- usage_quotas — per-user daily counters (AI calls etc.)
-- ----------------------------------------------------------------------------

create table public.usage_quotas (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  metric     text not null check (metric in ('ai_requests','searches','exports')),
  day        date not null default (now() at time zone 'utc')::date,
  used       integer not null default 0 check (used >= 0),
  primary key (user_id, metric, day)
);

alter table public.usage_quotas enable row level security;
create policy "quotas: read own" on public.usage_quotas
  for select using (auth.uid() = user_id);
-- increments happen server-side via the RPC below.

-- Atomic check-and-increment; returns the new count or -1 when over limit.
create or replace function public.increment_quota(
  p_user uuid, p_metric text, p_limit integer
) returns integer language plpgsql security definer set search_path = public as $$
declare v_used integer;
begin
  insert into public.usage_quotas (user_id, metric, day, used)
  values (p_user, p_metric, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, metric, day)
    do update set used = usage_quotas.used + 1
    where usage_quotas.used < p_limit
  returning used into v_used;
  return coalesce(v_used, -1);
end $$;
revoke execute on function public.increment_quota from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- audit_logs — append-only, server-written
-- ----------------------------------------------------------------------------

create table public.audit_logs (
  id         bigint generated always as identity primary key,
  actor_id   uuid,                          -- null for system events
  action     text not null,                 -- e.g. 'auth.login', 'admin.flag.update'
  target     text,                          -- e.g. 'feature_flags/premium'
  detail     jsonb not null default '{}'::jsonb,
  ip_hash    text,                          -- sha256(ip + salt); raw IPs never stored
  created_at timestamptz not null default now()
);
create index idx_audit_actor on public.audit_logs (actor_id, created_at desc);
create index idx_audit_action on public.audit_logs (action, created_at desc);

alter table public.audit_logs enable row level security;
-- append-only: no update/delete grants anywhere; reads via service role only.
