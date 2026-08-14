create table users (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  preferences jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_clerk_user_id_idx on users (clerk_user_id);

create trigger users_set_updated_at
  before update on users
  for each row execute function set_updated_at();

alter table users enable row level security;

create policy "users can view own row"
  on users for select
  using (clerk_user_id = requesting_clerk_user_id());

create policy "users can update own row"
  on users for update
  using (clerk_user_id = requesting_clerk_user_id());

create policy "users can insert own row"
  on users for insert
  with check (clerk_user_id = requesting_clerk_user_id());
