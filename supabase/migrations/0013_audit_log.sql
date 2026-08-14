-- Cross-cutting security audit trail. Domain-specific execution history
-- already lives in agent_runs / automation_runs / browser_tasks — this
-- table is for security-relevant events that don't belong to any one
-- of those: OAuth grants, rate-limit rejections, role changes.
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}',
  ip_address text,
  created_at timestamptz not null default now()
);

create index audit_log_user_id_idx on audit_log (user_id, created_at desc);
create index audit_log_event_type_idx on audit_log (event_type, created_at desc);

alter table audit_log enable row level security;

create policy "users view own audit log"
  on audit_log for select
  using (user_id in (select id from users where clerk_user_id = requesting_clerk_user_id()));
