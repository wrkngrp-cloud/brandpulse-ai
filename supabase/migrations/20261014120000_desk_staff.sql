-- The Desk: staff accounts, roles, permissions, invites and the audit log.
--
-- The Desk is BrandGauge's own internal tool. It answers on its own host and
-- reads across every tenant, which makes its access model the opposite of the
-- rest of this schema: nothing here scopes to a workspace, because none of it
-- belongs to one. See docs/internal-tool-plan.md.
--
-- RLS note. This is the same pattern as lead_desk_admins and deliberately not
-- a new one: an explicit allowlist, read through a security-definer function
-- with a fixed search_path so the policy cannot recurse and an attacker cannot
-- shadow the table name. Document 5 Part B warns against inventing a third
-- shape, so there is no third shape here.
--
-- lead_desk_admins is left in place and its rows are copied across. Retiring
-- it means rewriting the leads and public_scans policies and the lead desk
-- page, which happens when the lead desk moves into the Desk.

-- ── Roles ────────────────────────────────────────────────────────────────────
-- A role is a template over permission keys, editable in the Desk afterwards.
-- System roles can be edited but never deleted, so there is always something
-- to invite someone onto.
create table if not exists staff_roles (
  name        text primary key,
  label       text not null,
  description text,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists role_permissions (
  role       text not null references staff_roles(name) on delete cascade,
  permission text not null,
  primary key (role, permission)
);

-- ── The staff member ─────────────────────────────────────────────────────────
create table if not exists staff (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  full_name    text not null,
  job_title    text,
  phone        text,
  avatar_url   text,
  timezone     text not null default 'Africa/Lagos',
  role         text not null references staff_roles(name),
  status       text not null default 'active'
               check (status in ('active','suspended')),
  invited_by   uuid references auth.users(id) on delete set null,
  invited_at   timestamptz not null default now(),
  joined_at    timestamptz,
  last_seen_at timestamptz,
  -- Coarse provenance on the last sign-in. No raw IP anywhere in this schema.
  last_sign_in_ip_hash text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_staff_role on staff(role);
create index if not exists idx_staff_status on staff(status);

-- Per person, on top of their role. A deny always beats a grant, so one person
-- can be trusted with one extra screen, or kept out of one, without inventing
-- a role for them.
create table if not exists staff_permission_overrides (
  user_id    uuid not null references auth.users(id) on delete cascade,
  permission text not null,
  effect     text not null check (effect in ('grant','deny')),
  set_by     uuid references auth.users(id) on delete set null,
  set_at     timestamptz not null default now(),
  primary key (user_id, permission)
);

-- ── Invitations ──────────────────────────────────────────────────────────────
-- Access is granted by a person, never self-served: there is no signup route on
-- the Desk host. The token is stored hashed, used once, and expires, so a leaked
-- invite email is a 72-hour window on one address rather than a standing key.
create table if not exists staff_invites (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  full_name   text,
  role        text not null references staff_roles(name),
  token_hash  text not null unique,
  invited_by  uuid not null references auth.users(id) on delete cascade,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_staff_invites_email on staff_invites(lower(email));

-- ── The audit log ────────────────────────────────────────────────────────────
-- Reads are logged as well as writes. A tool that bypasses RLS by design has to
-- be able to answer who looked at what.
create table if not exists staff_audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references auth.users(id) on delete set null,
  action       text not null,
  target_type  text,
  target_id    text,
  workspace_id uuid references workspaces(id) on delete set null,
  summary      text,
  meta         jsonb not null default '{}'::jsonb,
  ip_hash      text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_audit_actor  on staff_audit_log(actor_id, created_at desc);
create index if not exists idx_audit_target on staff_audit_log(target_type, target_id, created_at desc);
create index if not exists idx_audit_action on staff_audit_log(action, created_at desc);

-- ── The three functions ──────────────────────────────────────────────────────
-- security definer so they read the allowlist past its own RLS, which is what
-- stops the policies recursing. The fixed search_path is the part worth noting:
-- without one, unqualified names resolve against the caller's path, so a table
-- shadowing `staff` would be read with this function's privileges.
create or replace function is_staff()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = auth.uid() and s.status = 'active'
  );
$$;

create or replace function is_super_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = auth.uid() and s.status = 'active' and s.role = 'super_admin'
  );
$$;

-- The one permission check. A super admin holds everything, including a key
-- added after their row was written. Otherwise a deny override beats a grant
-- override, which beats the role template.
create or replace function staff_can(perm text)
returns boolean language sql security definer stable
set search_path = public as $$
  with me as (
    select s.user_id, s.role from public.staff s
    where s.user_id = auth.uid() and s.status = 'active'
  )
  select case
    when not exists (select 1 from me) then false
    when (select role from me) = 'super_admin' then true
    when exists (
      select 1 from public.staff_permission_overrides o
      where o.user_id = (select user_id from me)
        and o.permission = perm and o.effect = 'deny'
    ) then false
    when exists (
      select 1 from public.staff_permission_overrides o
      where o.user_id = (select user_id from me)
        and o.permission = perm and o.effect = 'grant'
    ) then true
    else exists (
      select 1 from public.role_permissions rp
      where rp.role = (select role from me) and rp.permission = perm
    )
  end;
$$;

-- The caller's resolved permission set, for the server to hand to a screen in
-- one round trip. role_permissions itself stays readable only to a super admin,
-- so this function is how everyone else learns what they hold.
create or replace function staff_permissions()
returns setof text language sql security definer stable
set search_path = public as $$
  with me as (
    select s.user_id, s.role from public.staff s
    where s.user_id = auth.uid() and s.status = 'active'
  ),
  granted as (
    select rp.permission from public.role_permissions rp
    where rp.role = (select role from me)
    union
    select o.permission from public.staff_permission_overrides o
    where o.user_id = (select user_id from me) and o.effect = 'grant'
  )
  select g.permission from granted g
  where not exists (
    select 1 from public.staff_permission_overrides d
    where d.user_id = (select user_id from me)
      and d.permission = g.permission and d.effect = 'deny'
  );
$$;

-- ── Resolving an address to a user ───────────────────────────────────────────
-- The invite flow needs to know whether an address already has a BrandGauge
-- account, because an invited address that is also a customer must be linked
-- rather than re-created, and their password must be left alone.
--
-- PostgREST cannot see the auth schema, so this is the seam. Execute is revoked
-- from everyone except the service role: an email-to-id lookup in the hands of
-- any signed-in user is an account enumeration tool.
create or replace function auth_user_id_for_email(p_email text)
returns uuid language sql security definer stable
set search_path = public as $$
  select u.id from auth.users u where lower(u.email) = lower(p_email) limit 1;
$$;

revoke execute on function auth_user_id_for_email(text) from public;
revoke execute on function auth_user_id_for_email(text) from anon;
revoke execute on function auth_user_id_for_email(text) from authenticated;
grant  execute on function auth_user_id_for_email(text) to service_role;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table staff_roles                enable row level security;
alter table role_permissions           enable row level security;
alter table staff                      enable row level security;
alter table staff_permission_overrides enable row level security;
alter table staff_invites              enable row level security;
alter table staff_audit_log            enable row level security;

-- Staff see the roster and the role list, so "who else has access" is
-- answerable without asking. Nothing here is writable from the client: every
-- change goes through a Desk route on the service client, which checks the
-- permission and writes the audit row.
drop policy if exists staff_roles_read on staff_roles;
create policy staff_roles_read on staff_roles for select using (is_staff());

drop policy if exists staff_read on staff;
create policy staff_read on staff for select using (is_staff());

-- Who holds what is a super-admin question. Everyone else reads their own set
-- through staff_permissions().
drop policy if exists role_permissions_read on role_permissions;
create policy role_permissions_read on role_permissions
  for select using (is_super_admin());

drop policy if exists staff_overrides_read on staff_permission_overrides;
create policy staff_overrides_read on staff_permission_overrides
  for select using (user_id = auth.uid() or is_super_admin());

drop policy if exists staff_invites_read on staff_invites;
create policy staff_invites_read on staff_invites
  for select using (is_super_admin());

-- Your own trail, or everyone's with the dataset key. No update, no delete, by
-- anyone, ever: an audit log you can edit is not one.
drop policy if exists audit_read on staff_audit_log;
create policy audit_read on staff_audit_log
  for select using (actor_id = auth.uid() or staff_can('data.audit_all'));

-- ── updated_at ───────────────────────────────────────────────────────────────
create or replace function touch_staff_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists staff_updated_at on staff;
create trigger staff_updated_at before update on staff
  for each row execute function touch_staff_updated_at();

-- ── Seed the roles ───────────────────────────────────────────────────────────
insert into staff_roles (name, label, description, is_system) values
  ('support',     'Support',              'Answers the chat, reads accounts, works the inbox.', true),
  ('bizdev',      'Business development', 'Owns the pipeline: leads, accounts, adoption. Sees plan and price, cannot change them, and does not read customer content.', true),
  ('finance',     'Finance',              'Subscriptions, invoices, plan changes and what each account costs us.', true),
  ('engineer',    'Engineer',             'Ops health, background jobs, seeds, and the account detail behind a bug report.', true),
  ('admin',       'Admin',                'Everything except granting access to the Desk.', true),
  ('super_admin', 'Super admin',          'Everything, including who may use the Desk and what they may do in it.', true)
on conflict (name) do update
  set label = excluded.label, description = excluded.description, is_system = true;

-- ── Seed the role templates ──────────────────────────────────────────────────
-- Section 3.4 of docs/internal-tool-plan.md is this table in prose. Editable in
-- the Desk afterwards, so this is a starting point rather than a contract.
insert into role_permissions (role, permission) values
  -- Support: the inbox, the account behind it, and nothing about money.
  ('support','accounts.view'), ('support','accounts.note'), ('support','accounts.message'),
  ('support','support.view'), ('support','support.reply'), ('support','support.assign'),
  ('support','support.close'),
  ('support','leads.view'), ('support','leads.edit'),
  ('support','usage.view'), ('support','adoption.view'),
  ('support','data.customer_email'), ('support','data.customer_content'),

  -- Business development: the whole pipeline. Plan and price visible, not
  -- editable. No customer content: reading someone's survey responses is not a
  -- sales job.
  ('bizdev','accounts.view'), ('bizdev','accounts.note'), ('bizdev','accounts.message'),
  ('bizdev','support.view'), ('bizdev','support.reply'),
  ('bizdev','leads.view'), ('bizdev','leads.edit'), ('bizdev','leads.export'),
  ('bizdev','usage.view'), ('bizdev','adoption.view'), ('bizdev','revenue.view'),
  ('bizdev','data.customer_email'), ('bizdev','data.customer_phone'),
  ('bizdev','data.revenue_figures'),

  -- Finance: the money, and the plan change that follows from it.
  ('finance','accounts.view'), ('finance','accounts.plan_change'),
  ('finance','usage.view'),
  ('finance','revenue.view'), ('finance','revenue.edit'), ('finance','revenue.export'),
  ('finance','data.customer_email'), ('finance','data.ai_cost'),
  ('finance','data.revenue_figures'),

  -- Engineer: the machinery, plus enough of the account to chase a bug.
  ('engineer','accounts.view'), ('engineer','accounts.impersonate'),
  ('engineer','support.view'),
  ('engineer','usage.view'), ('engineer','adoption.view'),
  ('engineer','ops.view'), ('engineer','ops.run_job'), ('engineer','ops.reseed'),
  ('engineer','data.customer_email'), ('engineer','data.customer_content'),
  ('engineer','data.ai_cost'),

  -- Admin: everything but the keys to the building.
  ('admin','accounts.view'), ('admin','accounts.note'), ('admin','accounts.message'),
  ('admin','accounts.plan_change'), ('admin','accounts.impersonate'),
  ('admin','support.view'), ('admin','support.reply'), ('admin','support.assign'),
  ('admin','support.close'),
  ('admin','leads.view'), ('admin','leads.edit'), ('admin','leads.export'),
  ('admin','usage.view'), ('admin','adoption.view'),
  ('admin','revenue.view'),
  ('admin','ops.view'), ('admin','ops.run_job'), ('admin','ops.reseed'),
  ('admin','data.customer_email'), ('admin','data.customer_phone'),
  ('admin','data.customer_content'), ('admin','data.ai_cost'),
  ('admin','data.revenue_figures'),

  -- Super admin holds every key explicitly as well, so the permissions editor
  -- shows the truth rather than an empty row. staff_can() short-circuits them
  -- anyway, which is what covers a key added later.
  ('super_admin','accounts.view'), ('super_admin','accounts.note'),
  ('super_admin','accounts.message'), ('super_admin','accounts.plan_change'),
  ('super_admin','accounts.impersonate'),
  ('super_admin','support.view'), ('super_admin','support.reply'),
  ('super_admin','support.assign'), ('super_admin','support.close'),
  ('super_admin','leads.view'), ('super_admin','leads.edit'), ('super_admin','leads.export'),
  ('super_admin','usage.view'), ('super_admin','adoption.view'),
  ('super_admin','revenue.view'), ('super_admin','revenue.edit'), ('super_admin','revenue.export'),
  ('super_admin','ops.view'), ('super_admin','ops.run_job'), ('super_admin','ops.reseed'),
  ('super_admin','staff.view'), ('super_admin','staff.invite'), ('super_admin','staff.revoke'),
  ('super_admin','staff.permissions'), ('super_admin','staff.activity'),
  ('super_admin','data.customer_email'), ('super_admin','data.customer_phone'),
  ('super_admin','data.customer_content'), ('super_admin','data.ai_cost'),
  ('super_admin','data.revenue_figures'), ('super_admin','data.audit_all')
on conflict (role, permission) do nothing;

-- ── Seed the first super admin ───────────────────────────────────────────────
-- The first one is seeded here and never by a route, because a route that can
-- make a super admin out of nothing is the whole model undone. Everyone after
-- them is invited from the Desk.
insert into staff (user_id, email, full_name, job_title, role, joined_at)
select u.id, u.email, 'Emmanuel Femi-Adejobi', 'Founder', 'super_admin', now()
from auth.users u
where lower(u.email) = 'adebusuyiadejobi@gmail.com'
on conflict (user_id) do update
  set role = 'super_admin', status = 'active';

-- ── Carry the lead desk across ───────────────────────────────────────────────
-- Anyone already trusted with the lead desk becomes staff on the admin role.
-- lead_desk_admins keeps working until the lead desk itself moves.
insert into staff (user_id, email, full_name, role, joined_at)
select a.user_id, a.email, initcap(replace(split_part(a.email, '@', 1), '.', ' ')), 'admin', a.added_at
from lead_desk_admins a
on conflict (user_id) do nothing;
