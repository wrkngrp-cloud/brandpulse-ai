-- B1. Press mentions table
create table if not exists press_mentions (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  headline        text not null,
  publication     text not null,
  url             text,
  published_at    date not null,
  sentiment_score numeric(4,3),   -- -1.0 to 1.0
  sentiment_label text check (sentiment_label in ('positive','neutral','negative')),
  estimated_reach integer,        -- publication's estimated readership
  emv             numeric(12,2),  -- calculated EMV for this mention
  mention_type    text default 'press' check (mention_type in ('press','blog','podcast','broadcast')),
  is_competitor   boolean default false,
  competitor_name text,           -- if is_competitor=true
  raw_snippet     text,           -- excerpt from article
  crawl_source    text,           -- 'google_news_rss', 'firecrawl', 'manual'
  created_at      timestamptz not null default now(),
  unique(brand_id, url)
);

create index if not exists idx_press_brand_date on press_mentions(brand_id, published_at desc);
create index if not exists idx_press_sentiment on press_mentions(brand_id, sentiment_label);

alter table press_mentions enable row level security;

create policy press_mentions_workspace_member on press_mentions for all using (
  brand_id in (
    select b.id from brands b
    join workspace_members wm on wm.workspace_id = b.workspace_id
    where wm.user_id = auth.uid()
  )
);

-- B1. EMV records table (earned media across all sources)
create table if not exists emv_records (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  source_type     text not null check (source_type in ('press','social_organic','influencer','event','podcast','broadcast')),
  initiative_name text,
  impressions     bigint default 0,
  reach           bigint default 0,
  engagements     bigint default 0,
  cpm_benchmark   numeric(8,2) default 500,   -- NGN benchmark
  cpe_benchmark   numeric(8,2) default 50,    -- NGN benchmark
  emv             numeric(14,2) not null,
  currency        text default 'NGN',
  period_start    date not null,
  period_end      date not null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_emv_brand on emv_records(brand_id, period_start desc);

alter table emv_records enable row level security;

create policy emv_workspace_member on emv_records for all using (
  brand_id in (
    select b.id from brands b
    join workspace_members wm on wm.workspace_id = b.workspace_id
    where wm.user_id = auth.uid()
  )
);
