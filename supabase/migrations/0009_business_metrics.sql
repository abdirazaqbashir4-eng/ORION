create table business_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  metric_date date not null,
  revenue numeric(14, 2) not null default 0,
  expenses numeric(14, 2) not null default 0,
  profit numeric(14, 2) generated always as (revenue - expenses) stored,
  currency text not null default 'USD',
  product text,
  source text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, metric_date, product, source)
);

create index business_metrics_user_id_idx on business_metrics (user_id, metric_date desc);

alter table business_metrics enable row level security;

create policy "users manage own business metrics"
  on business_metrics for all
  using (user_id in (select id from users where clerk_user_id = requesting_clerk_user_id()))
  with check (user_id in (select id from users where clerk_user_id = requesting_clerk_user_id()));
