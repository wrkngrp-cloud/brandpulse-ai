-- Demo leads, marked as such.
--
-- The founder needs to see how the desk reads with a few leads in it before
-- any real ones arrive. The danger is obvious: a BDM calling a person who
-- does not exist, or a demo address ending up in a send. So the rows are
-- flagged in the schema rather than by a naming convention someone has to
-- remember, the desk badges them, and one call removes them.
--
-- Belt and braces on top of the flag: every seeded address is at
-- example.com, which is reserved by RFC 2606 and can never receive mail.

alter table leads add column if not exists is_demo boolean not null default false;

create index if not exists idx_leads_demo on leads(is_demo) where is_demo;

comment on column leads.is_demo is
  'Seeded for the lead desk preview. Never a real person. Excluded from any send, and removable from the desk.';
