-- ad_drafts: multi-platform ad creation drafts
-- Ads start PAUSED; brand reviews before going live
create table if not exists ad_drafts (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  platform        text not null check (platform in ('meta','google','tiktok','linkedin','twitter')),

  -- Ad content
  headline        text not null,
  body            text,
  cta             text,                     -- call-to-action label e.g. 'Shop Now'
  destination_url text not null,
  media_urls      text[] default '{}',      -- uploaded asset URLs

  -- Targeting
  target_audience jsonb default '{}',       -- platform-specific targeting blob
  placement       text[],                   -- e.g. ['feed','stories','reels']

  -- Budget & schedule
  budget_daily    numeric(12,2),            -- daily budget in NGN
  budget_total    numeric(12,2),
  start_date      date,
  end_date        date,

  -- Campaign attribution
  campaign_id     text,                     -- platform campaign ID (set after push)
  adset_id        text,                     -- platform ad set ID (set after push)
  platform_ad_id  text,                     -- platform ad ID (set after push)

  -- Status lifecycle: draft → review → pushing → paused → active | failed
  status          text not null default 'draft'
                    check (status in ('draft','review','pushing','paused','active','failed')),
  push_error      text,                     -- last push error message

  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_ad_drafts_brand on ad_drafts(brand_id, status, created_at desc);

alter table ad_drafts enable row level security;

create policy ad_drafts_workspace_member on ad_drafts for all using (
  brand_id in (
    select b.id from brands b
    join workspace_members wm on wm.workspace_id = b.workspace_id
    where wm.user_id = auth.uid()
  )
);

-- Trigger to keep updated_at fresh
create or replace function set_ad_drafts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger ad_drafts_updated_at
  before update on ad_drafts
  for each row execute function set_ad_drafts_updated_at();
