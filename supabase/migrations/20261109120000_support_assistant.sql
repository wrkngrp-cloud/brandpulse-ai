-- The support assistant: a first-line replier in our own support chat.
--
-- Owner decision 2026-11-08 (LD-20): suggest-only first, then auto-reply
-- behind SUPPORT_ASSISTANT_MODE. This migration only adds what that needs. No
-- table is created and no policy is touched, so RLS stays exactly as it was:
--
--   * a customer may still insert only author_type = 'customer' (the existing
--     support_msg_own_insert policy), so nobody can post as the assistant from
--     the browser;
--   * assistant rows are written by the service role from an Inngest job, and
--     staff read them through the existing staff_can('support.view') policy;
--   * the assistant's drafts in suggest mode are internal notes, which the
--     existing support_msg_own_read policy already keeps off the customer side.

-- ── A third author ───────────────────────────────────────────────────────────
alter table support_messages drop constraint if exists support_messages_author_type_check;
alter table support_messages add constraint support_messages_author_type_check
  check (author_type in ('customer','staff','system','assistant'));

-- A customer pasted a key, a token, a password or a card number. The assistant
-- never quotes it back; this asks a person to redact the row.
alter table support_messages
  add column if not exists needs_redaction boolean not null default false;

-- ── The assistant's state on a thread ────────────────────────────────────────
alter table support_conversations
  -- One name from the fixed list in src/lib/support/assistant/config.ts, picked
  -- on the first reply and never changed for the thread. Never a staff row.
  add column if not exists assistant_persona text,
  -- The assistant's own clock. first_response_at stays human-only, so the
  -- response-time figure on the staff page keeps meaning what it says.
  add column if not exists assistant_first_response_at timestamptz,
  -- 'handed_off' stops auto-replies until a person replies or the thread is
  -- closed and reopened. While handed off only the PND holding replies go out.
  add column if not exists assistant_state text not null default 'active',
  add column if not exists assistant_handoff_at timestamptz,
  add column if not exists assistant_reply_count     integer not null default 0,
  add column if not exists assistant_unhelpful_count integer not null default 0,
  -- The per-thread daily call cap (20 a day), counted where the thread lives.
  add column if not exists assistant_calls_day   date,
  add column if not exists assistant_calls_today integer not null default 0,
  add column if not exists assistant_email_asked boolean not null default false,
  add column if not exists assistant_nudged_at   timestamptz,
  -- PND-03: the last time a chase raised priority and re-notified staff.
  add column if not exists assistant_chased_at   timestamptz,
  -- The overdue sweep: a handed-off case past its reply target
  -- (src/lib/support/reply-targets.ts) notifies staff again once.
  add column if not exists assistant_overdue_notified_at timestamptz,
  -- Feature requests and feedback (NLV-01, FBK-01, FBK-02) and handoff topics.
  add column if not exists tags text[] not null default '{}';

alter table support_conversations drop constraint if exists support_conversations_assistant_state_check;
alter table support_conversations add constraint support_conversations_assistant_state_check
  check (assistant_state in ('active','handed_off'));

create index if not exists idx_support_conv_handoff
  on support_conversations(assistant_state, assistant_handoff_at)
  where assistant_state = 'handed_off';

-- ── Keeping the thread's clock, with the assistant in it ─────────────────────
-- Same function as 20261014122000, plus three things:
--   * first_response_at still counts only a non-internal staff message, so an
--     instant assistant reply can never flatter the human metric;
--   * assistant_first_response_at is the assistant's own figure;
--   * a person replying, or a customer reopening a closed thread, gives the
--     thread back to the assistant with fresh limits.
create or replace function touch_support_conversation()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  reopening boolean;
begin
  select (new.author_type = 'customer' and c.status in ('closed','snoozed'))
    into reopening
    from public.support_conversations c
   where c.id = new.conversation_id;

  update public.support_conversations c
     set last_message_at   = new.created_at,
         first_response_at = case
           when new.author_type = 'staff' and new.internal = false
             then coalesce(c.first_response_at, new.created_at)
           else c.first_response_at
         end,
         assistant_first_response_at = case
           when new.author_type = 'assistant' and new.internal = false
             then coalesce(c.assistant_first_response_at, new.created_at)
           else c.assistant_first_response_at
         end,
         -- A customer writing into a closed thread reopens it. Nobody should
         -- have to start again because we closed it too early.
         status = case
           when coalesce(reopening, false) then 'open'
           else c.status
         end,
         assistant_state = case
           when (new.author_type = 'staff' and new.internal = false)
             or coalesce(reopening, false)
             then 'active'
           else c.assistant_state
         end,
         assistant_handoff_at = case
           when (new.author_type = 'staff' and new.internal = false)
             or coalesce(reopening, false)
             then null
           else c.assistant_handoff_at
         end,
         assistant_reply_count = case
           when coalesce(reopening, false) then 0 else c.assistant_reply_count
         end,
         assistant_unhelpful_count = case
           when coalesce(reopening, false) then 0 else c.assistant_unhelpful_count
         end,
         assistant_nudged_at = case
           when coalesce(reopening, false) then null else c.assistant_nudged_at
         end,
         assistant_chased_at = case
           when (new.author_type = 'staff' and new.internal = false)
             or coalesce(reopening, false)
             then null
           else c.assistant_chased_at
         end,
         assistant_overdue_notified_at = case
           when (new.author_type = 'staff' and new.internal = false)
             or coalesce(reopening, false)
             then null
           else c.assistant_overdue_notified_at
         end
   where c.id = new.conversation_id;
  return new;
end $$;

-- The trigger itself is unchanged; create or replace above is enough. It is
-- recreated anyway so this file replays cleanly on its own.
drop trigger if exists support_messages_touch on support_messages;
create trigger support_messages_touch after insert on support_messages
  for each row execute function touch_support_conversation();
