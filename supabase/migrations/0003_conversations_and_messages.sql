create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  title text not null default 'New conversation',
  agent_type text not null default 'general'
    check (agent_type in ('general', 'developer', 'business', 'marketing', 'research', 'executive')),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_user_id_idx on conversations (user_id);

create trigger conversations_set_updated_at
  before update on conversations
  for each row execute function set_updated_at();

alter table conversations enable row level security;

create policy "users manage own conversations"
  on conversations for all
  using (user_id in (select id from users where clerk_user_id = requesting_clerk_user_id()))
  with check (user_id in (select id from users where clerk_user_id = requesting_clerk_user_id()));

-- ---------------------------------------------------------------------

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null default '',
  tool_calls jsonb,
  tool_results jsonb,
  attachments jsonb not null default '[]',
  tokens_input integer,
  tokens_output integer,
  created_at timestamptz not null default now()
);

create index messages_conversation_id_idx on messages (conversation_id, created_at);

alter table messages enable row level security;

create policy "users manage messages in own conversations"
  on messages for all
  using (
    conversation_id in (
      select c.id from conversations c
      join users u on u.id = c.user_id
      where u.clerk_user_id = requesting_clerk_user_id()
    )
  )
  with check (
    conversation_id in (
      select c.id from conversations c
      join users u on u.id = c.user_id
      where u.clerk_user_id = requesting_clerk_user_id()
    )
  );
