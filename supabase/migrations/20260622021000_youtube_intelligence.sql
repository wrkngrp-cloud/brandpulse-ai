create table if not exists youtube_mentions (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  video_id        text not null,
  video_title     text,
  channel_name    text,
  channel_id      text,
  view_count      bigint default 0,
  like_count      bigint default 0,
  comment_count   bigint default 0,
  published_at    timestamptz,
  sentiment_score numeric(5,2),
  comment_sample  jsonb, -- array of { text: string, like_count: number }
  is_partnership  boolean default false,
  creator_deal_id uuid,
  found_at        timestamptz default now(),
  created_at      timestamptz default now(),
  unique(brand_id, video_id)
);

create index if not exists youtube_mentions_brand_id_idx on youtube_mentions(brand_id);
create index if not exists youtube_mentions_published_at_idx on youtube_mentions(published_at);
alter table youtube_mentions enable row level security;
create policy "workspace members can view youtube_mentions"
  on youtube_mentions for all
  using (is_workspace_member(workspace_id));

create table if not exists youtube_creator_deals (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  channel_name    text not null,
  channel_url     text,
  channel_id      text,
  video_url       text,
  video_id        text,
  deliverables    text,
  fee_ngn         numeric(14,2),
  promo_code      text,
  view_guarantee  bigint,
  actual_views    bigint,
  linked_campaign_id uuid references campaigns(id) on delete set null,
  deal_date       date,
  created_at      timestamptz default now()
);

alter table youtube_creator_deals enable row level security;
create policy "workspace members can manage youtube_creator_deals"
  on youtube_creator_deals for all
  using (is_workspace_member(workspace_id));

-- YouTube API key stored in a dedicated table, encrypted at rest
create table if not exists youtube_api_configs (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references brands(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  api_key     text not null, -- AES-256-GCM encrypted
  last_synced_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (brand_id)
);

alter table youtube_api_configs enable row level security;
create policy "workspace members can manage youtube_api_configs"
  on youtube_api_configs for all
  using (is_workspace_member(workspace_id));
