create table automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  name text not null,
  description text,
  trigger_type text not null check (trigger_type in ('schedule', 'event', 'manual')),
  schedule_cron text,
  event_name text,
  action_type text not null,
  action_config jsonb not null default '{}',
  enabled boolean not null default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_requires_cron check (trigger_type != 'schedule' or schedule_cron is not null),
  constraint event_requires_name check (trigger_type != 'event' or event_name is not null)
);

create index automations_user_id_idx on automations (user_id);
create index automations_next_run_at_idx on automations (next_run_at) where enabled = true;

create trigger automations_set_updated_at
  before update on automations
  for each row execute function set_updated_at();

alter table automations enable row level security;

create policy "users manage own automations"
  on automations for all
  using (user_id in (select id from users where clerk_user_id = requesting_clerk_user_id()))
  with check (user_id in (select id from users where clerk_user_id = requesting_clerk_user_id()));

-- ---------------------------------------------------------------------

create table automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references automations (id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'success', 'failed')),
  output jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index automation_runs_automation_id_idx on automation_runs (automation_id, started_at desc);

alter table automation_runs enable row level security;

create policy "users manage runs of own automations"
  on automation_runs for all
  using (
    automation_id in (
      select a.id from automations a
      join users u on u.id = a.user_id
      where u.clerk_user_id = requesting_clerk_user_id()
    )
  )
  with check (
    automation_id in (
      select a.id from automations a
      join users u on u.id = a.user_id
      where u.clerk_user_id = requesting_clerk_user_id()
    )
  );
