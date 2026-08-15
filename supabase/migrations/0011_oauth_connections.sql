-- Stores OAuth tokens for third-party integrations (Gmail today).
-- Tokens are encrypted at rest by the application (src/lib/security/crypto.ts)
-- before insert — this table never holds a plaintext token.
create table oauth_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  provider text not null check (provider in ('google')),
  encrypted_access_token text,
  encrypted_refresh_token text,
  scope text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index oauth_connections_user_id_idx on oauth_connections (user_id);

create trigger oauth_connections_set_updated_at
  before update on oauth_connections
  for each row execute function set_updated_at();

alter table oauth_connections enable row level security;

create policy "users manage own oauth connections"
  on oauth_connections for all
  using (user_id in (select id from users where clerk_user_id = requesting_clerk_user_id()))
  with check (user_id in (select id from users where clerk_user_id = requesting_clerk_user_id()));
