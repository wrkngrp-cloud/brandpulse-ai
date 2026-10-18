-- Our own subscriptions and invoices.
--
-- Billing is deferred until post-beta and will run on Paystack, not Stripe.
-- These tables ship now anyway, for two reasons. The revenue screens work from
-- day one on figures entered by hand, which is how a handful of beta accounts
-- are actually billed. And when Paystack is switched on, its webhook writes
-- into tables that already exist rather than tables designed under launch
-- pressure.
--
-- `provider` is how the two paths stay told apart: a row entered by a person
-- says 'manual' and keeps saying it. Nothing reconciles silently.

create table if not exists subscriptions (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  plan            text not null references plan_limits(plan),
  status          text not null default 'active'
                  check (status in ('trialing','active','past_due','cancelled')),
  -- Kobo would be the safer unit, but every price in plan_limits is already
  -- whole naira and a mixed unit is worse than a coarse one.
  amount_ngn      integer not null default 0,
  interval        text not null default 'month' check (interval in ('month','year')),
  provider        text not null default 'manual' check (provider in ('manual','paystack')),
  -- Paystack's subscription code. Unique so a replayed webhook cannot create a
  -- second subscription for the same remote object.
  provider_ref    text unique,
  current_period_start date,
  current_period_end   date,
  cancelled_at    timestamptz,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_subscriptions_ws on subscriptions(workspace_id, created_at desc);
create index if not exists idx_subscriptions_status on subscriptions(status);

create table if not exists invoices (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid references subscriptions(id) on delete set null,
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  amount_ngn      integer not null,
  status          text not null default 'draft'
                  check (status in ('draft','sent','paid','failed','refunded')),
  provider        text not null default 'manual' check (provider in ('manual','paystack')),
  provider_ref    text unique,
  period_start    date,
  period_end      date,
  paid_at         timestamptz,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_invoices_ws on invoices(workspace_id, created_at desc);
create index if not exists idx_invoices_status on invoices(status, created_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table subscriptions enable row level security;
alter table invoices      enable row level security;

-- A workspace member reads their own, because the billing page will need it.
-- They never write: what they are charged is not theirs to set.
drop policy if exists subscriptions_own_read on subscriptions;
create policy subscriptions_own_read on subscriptions
  for select using (is_workspace_member(workspace_id));

drop policy if exists invoices_own_read on invoices;
create policy invoices_own_read on invoices
  for select using (is_workspace_member(workspace_id));

-- Staff read with revenue.view and write with revenue.edit. The amounts
-- themselves are gated again in the data layer by data.revenue_figures, so a
-- role can see that a subscription exists without seeing what it is worth.
drop policy if exists subscriptions_staff_read on subscriptions;
create policy subscriptions_staff_read on subscriptions
  for select using (staff_can('revenue.view'));

drop policy if exists subscriptions_staff_write on subscriptions;
create policy subscriptions_staff_write on subscriptions
  for all using (staff_can('revenue.edit')) with check (staff_can('revenue.edit'));

drop policy if exists invoices_staff_read on invoices;
create policy invoices_staff_read on invoices
  for select using (staff_can('revenue.view'));

drop policy if exists invoices_staff_write on invoices;
create policy invoices_staff_write on invoices
  for all using (staff_can('revenue.edit')) with check (staff_can('revenue.edit'));

-- ── updated_at ───────────────────────────────────────────────────────────────
create or replace function touch_money_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists subscriptions_updated_at on subscriptions;
create trigger subscriptions_updated_at before update on subscriptions
  for each row execute function touch_money_updated_at();

drop trigger if exists invoices_updated_at on invoices;
create trigger invoices_updated_at before update on invoices
  for each row execute function touch_money_updated_at();
