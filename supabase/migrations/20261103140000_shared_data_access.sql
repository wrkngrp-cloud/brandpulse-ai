-- Agency-style data access.
--
-- Brands already give agencies access to their data every day, without an
-- OAuth screen: add an email as a Viewer on a GA4 property, or add a partner
-- in Meta Business Manager. This lets them do the same with BrandGauge, so a
-- pilot can start before our Meta and Google app verification is done.
--
-- The risk this migration exists to close: once brands share with
-- BrandGauge's own account, that account can read every property shared with
-- it. A property ID is not a secret, so a signed-in user could type someone
-- else's and read their numbers. So a shared connection starts 'pending',
-- syncs nothing, and only a BrandGauge staff member holding
-- ops.approve_access can make it 'active' (from the Desk, which writes with
-- the service role). The trigger below stops a customer's own session from
-- doing it through the RLS policy they already have on these tables.

-- ── GA4 ──────────────────────────────────────────────────────────────────────
alter table ga4_connections
  add column if not exists auth_mode text not null default 'oauth'
    check (auth_mode in ('oauth', 'shared')),
  add column if not exists access_status text not null default 'active'
    check (access_status in ('pending', 'active', 'rejected')),
  add column if not exists requested_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table ga4_connections alter column access_token drop not null;
alter table ga4_connections drop constraint if exists ga4_connections_token_for_oauth;
alter table ga4_connections add constraint ga4_connections_token_for_oauth
  check (auth_mode = 'shared' or access_token is not null);

-- One brand per shared property: the first claim holds it until staff decide.
create unique index if not exists ga4_connections_shared_property
  on ga4_connections (property_id) where auth_mode = 'shared' and access_status <> 'rejected';

-- ── Ad accounts ──────────────────────────────────────────────────────────────
alter table digital_ad_accounts
  add column if not exists auth_mode text not null default 'oauth'
    check (auth_mode in ('oauth', 'shared')),
  add column if not exists access_status text not null default 'active'
    check (access_status in ('pending', 'active', 'rejected')),
  add column if not exists requested_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table digital_ad_accounts alter column access_token drop not null;
alter table digital_ad_accounts drop constraint if exists digital_ad_accounts_token_for_oauth;
alter table digital_ad_accounts add constraint digital_ad_accounts_token_for_oauth
  check (auth_mode = 'shared' or access_token is not null);

create unique index if not exists digital_ad_accounts_shared_account
  on digital_ad_accounts (platform, ad_account_id) where auth_mode = 'shared' and access_status <> 'rejected';

-- ── Only staff activate a shared connection ─────────────────────────────────
-- A customer's session runs as `authenticated`. It may request (insert a
-- pending row), withdraw (delete) and read its own rows; it may not make a
-- shared row active, re-point an active one at another property, or turn an
-- OAuth row into a shared one. The Desk writes as service_role and is not
-- affected. Migrations and seeds run as the owner and are not affected.
create or replace function guard_shared_access() returns trigger
language plpgsql as $$
declare
  key_new text;
  key_old text;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.auth_mode <> 'shared' and (tg_op = 'INSERT' or old.auth_mode <> 'shared') then
    return new;
  end if;

  if tg_table_name = 'ga4_connections' then
    key_new := new.property_id;
    key_old := case when tg_op = 'UPDATE' then old.property_id end;
  else
    key_new := new.ad_account_id;
    key_old := case when tg_op = 'UPDATE' then old.ad_account_id end;
  end if;

  if tg_op = 'INSERT' then
    if new.access_status <> 'pending' then
      raise exception 'A shared connection starts pending until BrandGauge confirms it.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE
  if old.auth_mode <> new.auth_mode then
    raise exception 'A connection cannot change how it is authorised.' using errcode = '42501';
  end if;
  if key_new is distinct from key_old or new.access_status is distinct from old.access_status then
    raise exception 'Only BrandGauge can change which account a shared connection reads, or its status.'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_ga4_shared_guard on ga4_connections;
create trigger trg_ga4_shared_guard before insert or update on ga4_connections
  for each row execute function guard_shared_access();

drop trigger if exists trg_ad_accounts_shared_guard on digital_ad_accounts;
create trigger trg_ad_accounts_shared_guard before insert or update on digital_ad_accounts
  for each row execute function guard_shared_access();

-- ── The Desk permission ─────────────────────────────────────────────────────
insert into role_permissions (role, permission) values
  ('super_admin', 'ops.approve_access'),
  ('admin',       'ops.approve_access')
on conflict (role, permission) do nothing;
