-- Inbound email into the support inbox.
--
-- Mail to support@ (and hello@, routed the same way) now creates or appends to
-- a support_conversations row, same table the chat widget writes to. No new
-- table and no RLS change: the service-role webhook writes these rows, staff
-- read them through the existing staff_can('support.view') policy, and a
-- customer who later signs in and matches by email reads them through the
-- existing support_conv_own_read policy unchanged.

alter table support_messages
  -- Resend's own email id for the inbound message. The webhook can retry a
  -- delivery, and without this a retry would double-post the same email into
  -- the thread.
  add column if not exists email_message_id text;

create unique index if not exists idx_support_msg_email_id
  on support_messages(email_message_id) where email_message_id is not null;

alter table support_conversations
  -- support@ or hello@ — which address it actually arrived at. Both land in
  -- the same inbox; this is just the context, same spirit as page_url.
  add column if not exists inbound_address text;
