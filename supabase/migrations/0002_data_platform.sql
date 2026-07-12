-- FootIQ migration 0002 — data platform (Phase 4)
-- Catalog snapshots (synced provider data) + background job run history.
-- Both tables are SERVER-ONLY: RLS enabled with NO client policies, so the
-- anon/authenticated roles cannot see them at all; only the service role
-- (the API) reads/writes. Same fail-closed pattern as 0001.

create table public.catalog_snapshots (
  kind        text primary key,
  payload     jsonb not null,
  source      text not null,
  synced_at   timestamptz not null default now()
);

alter table public.catalog_snapshots enable row level security;
revoke all on public.catalog_snapshots from anon, authenticated;

create table public.job_runs (
  id          bigint generated always as identity primary key,
  name        text not null,
  status      text not null check (status in ('ok', 'failed')),
  ms          integer not null,
  attempts    integer not null default 1,
  detail      text,
  ran_at      timestamptz not null default now()
);

create index job_runs_name_ran_idx on public.job_runs (name, ran_at desc);

alter table public.job_runs enable row level security;
revoke all on public.job_runs from anon, authenticated;

-- keep job history bounded: callers may prune, and this gives them an index
create index job_runs_ran_idx on public.job_runs (ran_at);
