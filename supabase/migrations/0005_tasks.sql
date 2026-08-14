create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date timestamptz,
  agent_type text
    check (agent_type is null or agent_type in ('developer', 'business', 'marketing', 'research', 'executive')),
  parent_task_id uuid references tasks (id) on delete cascade,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index tasks_user_id_idx on tasks (user_id);
create index tasks_status_idx on tasks (status);
create index tasks_parent_task_id_idx on tasks (parent_task_id);

create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();

alter table tasks enable row level security;

create policy "users manage own tasks"
  on tasks for all
  using (user_id in (select id from users where clerk_user_id = requesting_clerk_user_id()))
  with check (user_id in (select id from users where clerk_user_id = requesting_clerk_user_id()));
