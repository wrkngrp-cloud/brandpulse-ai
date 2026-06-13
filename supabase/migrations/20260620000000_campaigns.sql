-- Campaign Intelligence: campaigns + campaign_channels tables
-- Add campaign_id FK to ooh_sites and events

-- ── campaigns ────────────────────────────────────────────────────────────────

create table if not exists campaigns (
  id             uuid        primary key default gen_random_uuid(),
  brand_id       uuid        not null references brands(id) on delete cascade,
  name           text        not null,
  description    text,
  objective      text        check (objective in ('awareness','consideration','conversion','retention')),
  start_date     date,
  end_date       date,                        -- null = Always On campaign
  total_budget   numeric(14,2),
  currency       char(3)     not null default 'NGN',
  status         text        not null default 'draft'
                             check (status in ('draft','active','paused','completed')),
  ai_summary     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_campaigns_brand  on campaigns(brand_id);
create index if not exists idx_campaigns_status on campaigns(brand_id, status);

-- ── campaign_channels ─────────────────────────────────────────────────────────

create table if not exists campaign_channels (
  id                uuid        primary key default gen_random_uuid(),
  campaign_id       uuid        not null references campaigns(id) on delete cascade,
  channel           text        not null
                                check (channel in ('ooh','events','digital','radio','tv','print')),
  budget_allocation numeric(14,2),
  notes             text,
  created_at        timestamptz not null default now(),
  unique (campaign_id, channel)
);

create index if not exists idx_campaign_channels_campaign on campaign_channels(campaign_id);

-- ── FK additions ──────────────────────────────────────────────────────────────

alter table ooh_sites
  add column if not exists campaign_id uuid references campaigns(id) on delete set null;

create index if not exists idx_ooh_sites_campaign on ooh_sites(campaign_id);

alter table events
  add column if not exists campaign_id uuid references campaigns(id) on delete set null;

create index if not exists idx_events_campaign on events(campaign_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table campaigns        enable row level security;
alter table campaign_channels enable row level security;

create policy campaigns_workspace_member on campaigns
  for all using (
    brand_id in (
      select b.id from brands b
      join workspace_members wm on wm.workspace_id = b.workspace_id
      where wm.user_id = auth.uid()
    )
  );

create policy campaign_channels_workspace_member on campaign_channels
  for all using (
    campaign_id in (
      select c.id from campaigns c
      join brands b on b.id = c.brand_id
      join workspace_members wm on wm.workspace_id = b.workspace_id
      where wm.user_id = auth.uid()
    )
  );
