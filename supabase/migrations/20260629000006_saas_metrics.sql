-- 20260629000006_saas_metrics.sql
create table saas_metrics (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  period_start    date not null,
  period_end      date not null,
  trial_signups   integer,
  trial_converted integer,
  active_seats    integer,
  mrr_ngn         numeric(20,2),
  nrr             numeric(6,4),
  renewal_rate    numeric(6,4),
  churn_rate      numeric(6,4),
  created_at      timestamptz default now()
);
create index on saas_metrics(brand_id, period_end desc);
alter table saas_metrics enable row level security;
create policy "workspace members" on saas_metrics
  using (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));
