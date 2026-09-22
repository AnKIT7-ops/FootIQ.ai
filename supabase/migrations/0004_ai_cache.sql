-- Persistent AI result cache.
--
-- On Workers the cache is per-isolate memory: every cron run and most requests
-- start empty, so "cache a scout report for 24h" regenerated it on nearly every
-- call. The 30-minute warm job alone spent ~240 Gemini requests a day and
-- exhausted the free quota (HTTP 429 on every user request, 2026-09-22).
-- One row per rendered prompt; the API reads/writes it with the service role.

create table public.ai_cache (
  key         text primary key,
  result      jsonb not null,
  expires_at  timestamptz not null
);

create index ai_cache_expires_idx on public.ai_cache (expires_at);

alter table public.ai_cache enable row level security;
revoke all on public.ai_cache from anon, authenticated;
