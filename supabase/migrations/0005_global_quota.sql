-- Global daily ceiling on real AI generations (AI_GLOBAL_DAILY_LIMIT).
--
-- One free Gemini key serves every user, and anonymous identities are free to
-- mint, so per-user quotas alone can't stop a script from exhausting it and
-- switching AI off for everyone (the 429 lockout of 2026-09-22). usage_quotas
-- can't hold this counter: its user_id is a FK to profiles.
-- Apply BEFORE deploying the Worker that calls increment_global_quota — until
-- then the API falls back to a per-isolate counter (logged as
-- ai.global_quota_failed).

create table public.global_quotas (
  metric  text not null,
  day     date not null default (now() at time zone 'utc')::date,
  used    integer not null default 0 check (used >= 0),
  primary key (metric, day)
);

alter table public.global_quotas enable row level security;
revoke all on public.global_quotas from anon, authenticated;

-- Atomic check-and-increment; returns the new count or -1 when over limit.
create or replace function public.increment_global_quota(
  p_metric text, p_limit integer
) returns integer language plpgsql security definer set search_path = public as $$
declare v_used integer;
begin
  if p_limit <= 0 then return -1; end if;
  insert into public.global_quotas (metric, day, used)
  values (p_metric, (now() at time zone 'utc')::date, 1)
  on conflict (metric, day)
    do update set used = global_quotas.used + 1
    where global_quotas.used < p_limit
  returning used into v_used;
  return coalesce(v_used, -1);
end $$;
revoke execute on function public.increment_global_quota(text, integer) from public, anon, authenticated;
