-- ── Radio ──────────────────────────────────────────────────────────────────
create table if not exists radio_stations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  frequency   text,            -- e.g. "96.9 FM"
  city        text not null,
  state       text not null,
  reach_am    integer,         -- avg listeners Morning Drive (7-10am)
  reach_pm    integer,         -- avg listeners Evening (7-10pm)
  reach_day   integer,         -- avg listeners Daytime
  network     text,            -- "Cool FM", "Wazobia", "Beat FM", etc.
  is_national boolean default false,
  created_at  timestamptz not null default now()
);
-- No RLS needed — this is a public reference table managed by admin

create table if not exists radio_schedules (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  campaign_id     uuid references campaigns(id) on delete set null,
  station_id      uuid references radio_stations(id),
  station_name    text not null,  -- denormalised for import flexibility
  daypart         text not null check (daypart in ('early_morning','morning_drive','daytime','afternoon_drive','evening','late_night')),
  spot_date       date not null,
  spot_time       text,           -- HH:MM
  duration_sec    integer not null check (duration_sec in (10,15,30,45,60)),
  spots_planned   integer not null default 1,
  spots_aired     integer,
  material_name   text,
  rate_card       numeric(12,2),
  discount_pct    numeric(5,2) default 0,
  net_cost        numeric(12,2),
  currency        text not null default 'NGN',
  status          text not null default 'scheduled' check (status in ('scheduled','aired','missed','make_good')),
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_radio_brand_date on radio_schedules(brand_id, spot_date desc);

alter table radio_schedules enable row level security;
create policy radio_schedules_workspace_member on radio_schedules for all using (
  brand_id in (select b.id from brands b join workspace_members wm on wm.workspace_id = b.workspace_id where wm.user_id = auth.uid())
);

-- ── TV ─────────────────────────────────────────────────────────────────────
create table if not exists tv_channels (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null check (type in ('fta_national','fta_regional','pay_tv','streaming')),
  platform    text,            -- "DSTV", "GOtv", "Free-to-air"
  reach_prime integer,         -- avg HH viewers Prime Time
  reach_day   integer,
  created_at  timestamptz not null default now()
);

create table if not exists tv_schedules (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  campaign_id     uuid references campaigns(id) on delete set null,
  channel_id      uuid references tv_channels(id),
  channel_name    text not null,
  programme       text,
  daypart         text not null check (daypart in ('breakfast','daytime','early_fringe','prime_time','late_fringe')),
  spot_date       date not null,
  tx_time         text,
  duration_sec    integer not null check (duration_sec in (10,15,30,45,60)),
  spots_planned   integer not null default 1,
  spots_aired     integer,
  grp_planned     numeric(6,2),
  grp_delivered   numeric(6,2),
  material_name   text,
  rate_card       numeric(12,2),
  discount_pct    numeric(5,2) default 0,
  net_cost        numeric(12,2),
  currency        text not null default 'NGN',
  status          text not null default 'scheduled' check (status in ('scheduled','aired','missed','make_good')),
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_tv_brand_date on tv_schedules(brand_id, spot_date desc);

alter table tv_schedules enable row level security;
create policy tv_schedules_workspace_member on tv_schedules for all using (
  brand_id in (select b.id from brands b join workspace_members wm on wm.workspace_id = b.workspace_id where wm.user_id = auth.uid())
);

-- ── Print ───────────────────────────────────────────────────────────────────
create table if not exists print_publications (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  type              text not null check (type in ('newspaper','magazine','online_native')),
  circulation       integer,       -- ABC Nigeria certified circulation
  readership_mult   numeric(4,1) default 4.0,  -- pass-along multiplier
  primary_demo      text,          -- "mass market", "business/professional", "youth"
  created_at        timestamptz not null default now()
);

create table if not exists print_placements (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  campaign_id     uuid references campaigns(id) on delete set null,
  publication_id  uuid references print_publications(id),
  publication_name text not null,
  edition_date    date not null,
  position        text not null check (position in ('front_page','back_page','page_3','rop_interior','centrespread')),
  size            text not null check (size in ('full_page','half_page','quarter_page','strip','jacket')),
  colour          text not null default 'full_colour' check (colour in ('full_colour','black_white')),
  rate_card       numeric(12,2),
  discount_pct    numeric(5,2) default 0,
  net_cost        numeric(12,2),
  insertions      integer not null default 1,
  currency        text not null default 'NGN',
  attribution_url text,          -- landing page URL for QR
  vanity_slug     text unique,   -- for /go/[slug] print attribution
  qr_scan_count   integer not null default 0,
  status          text not null default 'scheduled' check (status in ('scheduled','published','cancelled')),
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_print_brand_date on print_placements(brand_id, edition_date desc);

-- Extend /go/[slug] to handle print placements (in addition to OOH)
create table if not exists print_visits (
  id           uuid primary key default gen_random_uuid(),
  placement_id uuid not null references print_placements(id) on delete cascade,
  brand_id     uuid not null references brands(id) on delete cascade,
  ip_region    text,
  device_type  text,
  referrer     text,
  visited_at   timestamptz not null default now()
);

create or replace function increment_print_scans(placement_id uuid)
returns void language sql security definer as $$
  update print_placements set qr_scan_count = qr_scan_count + 1 where id = placement_id;
$$;

alter table print_placements enable row level security;
create policy print_placements_workspace_member on print_placements for all using (
  brand_id in (select b.id from brands b join workspace_members wm on wm.workspace_id = b.workspace_id where wm.user_id = auth.uid())
);

alter table print_visits enable row level security;
create policy print_visits_workspace_member on print_visits for all using (
  brand_id in (select b.id from brands b join workspace_members wm on wm.workspace_id = b.workspace_id where wm.user_id = auth.uid())
);
