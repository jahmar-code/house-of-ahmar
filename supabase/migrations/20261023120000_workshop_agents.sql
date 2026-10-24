-- The Workshop: agent monitoring for the House's operators.
--
-- Additive only. It creates five new tables and touches no family table,
-- policy, bucket or row. Operators are a separate allowlist on the same
-- Supabase Auth; they are not House members and gain no family access.
--
-- Data API: these tables are reached only through DATABASE_URL (server code).
-- RLS is enabled with NO policies and every client grant is revoked, so an
-- authenticated browser session cannot read agent tokens, logs or shares.
-- Verify afterwards (see docs/pkm/50-operations/workshop-deployment.md):
--   select relname, relrowsecurity from pg_class
--   where relnamespace = 'public'::regnamespace
--     and relname in ('operators','agents','agent_shares','agent_runs','agent_events');
-- Every row must show relrowsecurity = true, and an authenticated
-- GET /rest/v1/agents must return 401/403 or an empty set.
begin;
set local lock_timeout = '5s';

create table if not exists public.operators (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text not null unique,
  display_name text not null,
  role text not null default 'operator',
  is_active boolean not null default true,
  invited_by uuid references public.operators(id) on delete set null,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  constraint operators_role_check check (role in ('admin', 'operator')),
  constraint operators_email_lower_check check (email = lower(email))
);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.operators(id) on delete restrict,
  name text not null,
  description text,
  token_hash text not null unique,
  token_hint text not null,
  token_rotated_at timestamptz not null default now(),
  desired_state text not null default 'run',
  desired_state_at timestamptz not null default now(),
  reported_status text,
  status_message text,
  version text,
  host text,
  heartbeat_interval_sec integer not null default 30,
  metadata jsonb,
  last_heartbeat_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint agents_desired_state_check check (desired_state in ('run', 'pause', 'stop')),
  constraint agents_reported_status_check check (
    reported_status is null
    or reported_status in ('starting', 'running', 'idle', 'paused', 'error', 'stopping', 'stopped')
  ),
  constraint agents_heartbeat_interval_check check (heartbeat_interval_sec between 5 and 3600)
);
create index if not exists agents_owner_idx on public.agents (owner_id);

create table if not exists public.agent_shares (
  agent_id uuid not null references public.agents(id) on delete cascade,
  operator_id uuid not null references public.operators(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists agent_shares_pk on public.agent_shares (agent_id, operator_id);
create index if not exists agent_shares_operator_idx on public.agent_shares (operator_id);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  external_id text not null,
  status text not null default 'running',
  summary text,
  metrics jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint agent_runs_status_check check (status in ('running', 'succeeded', 'failed', 'cancelled'))
);
create unique index if not exists agent_runs_external_idx on public.agent_runs (agent_id, external_id);
create index if not exists agent_runs_agent_started_idx on public.agent_runs (agent_id, started_at);
-- Daily ingest budgets count by insert time per agent.
create index if not exists agent_runs_agent_created_idx on public.agent_runs (agent_id, created_at);

create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  level text not null default 'info',
  message text not null,
  data jsonb,
  actor_id uuid references public.operators(id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint agent_events_level_check check (level in ('debug', 'info', 'warn', 'error'))
);
create index if not exists agent_events_agent_occurred_idx on public.agent_events (agent_id, occurred_at);
create index if not exists agent_events_created_idx on public.agent_events (created_at);
create index if not exists agent_events_agent_created_idx on public.agent_events (agent_id, created_at);

-- Deny the Data API outright. 0002's default privileges already withhold
-- grants from new tables; this repeats it explicitly so the file is safe on
-- its own, and RLS-with-no-policy is the second lock.
do $$
declare t text;
begin
  foreach t in array array['operators', 'agents', 'agent_shares', 'agent_runs', 'agent_events'] loop
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

commit;
