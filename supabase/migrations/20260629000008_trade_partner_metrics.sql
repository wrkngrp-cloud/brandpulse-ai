-- 20260629000008_trade_partner_metrics.sql
create table trade_partner_metrics (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  period_start    date not null,
  period_end      date not null,
  active_partners integer,
  new_partners    integer,
  churned_partners integer,
  total_orders    integer,
  fill_rate       numeric(6,4),
  avg_order_value_ngn numeric(20,2),
  created_at      timestamptz default now()
);
create index on trade_partner_metrics(brand_id, period_end desc);
alter table trade_partner_metrics enable row level security;
create policy "workspace members" on trade_partner_metrics
  using (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));
