-- digital_ad_accounts: one row per platform per brand
create table if not exists digital_ad_accounts (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  platform        text not null check (platform in ('meta','google','tiktok','linkedin','twitter')),
  account_id      text not null,  -- platform's ad account ID
  account_name    text,
  access_token    text not null,  -- AES-256-GCM encrypted
  refresh_token   text,           -- encrypted
  token_expiry    timestamptz,
  ad_account_id   text,           -- Meta: act_XXXXXXXXX, Google: customer ID
  currency        text default 'NGN',
  sync_status     text not null default 'active' check (sync_status in ('active','paused','error','disconnected')),
  last_synced_at  timestamptz,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(brand_id, platform, account_id)
);

alter table digital_ad_accounts enable row level security;
create policy digital_ad_accounts_workspace_member on digital_ad_accounts for all using (
  brand_id in (
    select b.id from brands b
    join workspace_members wm on wm.workspace_id = b.workspace_id
    where wm.user_id = auth.uid()
  )
);

-- digital_performance_daily: daily metrics per campaign per platform
create table if not exists digital_performance_daily (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  account_id      uuid references digital_ad_accounts(id) on delete cascade,
  platform        text not null,
  date            date not null,
  campaign_id     text,           -- platform's campaign ID string
  campaign_name   text,
  adset_id        text,
  adset_name      text,
  spend           numeric(12,2) default 0,
  impressions     bigint default 0,
  reach           bigint default 0,
  clicks          bigint default 0,
  ctr             numeric(6,4),   -- percentage as decimal e.g. 0.023
  cpm             numeric(10,2),  -- cost per thousand
  cpc             numeric(10,2),
  cpa             numeric(10,2),
  roas            numeric(8,4),
  frequency       numeric(6,2),
  video_views     bigint,
  video_view_rate numeric(6,4),
  conversions     bigint default 0,
  currency        text default 'NGN',
  created_at      timestamptz not null default now(),
  unique(brand_id, platform, date, campaign_id, adset_id)
);

create index if not exists idx_dpd_brand_date on digital_performance_daily(brand_id, date desc);
create index if not exists idx_dpd_platform on digital_performance_daily(brand_id, platform, date desc);

alter table digital_performance_daily enable row level security;
create policy digital_performance_daily_workspace_member on digital_performance_daily for all using (
  brand_id in (
    select b.id from brands b
    join workspace_members wm on wm.workspace_id = b.workspace_id
    where wm.user_id = auth.uid()
  )
);
