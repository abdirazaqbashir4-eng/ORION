create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  type text not null default 'info'
    check (type in ('info', 'success', 'warning', 'error', 'action_required')),
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on notifications (user_id, created_at desc);
create index notifications_unread_idx on notifications (user_id) where read = false;

alter table notifications enable row level security;

create policy "users manage own notifications"
  on notifications for all
  using (user_id in (select id from users where clerk_user_id = requesting_clerk_user_id()))
  with check (user_id in (select id from users where clerk_user_id = requesting_clerk_user_id()));
