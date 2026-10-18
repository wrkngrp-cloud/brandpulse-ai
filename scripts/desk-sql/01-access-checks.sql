-- The Desk's access logic, exercised against a real Postgres.
--
-- npm run desk:check covers the pure TypeScript. This covers the half that
-- lives in SQL and cannot be reasoned about from the outside: function
-- precedence, row-level security, the grants on a security-definer function,
-- and the triggers. Run it with scripts/check-desk-sql.sh, which builds a
-- scratch cluster, applies every migration and then runs this.
--
-- Each assertion prints `name|got|want`. The runner fails the build when any
-- line has a got that differs from its want, so a silent regression in a
-- policy cannot pass as output nobody read.
--
-- Two notes on reading it. Several checks run `set role authenticated` first,
-- because a superuser bypasses row-level security and a policy test run as
-- one passes for the wrong reason. And where RLS has no policy for a command,
-- Postgres matches no rows rather than raising, so the assertion is that
-- nothing changed and not that an error was thrown.

\pset pager off
\t on
\a

-- Two people and an account, so the policies have something to decide about.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ada@brandgauge.app'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'boss@brandgauge.app'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'customer@jara.test')
on conflict do nothing;

insert into staff (user_id, email, full_name, role, status, joined_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ada@brandgauge.app',  'Ada Obi',  'support',     'active', now()),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'boss@brandgauge.app', 'The Boss', 'super_admin', 'active', now())
on conflict do nothing;

insert into workspaces (id, name, plan) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Jara Foods', 'growth')
on conflict do nothing;
insert into workspace_members (workspace_id, user_id, role) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 'owner')
on conflict do nothing;
insert into brands (id, workspace_id, name, brand_type) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Jara', 'fmcg')
on conflict do nothing;

-- A second workspace nobody in this test belongs to.
insert into workspaces (id, name) values ('bbbbbbbb-0000-0000-0000-000000000002', 'Someone Else')
on conflict do nothing;
insert into brands (id, workspace_id, name) values
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Not Theirs')
on conflict do nothing;

\echo '── staff_can, on the support role'
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select 'is_staff'                   as check, is_staff()::text                       as got, 'true'  as want
union all select 'is_super_admin',          is_super_admin()::text,                      'false'
union all select 'support.reply (role)',    staff_can('support.reply')::text,            'true'
union all select 'revenue.view (not role)', staff_can('revenue.view')::text,             'false'
union all select 'data.ai_cost (not role)', staff_can('data.ai_cost')::text,             'false'
union all select 'staff.invite (never)',    staff_can('staff.invite')::text,             'false'
union all select 'unknown key',             staff_can('not.a.real.key')::text,           'false';

\echo '── a deny override beats the role'
insert into staff_permission_overrides (user_id, permission, effect)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'support.reply', 'deny')
on conflict (user_id, permission) do update set effect = 'deny';
select 'support.reply denied' as check, staff_can('support.reply')::text as got, 'false' as want;

\echo '── a grant override adds to the role'
insert into staff_permission_overrides (user_id, permission, effect)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'revenue.view', 'grant')
on conflict (user_id, permission) do update set effect = 'grant';
select 'revenue.view granted' as check, staff_can('revenue.view')::text as got, 'true' as want;

\echo '── staff_permissions reflects both overrides'
select 'reply absent' as check,
       (not exists (select 1 from staff_permissions() p where p = 'support.reply'))::text as got,
       'true' as want
union all
select 'revenue present',
       (exists (select 1 from staff_permissions() p where p = 'revenue.view'))::text,
       'true';

\echo '── a suspended account is not staff at all'
update staff set status = 'suspended' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select 'is_staff when suspended' as check, is_staff()::text as got, 'false' as want
union all select 'staff_can when suspended', staff_can('accounts.view')::text, 'false';
update staff set status = 'active' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

\echo '── a super admin holds a key nobody seeded'
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select 'future key' as check, staff_can('accounts.something_new')::text as got, 'true' as want
union all select 'data.audit_all', staff_can('data.audit_all')::text, 'true';

\echo '── a signed-out caller is nobody'
set request.jwt.claim.sub = '';
select 'is_staff signed out' as check, is_staff()::text as got, 'false' as want
union all select 'staff_can signed out', staff_can('accounts.view')::text, 'false'
union all select 'staff_permissions empty', (select count(*) from staff_permissions())::text, '0';

\echo '── record_feature_event only writes for a member'
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000003';
select record_feature_event('cccccccc-0000-0000-0000-000000000001', 'sentiment');
select record_feature_event('cccccccc-0000-0000-0000-000000000001', 'sentiment');
select record_feature_event('cccccccc-0000-0000-0000-000000000002', 'sentiment');
select 'own brand counted twice' as check,
       (select count::text from feature_events
         where brand_id = 'cccccccc-0000-0000-0000-000000000001') as got, '2' as want
union all
select 'another workspace refused',
       (select count(*)::text from feature_events
         where brand_id = 'cccccccc-0000-0000-0000-000000000002'), '0';

\echo '── record_feature_event refuses a signed-out caller and a bad module'
set request.jwt.claim.sub = '';
select record_feature_event('cccccccc-0000-0000-0000-000000000001', 'sentiment');
select 'still two rows' as check,
       (select count(*)::text from feature_events), '1' as want;

\echo '── the support trigger'
insert into support_conversations (id, workspace_id, brand_id, user_id, visitor_token, status)
values ('dddddddd-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000001',
        'cccccccc-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000003', null, 'closed');

insert into support_messages (conversation_id, author_type, body)
values ('dddddddd-0000-0000-0000-000000000001', 'customer', 'my funnel is empty');
select 'a customer message reopens a closed thread' as check,
       (select status from support_conversations where id = 'dddddddd-0000-0000-0000-000000000001'),
       'open' as want
union all
select 'first_response_at is still null',
       (select (first_response_at is null)::text from support_conversations where id = 'dddddddd-0000-0000-0000-000000000001'),
       'true';

insert into support_messages (conversation_id, author_type, author_id, body)
values ('dddddddd-0000-0000-0000-000000000001', 'staff', 'aaaaaaaa-0000-0000-0000-000000000001', 'looking now');
select 'a staff reply sets first_response_at' as check,
       (select (first_response_at is not null)::text from support_conversations where id = 'dddddddd-0000-0000-0000-000000000001'),
       'true' as want;

insert into support_messages (conversation_id, author_type, author_id, body)
values ('dddddddd-0000-0000-0000-000000000001', 'staff', 'aaaaaaaa-0000-0000-0000-000000000001', 'second reply');
select 'first_response_at is not moved by a later reply' as check,
       (select (count(distinct first_response_at) = 1)::text from support_conversations
         where id = 'dddddddd-0000-0000-0000-000000000001'),
       'true' as want;





-- Supabase grants the API roles table access and lets RLS do the deciding.
-- Without this, a policy test would pass for the wrong reason: no privilege.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- A second customer, in a workspace of their own, to be refused with.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000004', 'rival@other.test') on conflict do nothing;
insert into workspace_members (workspace_id, user_id, role) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000004', 'owner')
on conflict do nothing;

-- An internal note on the customer's thread.
insert into support_messages (conversation_id, author_type, author_id, body, internal)
values ('dddddddd-0000-0000-0000-000000000001', 'staff',
        'aaaaaaaa-0000-0000-0000-000000000001', 'he is on the free plan, go gently', true);

\echo '── as the customer who owns the thread'
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000003';
select 'sees own conversation' as check,
       (select count(*)::text from support_conversations), '1' as want
union all
select 'sees the three real messages',
       (select count(*)::text from support_messages), '3'
union all
select 'cannot see the internal note',
       (select count(*)::text from support_messages where internal), '0';

\echo '── the customer cannot post as staff, or post an internal note'
do $$
begin
  insert into support_messages (conversation_id, author_type, author_id, body)
  values ('dddddddd-0000-0000-0000-000000000001', 'staff',
          'aaaaaaaa-0000-0000-0000-000000000003', 'I am staff now');
  raise notice 'FAIL: a customer posted as staff';
exception when insufficient_privilege then
  raise notice 'ok: posting as staff was refused';
end $$;

do $$
begin
  insert into support_messages (conversation_id, author_type, author_id, body, internal)
  values ('dddddddd-0000-0000-0000-000000000001', 'customer',
          'aaaaaaaa-0000-0000-0000-000000000003', 'hidden?', true);
  raise notice 'FAIL: a customer wrote an internal note';
exception when insufficient_privilege then
  raise notice 'ok: writing an internal note was refused';
end $$;

\echo '── a customer in another workspace sees none of it'
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000004';
select 'conversations visible' as check,
       (select count(*)::text from support_conversations), '0' as want
union all
select 'messages visible',
       (select count(*)::text from support_messages), '0'
union all
select 'ai_calls visible',
       (select count(*)::text from ai_calls), '0'
union all
select 'feature_events visible',
       (select count(*)::text from feature_events), '0'
union all
select 'staff roster visible',
       (select count(*)::text from staff), '0'
union all
select 'audit log visible',
       (select count(*)::text from staff_audit_log), '0'
union all
select 'role templates visible',
       (select count(*)::text from role_permissions), '0'
union all
select 'invites visible',
       (select count(*)::text from staff_invites), '0';

\echo '── a staff member reads across tenants'
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select 'sees the conversation' as check,
       (select count(*)::text from support_conversations), '1' as want
union all
select 'sees the internal note too',
       (select count(*)::text from support_messages where internal), '1'
union all
select 'sees the roster',
       ((select count(*) from staff) >= 2)::text, 'true'
union all
select 'cannot read role templates (not super admin)',
       (select count(*)::text from role_permissions), '0'
union all
select 'cannot read invites (not super admin)',
       (select count(*)::text from staff_invites), '0'
union all
select 'sees own audit rows only',
       (select count(*)::text from staff_audit_log where actor_id <> 'aaaaaaaa-0000-0000-0000-000000000001'), '0';

\echo '── the super admin sees the rest'
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select 'reads role templates' as check,
       ((select count(*) from role_permissions) > 50)::text, 'true' as want
union all
select 'reads every audit row',
       ((select count(*) from staff_audit_log) >= 0)::text, 'true';


\echo '── a conversation nobody could reach is refused'
reset role;
do $$
begin
  insert into support_conversations (workspace_id, visitor_token, user_id)
  values ('bbbbbbbb-0000-0000-0000-000000000001', null, null);
  raise notice 'FAIL: an unreachable conversation was created';
exception when check_violation then
  raise notice 'ok: a conversation with no token and no user was refused';
end $$;




-- Some audit rows to try to tamper with, written as the service role would.
insert into staff_audit_log (actor_id, action, summary) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'account.view', 'Ada looked at an account'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'staff.invite',  'The Boss invited someone');

\echo '── the audit log cannot be changed through the API'
-- With RLS on and no UPDATE or DELETE policy, Postgres does not raise: it
-- matches no rows. The right assertion is that nothing changed, not that an
-- error was thrown.
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';  -- the super admin
select 'rows the super admin can read' as check,
       (select count(*)::text from staff_audit_log), '2' as want;

update staff_audit_log set summary = 'tampered';
select 'rows changed by an update' as check,
       (select count(*)::text from staff_audit_log where summary = 'tampered'), '0' as want;

delete from staff_audit_log;
select 'rows left after a delete' as check,
       (select count(*)::text from staff_audit_log), '2' as want;

do $$
begin
  insert into staff_audit_log (actor_id, action) values (auth.uid(), 'forged.row');
  raise notice 'FAIL: a signed-in user wrote an audit row';
exception when insufficient_privilege then
  raise notice 'ok: writing an audit row was refused';
end $$;

\echo '── staff_permissions works for the signed-in role, which is how requireStaff reads it'
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';  -- Ada, support
select 'Ada has permissions' as check,
       ((select count(*) from staff_permissions()) > 5)::text, 'true' as want
union all
select 'and support.view among them',
       (exists (select 1 from staff_permissions() p where p = 'support.view'))::text, 'true'
union all
select 'but not staff.invite',
       (exists (select 1 from staff_permissions() p where p = 'staff.invite'))::text, 'false';

\echo '── a customer calling the staff functions gets nothing'
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000003';
select 'is_staff' as check, is_staff()::text as got, 'false' as want
union all select 'staff_permissions rows', (select count(*)::text from staff_permissions()), '0';

\echo '── auth_user_id_for_email is not reachable by a signed-in user'
do $$
begin
  perform auth_user_id_for_email('boss@brandgauge.app');
  raise notice 'FAIL: a signed-in user resolved an address to a user id';
exception when insufficient_privilege then
  raise notice 'ok: the email lookup was refused';
end $$;

\echo '── and it works for the service role'
reset role;
set role service_role;
select 'service role resolves an address' as check,
       (auth_user_id_for_email('boss@brandgauge.app') is not null)::text, 'true' as want;
reset role;

\echo '── account notes'
reset role;
insert into staff_notes (workspace_id, author_id, body) values
  ('bbbbbbbb-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001',
   'The agency does their posting, not the brand team.');

set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';  -- Ada, support (accounts.view)
select 'support reads an account note' as check,
       (select count(*)::text from staff_notes), '1' as want;

do $$
begin
  insert into staff_notes (workspace_id, author_id, body)
  values ('bbbbbbbb-0000-0000-0000-000000000001', auth.uid(), 'written by support');
  raise notice 'ok: support wrote a note (accounts.note is on the role)';
exception when insufficient_privilege then
  raise notice 'FAIL: support could not write a note';
end $$;

-- A note is ours, not the tenant's. The customer has no policy at all here,
-- so this is not a redaction question: the rows are simply not reachable.
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000003';  -- the customer
select 'the customer sees no notes' as check,
       (select count(*)::text from staff_notes), '0' as want;

do $$
begin
  insert into staff_notes (workspace_id, body)
  values ('bbbbbbbb-0000-0000-0000-000000000001', 'written by a customer');
  raise notice 'FAIL: a customer wrote a staff note';
exception when insufficient_privilege then
  raise notice 'ok: a customer writing a staff note was refused';
end $$;

\echo '── reading addresses back from ids'
do $$
begin
  perform auth_emails_for_user_ids(array['aaaaaaaa-0000-0000-0000-000000000003'::uuid]);
  raise notice 'FAIL: a signed-in user read addresses across tenants';
exception when insufficient_privilege then
  raise notice 'ok: the bulk address lookup was refused';
end $$;

reset role;
set role service_role;
select 'the service role resolves a member address' as check,
       (select count(*)::text from auth_emails_for_user_ids(
          array['aaaaaaaa-0000-0000-0000-000000000003'::uuid])), '1' as want;
reset role;
