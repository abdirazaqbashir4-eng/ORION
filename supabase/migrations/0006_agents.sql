create table agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('developer', 'business', 'marketing', 'research', 'executive')),
  description text,
  status text not null default 'idle' check (status in ('idle', 'running', 'error', 'disabled')),
  config jsonb not null default '{}',
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, type)
);

create index agents_user_id_idx on agents (user_id);

create trigger agents_set_updated_at
  before update on agents
  for each row execute function set_updated_at();

alter table agents enable row level security;

create policy "users manage own agents"
  on agents for all
  using (user_id in (select id from users where clerk_user_id = requesting_clerk_user_id()))
  with check (user_id in (select id from users where clerk_user_id = requesting_clerk_user_id()));

-- ---------------------------------------------------------------------

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents (id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'success', 'failed')),
  input jsonb not null default '{}',
  output jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index agent_runs_agent_id_idx on agent_runs (agent_id, started_at desc);

alter table agent_runs enable row level security;

create policy "users manage runs of own agents"
  on agent_runs for all
  using (
    agent_id in (
      select a.id from agents a
      join users u on u.id = a.user_id
      where u.clerk_user_id = requesting_clerk_user_id()
    )
  )
  with check (
    agent_id in (
      select a.id from agents a
      join users u on u.id = a.user_id
      where u.clerk_user_id = requesting_clerk_user_id()
    )
  );
