-- Dashboard widget preferences per user per brand
create table if not exists user_dashboard_prefs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  brand_id     uuid not null references brands(id) on delete cascade,
  template     text not null default 'default',
  widget_ids   text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, brand_id)
);
alter table user_dashboard_prefs enable row level security;
create policy user_dashboard_prefs_own on user_dashboard_prefs
  for all using (user_id = auth.uid());

-- Manual metric entries — Tier 1 (no connector needed)
create table if not exists metric_manual (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references brands(id) on delete cascade,
  metric_key   text not null,
  value        numeric not null,
  currency     text not null default 'NGN',
  period_start date not null,
  period_end   date not null,
  notes        text,
  entered_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table metric_manual enable row level security;
create policy metric_manual_workspace_member on metric_manual
  for all using (
    brand_id in (
      select b.id from brands b
      join workspace_members wm on wm.workspace_id = b.workspace_id
      where wm.user_id = auth.uid()
    )
  );

-- Materialised metric time-series (populated by connectors + computations)
create table if not exists metric_daily (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references brands(id) on delete cascade,
  date         date not null,
  metric_key   text not null,
  value        numeric,
  currency     text not null default 'NGN',
  dimension    text not null default 'total',
  source       text not null default 'computed'
               check (source in ('computed','connector','manual','modelled')),
  confidence   text not null default 'medium'
               check (confidence in ('high','medium','low','modelled')),
  created_at   timestamptz not null default now(),
  unique (brand_id, date, metric_key, dimension)
);
alter table metric_daily enable row level security;
create policy metric_daily_workspace_member on metric_daily
  for all using (
    brand_id in (
      select b.id from brands b
      join workspace_members wm on wm.workspace_id = b.workspace_id
      where wm.user_id = auth.uid()
    )
  );
create index if not exists idx_metric_daily_brand_date on metric_daily (brand_id, date desc);
create index if not exists idx_metric_manual_brand_period on metric_manual (brand_id, period_start desc);
