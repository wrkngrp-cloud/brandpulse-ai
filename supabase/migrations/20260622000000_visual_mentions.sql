-- E6: Visual brand mention detection
-- Stores Claude Vision analysis results for event hashtag media

create table if not exists visual_mentions (
  id                uuid        primary key default gen_random_uuid(),
  event_id          uuid        not null references events(id) on delete cascade,
  brand_id          uuid        not null references brands(id) on delete cascade,
  source_platform   text        not null default 'instagram',
  post_id           text,
  post_url          text,
  media_url         text        not null,
  hashtag           text,
  creator_username  text,
  post_caption      text,
  post_likes        integer     not null default 0,
  post_comments     integer     not null default 0,
  brand_visible     boolean     not null default false,
  confidence        text        check (confidence in ('high', 'medium', 'low')),
  detected_elements text[],
  visual_sentiment  text        check (visual_sentiment in ('positive', 'neutral', 'negative')),
  ai_description    text,
  detected_at       timestamptz not null default now()
);

create index if not exists idx_visual_mentions_event   on visual_mentions(event_id);
create index if not exists idx_visual_mentions_brand   on visual_mentions(brand_id);
create index if not exists idx_visual_mentions_visible on visual_mentions(event_id, brand_visible);

create unique index if not exists uq_visual_mentions_post on visual_mentions(event_id, post_id);

alter table visual_mentions enable row level security;

create policy visual_mentions_workspace_member on visual_mentions
  for all using (
    brand_id in (
      select b.id from brands b
      join workspace_members wm on wm.workspace_id = b.workspace_id
      where wm.user_id = auth.uid()
    )
  );
