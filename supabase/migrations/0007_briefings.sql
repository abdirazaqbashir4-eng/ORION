create table briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  briefing_date date not null default current_date,
  summary text,
  emails_summary jsonb not null default '{}',
  revenue_summary jsonb not null default '{}',
  calendar_summary jsonb not null default '{}',
  news_summary jsonb not null default '{}',
  tasks_summary jsonb not null default '{}',
  recommendations jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (user_id, briefing_date)
);

create index briefings_user_id_idx on briefings (user_id, briefing_date desc);

alter table briefings enable row level security;

create policy "users manage own briefings"
  on briefings for all
  using (user_id in (select id from users where clerk_user_id = requesting_clerk_user_id()))
  with check (user_id in (select id from users where clerk_user_id = requesting_clerk_user_id()));
