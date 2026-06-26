-- AI Visibility Tracker: brand presence in ChatGPT, Gemini, Perplexity

create table if not exists ai_visibility_checks (
  id                  uuid primary key default gen_random_uuid(),
  brand_id            uuid not null references brands(id) on delete cascade,
  platform            text not null check (platform in ('chatgpt', 'gemini', 'perplexity')),
  question            text not null,
  response_excerpt    text,
  brand_mentioned     boolean not null default false,
  mention_position    text check (mention_position in ('early', 'mid', 'late')),
  tone                text check (tone in ('positive', 'neutral', 'negative')),
  competitors_mentioned text[] default '{}',
  checked_at          timestamptz not null default now(),
  week_of             date not null
);
create index idx_avc_brand_week on ai_visibility_checks(brand_id, week_of desc);

create table if not exists ai_visibility_scores (
  id                  uuid primary key default gen_random_uuid(),
  brand_id            uuid not null references brands(id) on delete cascade,
  week_of             date not null,
  visibility_score    int not null default 0,
  chatgpt_score       int,
  gemini_score        int,
  perplexity_score    int,
  questions_asked     int not null default 0,
  total_mentions      int not null default 0,
  platforms_active    text[] default '{}',
  top_competitors     text[] default '{}',
  ai_recommendation   text,
  created_at          timestamptz not null default now(),
  unique(brand_id, week_of)
);
create index idx_avs_brand on ai_visibility_scores(brand_id, week_of desc);

alter table ai_visibility_checks enable row level security;
create policy avc_workspace_member on ai_visibility_checks for all using (
  brand_id in (
    select b.id from brands b
    join workspace_members wm on wm.workspace_id = b.workspace_id
    where wm.user_id = auth.uid()
  )
);

alter table ai_visibility_scores enable row level security;
create policy avs_workspace_member on ai_visibility_scores for all using (
  brand_id in (
    select b.id from brands b
    join workspace_members wm on wm.workspace_id = b.workspace_id
    where wm.user_id = auth.uid()
  )
);
