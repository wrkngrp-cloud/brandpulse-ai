-- Undo Send for a personal mailbox: the Resend id of a message we sent,
-- needed to cancel it before Resend actually dispatches it. Inbound mail's
-- Resend id already lives in email_message_id; this is the outbound half,
-- a different id space on Resend's own side, so it gets its own column
-- rather than overloading that one.

alter table support_messages add column if not exists resend_message_id text;

create unique index if not exists idx_support_msg_resend_id
  on support_messages(resend_message_id) where resend_message_id is not null;
