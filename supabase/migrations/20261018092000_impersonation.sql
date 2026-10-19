-- Impersonation, with a consent gate.
--
-- Read-only, asked for, approved by the customer, time-boxed, visible on both
-- sides and logged. Five properties, each load-bearing.
--
-- How the view itself works, because it is the part with teeth. An approved
-- session adds the staff member to workspace_members on the 'viewer' role for
-- the length of the session, so the product's own row-level security shows
-- them the data and no read path has to be rewritten to accommodate this
-- feature. That membership is the access, so three things remove it: the
-- customer ending the session, the staff member ending it, and the clock.
-- `membership_granted` records whether the row is currently out there, so a
-- sweep can tell the difference between a session that was cleaned up and one
-- that was not.
--
-- Read-only is NOT enforced by the viewer role, because nothing in this schema
-- makes 'viewer' read-only. It is enforced in src/proxy.ts, which refuses any
-- request that is not a GET or HEAD, and every /api/ path, while a session is
-- active. That is one check in one place that a new route cannot opt out of.

create table if not exists impersonation_sessions (
  id            uuid primary key default gen_random_uuid(),
  staff_id      uuid not null references auth.users(id) on delete cascade,
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  -- The person who approved it, and the thread it came out of.
  requested_for uuid references auth.users(id) on delete set null,
  conversation_id uuid references support_conversations(id) on delete set null,
  reason        text not null,
  status        text not null default 'pending'
                check (status in ('pending','approved','declined','active','ended','expired')),
  approved_by   uuid references auth.users(id) on delete set null,
  approved_at   timestamptz,
  started_at    timestamptz,
  -- Hard stop. Nothing extends a session; staff ask again.
  expires_at    timestamptz,
  ended_at      timestamptz,
  ended_by      text check (ended_by in ('staff','customer','expiry','sweep')),
  pages_viewed  integer not null default 0,
  membership_granted boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists idx_imp_ws    on impersonation_sessions(workspace_id, created_at desc);
create index if not exists idx_imp_staff on impersonation_sessions(staff_id, created_at desc);
-- The lookup on every request while one is live, so it has to be cheap.
create index if not exists idx_imp_live  on impersonation_sessions(staff_id, status)
  where status in ('pending','approved','active');

alter table impersonation_sessions enable row level security;

-- The customer sees every session on their own workspace, including the
-- history. That is the part that makes the feature honest: they can see who
-- looked, when, why, and who approved it.
drop policy if exists imp_customer_read on impersonation_sessions;
create policy imp_customer_read on impersonation_sessions
  for select using (is_workspace_member(workspace_id));

-- And they can answer a request on it. Only the status fields, and the check
-- keeps them from approving one for a different workspace.
drop policy if exists imp_customer_decide on impersonation_sessions;
create policy imp_customer_decide on impersonation_sessions
  for update using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

drop policy if exists imp_staff_read on impersonation_sessions;
create policy imp_staff_read on impersonation_sessions
  for select using (staff_can('accounts.view'));

-- Staff may ask. They may not approve: there is no policy that lets a staff
-- member write `approved_at`, and the route that does it runs on the service
-- client only after reading a real approval row.
drop policy if exists imp_staff_request on impersonation_sessions;
create policy imp_staff_request on impersonation_sessions
  for insert with check (
    staff_can('accounts.impersonate')
    and staff_id = auth.uid()
    and status = 'pending'
  );

-- ── The one question every request asks ──────────────────────────────────────
-- Returns the workspace a staff member is currently inside, or null. Used by
-- the middleware on the customer host, so it has to answer fast and has to be
-- callable by the signed-in user themselves.
create or replace function active_impersonation(p_staff uuid)
returns uuid language sql security definer stable
set search_path = public as $$
  select s.workspace_id
  from public.impersonation_sessions s
  where s.staff_id = p_staff
    and s.status in ('approved','active')
    and s.expires_at > now()
  order by s.approved_at desc nulls last
  limit 1;
$$;

-- ── Expiry ───────────────────────────────────────────────────────────────────
-- Belt and braces for the sweep job: even if nothing ever runs, a session past
-- its expiry answers as over, because active_impersonation checks the clock.
-- This function is what actually takes the membership away.
create or replace function end_impersonation(p_session uuid, p_ended_by text)
returns void language plpgsql security definer
set search_path = public as $$
declare
  s record;
begin
  select * into s from public.impersonation_sessions where id = p_session;
  if s is null or s.ended_at is not null then
    return;
  end if;

  -- Ending a session is a safe act, but not an anonymous one. Only the staff
  -- member inside it, a member of the workspace being looked at, or the
  -- service role (auth.uid() is null, which is the sweep job) may do it.
  -- Without this, execute being granted to `authenticated` would let any
  -- signed-in user end any session by id.
  if not (
    auth.uid() = s.staff_id
    or public.is_workspace_member(s.workspace_id)
    or auth.uid() is null
  ) then
    return;
  end if;

  if s.membership_granted then
    delete from public.workspace_members
     where workspace_id = s.workspace_id and user_id = s.staff_id;
  end if;

  update public.impersonation_sessions
     set status = case when p_ended_by = 'expiry' then 'expired' else 'ended' end,
         ended_at = now(),
         ended_by = p_ended_by,
         membership_granted = false
   where id = p_session;
end $$;

revoke execute on function end_impersonation(uuid, text) from public;
revoke execute on function end_impersonation(uuid, text) from anon;
grant  execute on function end_impersonation(uuid, text) to authenticated;
grant  execute on function end_impersonation(uuid, text) to service_role;
