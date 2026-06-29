-- 20260629000004_review_aspect_sentiment.sql
create table review_aspect_sentiment (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references brands(id) on delete cascade,
  platform    text not null,
  period_start date,
  period_end  date,
  aspect      text not null check (aspect in ('food','service','ambiance','value','reliability','feature_quality','support','price_fairness','music','cleanliness')),
  sentiment   text not null check (sentiment in ('positive','neutral','negative')),
  score       numeric(5,2),
  mention_count integer,
  created_at  timestamptz default now()
);
create index on review_aspect_sentiment(brand_id, platform, period_end desc);
alter table review_aspect_sentiment enable row level security;
create policy "workspace members" on review_aspect_sentiment
  using (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));
