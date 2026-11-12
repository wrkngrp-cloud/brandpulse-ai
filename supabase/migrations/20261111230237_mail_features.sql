-- CC/BCC on a message, and saved drafts for a personal mailbox.
--
-- cc/bcc live on support_messages rather than the conversation: who was
-- copied is a property of one email, not of the thread, and an inbound email
-- carries its own cc list regardless of what any reply sends.

alter table support_messages add column if not exists cc  text[] not null default '{}';
alter table support_messages add column if not exists bcc text[] not null default '{}';

-- One saved-but-unsent message per person. A reply draft is keyed to the
-- conversation (at most one in progress per thread, per person — a second
-- "Save draft" on the same reply overwrites rather than piling up). A fresh
-- compose has no conversation yet, so conversation_id is null and the row is
-- addressed directly instead.
create table if not exists mail_drafts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references support_conversations(id) on delete cascade,
  from_address    text not null,
  to_address      text,
  cc              text[] not null default '{}',
  bcc             text[] not null default '{}',
  subject         text,
  body            text not null default '',
  attachments     jsonb not null default '[]',
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- Postgres treats every NULL as distinct for a unique constraint, so this
-- only ever collapses reply drafts (conversation_id set); any number of
-- fresh-compose drafts (conversation_id null) coexist for the same person.
create unique index if not exists idx_mail_drafts_reply
  on mail_drafts(user_id, conversation_id) where conversation_id is not null;

alter table mail_drafts enable row level security;

-- Pure personal authoring state, never read or written cross-account. Every
-- Desk action still goes through the service client like the rest of this
-- module; RLS is the backstop if anything ever queries this table under a
-- user's own session.
create policy mail_drafts_own on mail_drafts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
