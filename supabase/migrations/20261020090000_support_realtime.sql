-- Put the support tables on the wire.
--
-- The inbox is a live chat on the customer's side and was a static page on
-- ours: the widget polls every five seconds, the Desk's thread page rendered
-- once and never again, so answering a live conversation meant reloading
-- after every message. `src/app/api/support/thread/route.ts` even documented
-- Realtime as the signed-in path, and nothing in the app had ever subscribed
-- to anything here.
--
-- Both tables already carry staff policies on staff_can('support.view') and
-- customer policies scoped to their own thread, and Realtime applies those
-- same policies to every change it forwards. So this grants nobody anything
-- new: it lets the two sides hear about rows they could already read.
--
-- `event_interactions` in 20260616000000 is the precedent, and the live event
-- dashboard is the pattern to follow on the client.
--
-- Guarded rather than bare, because `alter publication ... add table` errors
-- on a table that is already published and this file has to be replayable.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'support_conversations'
  ) then
    alter publication supabase_realtime add table support_conversations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'support_messages'
  ) then
    alter publication supabase_realtime add table support_messages;
  end if;
end $$;
