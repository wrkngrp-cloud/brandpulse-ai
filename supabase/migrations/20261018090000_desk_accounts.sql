-- The Desk: account notes, and reading an address back from an id.
--
-- Two small things the accounts screen needs.

-- ── Notes on an account ──────────────────────────────────────────────────────
-- What somebody learned about a customer that is not in any other column: who
-- the real decision maker is, why they churned the first time, that their
-- agency does the posting. It belongs to BrandGauge rather than to the tenant,
-- so it scopes to staff and the customer never sees it.
create table if not exists staff_notes (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  author_id    uuid references auth.users(id) on delete set null,
  body         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_staff_notes_ws on staff_notes(workspace_id, created_at desc);

alter table staff_notes enable row level security;

-- Readable by anyone who can open an account, writable by anyone who can note
-- one. No customer policy at all: this table is not theirs and is not a
-- redaction problem, it is simply not reachable.
drop policy if exists staff_notes_read on staff_notes;
create policy staff_notes_read on staff_notes
  for select using (staff_can('accounts.view'));

drop policy if exists staff_notes_write on staff_notes;
create policy staff_notes_write on staff_notes
  for insert with check (staff_can('accounts.note'));

-- ── Addresses for a set of user ids ──────────────────────────────────────────
-- PostgREST cannot see the auth schema, so the members list has no way to show
-- who is in a workspace. This is the companion to auth_user_id_for_email from
-- 20261014120000, in the other direction and in one round trip rather than one
-- per person.
--
-- Execute is revoked from everyone except the service role for the same reason
-- as that one: in a signed-in user's hands this is a way to read addresses
-- across every tenant.
create or replace function auth_emails_for_user_ids(p_ids uuid[])
returns table (user_id uuid, email text, last_sign_in_at timestamptz)
language sql security definer stable
set search_path = public as $$
  select u.id, u.email, u.last_sign_in_at
  from auth.users u
  where u.id = any(p_ids);
$$;

revoke execute on function auth_emails_for_user_ids(uuid[]) from public;
revoke execute on function auth_emails_for_user_ids(uuid[]) from anon;
revoke execute on function auth_emails_for_user_ids(uuid[]) from authenticated;
grant  execute on function auth_emails_for_user_ids(uuid[]) to service_role;
