create table if not exists user_tours (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  module     text not null,
  status     text not null default 'unseen'
             check (status in ('unseen','in_progress','completed','skipped')),
  version    integer not null default 1,
  seen_at    timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, module)
);
alter table user_tours enable row level security;
create policy user_tours_own on user_tours
  for all using (user_id = auth.uid());
