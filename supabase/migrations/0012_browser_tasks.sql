-- Audit log of browser automation runs (Phase 11), triggered by agents
-- via the browse_web tool (src/lib/agents/tools.ts).
create table browser_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  task_type text not null check (task_type in ('scrape', 'search')),
  input jsonb not null default '{}',
  status text not null default 'running' check (status in ('running', 'success', 'failed')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index browser_tasks_user_id_idx on browser_tasks (user_id, created_at desc);

alter table browser_tasks enable row level security;

create policy "users manage own browser tasks"
  on browser_tasks for all
  using (user_id in (select id from users where clerk_user_id = requesting_clerk_user_id()))
  with check (user_id in (select id from users where clerk_user_id = requesting_clerk_user_id()));
