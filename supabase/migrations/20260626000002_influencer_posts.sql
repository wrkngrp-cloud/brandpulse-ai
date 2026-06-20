-- influencer_posts: tracks post URLs submitted by brands for campaign-linked influencers
-- Stores raw engagement metrics (manually entered from creator insights) + full Claude analysis

create table if not exists influencer_posts (
  id                uuid primary key default gen_random_uuid(),
  brand_id          uuid not null references brands(id) on delete cascade,
  influencer_id     uuid not null references influencers(id) on delete cascade,
  campaign_id       uuid references campaigns(id) on delete set null,

  -- The post being evaluated
  post_url          text not null,
  platform          text not null,        -- instagram | tiktok | twitter | youtube | facebook
  post_type         text,                 -- reel | feed | story | short | video | tweet | post

  -- Engagement metrics (entered manually from creator's insights dashboard)
  views             bigint,
  likes             bigint,
  comments          bigint,
  shares            bigint,
  saves             bigint,
  reach             bigint,

  -- Optional comment samples for sentiment analysis (pasted by the brand)
  comment_samples   text,                 -- up to ~3000 chars

  -- AI analysis (full structured JSON from Claude)
  analysis          jsonb,
  overall_score     integer,              -- 0-100, cached from analysis.fit_verdict.score
  analyzed_at       timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_influencer_posts_influencer on influencer_posts(influencer_id, created_at desc);
create index if not exists idx_influencer_posts_campaign   on influencer_posts(campaign_id, brand_id);
create index if not exists idx_influencer_posts_brand      on influencer_posts(brand_id, created_at desc);

alter table influencer_posts enable row level security;

create policy influencer_posts_workspace_member on influencer_posts
  for all using (
    brand_id in (
      select b.id from brands b
      join workspace_members wm on wm.workspace_id = b.workspace_id
      where wm.user_id = auth.uid()
    )
  );

create or replace function set_influencer_posts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger influencer_posts_updated_at
  before update on influencer_posts
  for each row execute function set_influencer_posts_updated_at();
