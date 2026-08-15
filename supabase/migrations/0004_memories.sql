-- Long-term memory (Phase 6). embedding uses OpenAI text-embedding-3-small
-- dimensionality (1536); swap the dimension here if a different model is used.
create table memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  type text not null
    check (type in ('conversation', 'preference', 'note', 'task', 'business', 'learning', 'goal', 'project')),
  content text not null,
  summary text,
  embedding vector(1536),
  importance smallint not null default 5 check (importance between 1 and 10),
  source text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz not null default now()
);

create index memories_user_id_idx on memories (user_id);
create index memories_type_idx on memories (type);
create index memories_content_trgm_idx on memories using gin (content gin_trgm_ops);
create index memories_embedding_idx on memories using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create trigger memories_set_updated_at
  before update on memories
  for each row execute function set_updated_at();

alter table memories enable row level security;

create policy "users manage own memories"
  on memories for all
  using (user_id in (select id from users where clerk_user_id = requesting_clerk_user_id()))
  with check (user_id in (select id from users where clerk_user_id = requesting_clerk_user_id()));

-- Cosine-similarity search, callable via supabase.rpc('match_memories', {...}).
create or replace function match_memories(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count int default 8,
  match_threshold float default 0.75
)
returns table (
  id uuid,
  content text,
  summary text,
  type text,
  importance smallint,
  similarity float
)
language sql
stable
as $$
  select
    m.id,
    m.content,
    m.summary,
    m.type,
    m.importance,
    1 - (m.embedding <=> query_embedding) as similarity
  from memories m
  where m.user_id = match_user_id
    and m.embedding is not null
    and 1 - (m.embedding <=> query_embedding) > match_threshold
  order by m.embedding <=> query_embedding
  limit match_count;
$$;
