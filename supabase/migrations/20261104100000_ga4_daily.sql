-- GA4 numbers, one row per brand per day.
--
-- The GA4 sync wrote a single running total into sdk_events with an upsert
-- on (brand_id, event_type), a constraint sdk_events does not have, so every
-- write failed while the sync still stamped last_synced_at. And no screen
-- read it. This is the table both GA4 syncs now write, by day, so the
-- Connectors card and the Monday Brief can show the trend.
create table if not exists ga4_daily (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references brands(id) on delete cascade,
  day           date not null,
  sessions      integer not null default 0,
  active_users  integer not null default 0,
  key_events    integer not null default 0,
  synced_at     timestamptz not null default now(),
  unique (brand_id, day)
);
create index if not exists idx_ga4_daily_brand_day on ga4_daily (brand_id, day desc);

alter table ga4_daily enable row level security;
create policy ga4_daily_member_read on ga4_daily for select
  using (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));
-- Written by the sync (service role) only.
