-- 20260629000007_platform_metrics.sql
create table platform_metrics (
  id                   uuid primary key default gen_random_uuid(),
  brand_id             uuid not null references brands(id) on delete cascade,
  period_start         date not null,
  period_end           date not null,
  active_creators      integer,
  new_creators         integer,
  churned_creators     integer,
  storefronts_live     integer,
  gmv_ngn              numeric(20,2),
  avg_revenue_per_creator numeric(20,2),
  buyer_repeat_rate    numeric(6,4),
  created_at           timestamptz default now()
);
create index on platform_metrics(brand_id, period_end desc);
alter table platform_metrics enable row level security;
create policy "workspace members" on platform_metrics
  using (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));
