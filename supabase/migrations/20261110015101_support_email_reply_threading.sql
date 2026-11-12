-- Threading a reply back into the customer's own email client.
--
-- Separate migration from 20261109150000 because that one is already applied:
-- this adds one more column rather than editing an applied file, which would
-- never reach the live database.

alter table support_messages
  -- The RFC 5322 Message-ID header off the inbound email (not Resend's own
  -- email_id, already covered by email_message_id). A reply sets this as
  -- In-Reply-To/References so it threads in Gmail/Outlook instead of landing
  -- as a disconnected new email.
  add column if not exists email_rfc_message_id text;
