-- Extend digital_performance_daily with objective and full actions breakdown
alter table digital_performance_daily
  add column if not exists objective text,
  add column if not exists actions   jsonb default '{}';

-- Campaign targets — brands set KPI goals per campaign
create table if not exists campaign_targets (
  id                   uuid primary key default gen_random_uuid(),
  brand_id             uuid not null references brands(id) on delete cascade,
  platform_campaign_id text not null,
  campaign_name        text,
  platform             text,
  metric               text not null,
  comparator           text not null check (comparator in ('lte', 'gte')),
  target_value         numeric not null,
  period               text not null default 'campaign' check (period in ('daily', 'campaign')),
  last_status          text check (last_status in ('on_track', 'off_track', 'not_enough_data')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (brand_id, platform_campaign_id, metric)
);

alter table campaign_targets enable row level security;

create policy "campaign_targets_workspace_member"
  on campaign_targets for all
  using (is_workspace_member(brand_id));

-- Notifications — in-app alerts (bell icon, target monitoring, etc.)
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references brands(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  type       text not null,
  title      text not null,
  body       text,
  href       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

create policy "notifications_workspace_member"
  on notifications for all
  using (is_workspace_member(brand_id));

-- Index for unread count queries
create index if not exists idx_notifications_brand_unread
  on notifications (brand_id, read_at)
  where read_at is null;
