-- Live support chat: our own, in the product and on every public page.
--
-- One inbox, two kinds of person. A signed-in customer is identified by
-- auth.uid() and scoped by RLS like everything else. A stranger on the
-- marketing site or a free tool has no account and no identity, so they carry
-- a random visitor token in an httpOnly cookie and their whole path runs
-- through a service-role route that filters on it. That is the same mechanism
-- as /survey/[id], /ambassador/[token] and /go/[slug], and the rule it keeps
-- is the one in CLAUDE.md: anon RLS is never opened on these tables.
--
-- Staff read and write everything through is_staff(), because a conversation
-- belongs to BrandGauge rather than to a tenant, in the same way a lead does.

-- ── The conversation ─────────────────────────────────────────────────────────
create table if not exists support_conversations (
  id            uuid primary key default gen_random_uuid(),
  -- Null while they are a stranger. Filled in when they sign up with the same
  -- address, or when staff attach the thread to an account by hand.
  workspace_id  uuid references workspaces(id) on delete set null,
  brand_id      uuid references brands(id)     on delete set null,
  user_id       uuid references auth.users(id) on delete set null,
  -- The anonymous path. Random, cookie-held, and the only credential a
  -- stranger has, so it is unique and never guessable.
  visitor_token text unique,
  email         text,
  name          text,
  subject       text,
  status        text not null default 'open'
                check (status in ('open','pending','snoozed','closed')),
  priority      text not null default 'normal'
                check (priority in ('low','normal','high','urgent')),
  assigned_to   uuid references auth.users(id) on delete set null,
  -- Where the thread started. 'tool' covers the free public tools beyond the
  -- scoreboard, so that queue stays separable from paying customers.
  source        text not null default 'app'
                check (source in ('app','site','scoreboard','tool','email')),
  -- Where they were standing when they asked. The single most useful support
  -- field there is: half the questions answer themselves from the path.
  page_url      text,
  user_agent    text,
  first_response_at timestamptz,
  last_message_at   timestamptz not null default now(),
  closed_at     timestamptz,
  created_at    timestamptz not null default now(),
  -- A thread with neither an account nor a token could never be reached by
  -- anyone but staff, which would be a thread nobody can answer.
  constraint support_conversations_reachable
    check (visitor_token is not null or user_id is not null)
);

create index if not exists idx_support_conv_status on support_conversations(status, last_message_at desc);
create index if not exists idx_support_conv_ws     on support_conversations(workspace_id, last_message_at desc);
create index if not exists idx_support_conv_email  on support_conversations(lower(email));
create index if not exists idx_support_conv_user   on support_conversations(user_id, last_message_at desc);

-- ── The messages ─────────────────────────────────────────────────────────────
create table if not exists support_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references support_conversations(id) on delete cascade,
  -- 'system' covers the greeting, status changes and assignment notes.
  author_type     text not null check (author_type in ('customer','staff','system')),
  author_id       uuid references auth.users(id) on delete set null,
  body            text not null,
  -- [{ path, name, type, size }] in the private support-attachments bucket.
  -- Paths are written by the upload route, never taken from the client.
  attachments     jsonb not null default '[]'::jsonb,
  -- A note between staff on the thread. Never shown to the customer, which is
  -- enforced in the policy below and not only in the query.
  internal        boolean not null default false,
  read_by_customer_at timestamptz,
  read_by_staff_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_support_msg_conv on support_messages(conversation_id, created_at);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table support_conversations enable row level security;
alter table support_messages      enable row level security;

-- A signed-in customer reads and writes their own threads. Matching on user_id
-- as well as workspace covers the case that matters: somebody who asked a
-- question before their workspace existed and still owns the thread.
drop policy if exists support_conv_own_read on support_conversations;
create policy support_conv_own_read on support_conversations
  for select using (
    user_id = auth.uid()
    or (workspace_id is not null and is_workspace_member(workspace_id))
  );

drop policy if exists support_conv_own_insert on support_conversations;
create policy support_conv_own_insert on support_conversations
  for insert with check (user_id = auth.uid());

drop policy if exists support_conv_staff_all on support_conversations;
create policy support_conv_staff_all on support_conversations
  for all using (staff_can('support.view')) with check (staff_can('support.reply'));

-- The customer never sees an internal note. This is the policy rather than a
-- filter in a query, so a new screen cannot leak one by selecting too much.
drop policy if exists support_msg_own_read on support_messages;
create policy support_msg_own_read on support_messages
  for select using (
    internal = false
    and exists (
      select 1 from support_conversations c
      where c.id = conversation_id
        and (c.user_id = auth.uid()
             or (c.workspace_id is not null and is_workspace_member(c.workspace_id)))
    )
  );

-- A customer may only post as the customer, and only on their own thread.
drop policy if exists support_msg_own_insert on support_messages;
create policy support_msg_own_insert on support_messages
  for insert with check (
    author_type = 'customer'
    and internal = false
    and author_id = auth.uid()
    and exists (
      select 1 from support_conversations c
      where c.id = conversation_id
        and (c.user_id = auth.uid()
             or (c.workspace_id is not null and is_workspace_member(c.workspace_id)))
    )
  );

drop policy if exists support_msg_staff_all on support_messages;
create policy support_msg_staff_all on support_messages
  for all using (staff_can('support.view')) with check (staff_can('support.reply'));

-- ── Keeping the thread's clock ───────────────────────────────────────────────
-- last_message_at drives the inbox order and first_response_at is half of the
-- response-time figure on the staff page, so both are set by the database. A
-- route that forgot to touch them would quietly corrupt the queue order.
create or replace function touch_support_conversation()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  update public.support_conversations c
     set last_message_at   = new.created_at,
         first_response_at = case
           when new.author_type = 'staff' and new.internal = false
             then coalesce(c.first_response_at, new.created_at)
           else c.first_response_at
         end,
         -- A customer writing into a closed thread reopens it. Nobody should
         -- have to start again because we closed it too early.
         status = case
           when new.author_type = 'customer' and c.status in ('closed','snoozed') then 'open'
           else c.status
         end
   where c.id = new.conversation_id;
  return new;
end $$;

drop trigger if exists support_messages_touch on support_messages;
create trigger support_messages_touch after insert on support_messages
  for each row execute function touch_support_conversation();

-- ── Attachments ──────────────────────────────────────────────────────────────
-- Private, unlike brand-assets and campaign-creatives, which are public so
-- Claude Vision can fetch them by URL. A support screenshot can hold anything,
-- so this bucket is read through short-lived signed URLs minted per view.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  10485760,  -- 10 MB
  array['image/jpeg','image/png','image/webp','image/gif','application/pdf']
)
on conflict (id) do nothing;

-- No client-side policy at all. Uploads go through a service-role route that
-- checks the session or the visitor token first and names the path itself, and
-- reads are signed URLs. Nothing here is reachable with the anon key.
