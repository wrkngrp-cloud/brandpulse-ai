-- 20260629000005_fintech_metrics.sql
create table fintech_metrics (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  period_start    date not null,
  period_end      date not null,
  mau             integer,
  dau             integer,
  new_signups     integer,
  kyc_completed   integer,
  first_txn_count integer,
  aum_ngn         numeric(20,2),
  avg_balance_ngn numeric(20,2),
  funding_frequency_days numeric(6,2),
  dormancy_rate   numeric(5,4),
  created_at      timestamptz default now()
);
create index on fintech_metrics(brand_id, period_end desc);
alter table fintech_metrics enable row level security;
create policy "workspace members" on fintech_metrics
  using (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));
