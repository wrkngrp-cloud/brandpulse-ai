-- A staff member's own @brandgauge.app address, for one-to-one outbound work
-- (cold outreach, lead gen) that does not belong in the shared support inbox.

insert into role_permissions (role, permission) values
  ('super_admin', 'mail.use'),
  ('admin',       'mail.use'),
  ('bizdev',      'mail.use')
on conflict (role, permission) do nothing;

create table if not exists staff_mailboxes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- Lower-cased at the point of use, same as support_conversations.email, so a
  -- lookup never misses on case.
  address    text not null unique,
  created_at timestamptz not null default now(),
  primary key (user_id, address)
);

alter table staff_mailboxes enable row level security;

-- A person reads which address is theirs. Everything else (adding one,
-- reading another person's) is service-role only, the same posture as the
-- rest of the Desk's own tables.
create policy staff_mailboxes_own_read on staff_mailboxes
  for select using (user_id = auth.uid());
