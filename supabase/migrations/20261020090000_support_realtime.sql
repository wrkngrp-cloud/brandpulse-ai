-- Realtime for the support chat, signed-in side.
--
-- docs/internal-tool-plan.md promises a signed-in customer and staff get
-- messages over a Supabase Realtime subscription, RLS doing the scoping, the
-- same as event_interactions. A stranger has no Realtime identity (no
-- auth.uid()), so the widget keeps polling for that path; this is additive,
-- not a replacement for the visitor poll.
--
-- Typing indicators and read receipts are a broadcast channel keyed by
-- conversation, not a Postgres row, so they need no table here.

alter publication supabase_realtime add table support_conversations;
alter publication supabase_realtime add table support_messages;
