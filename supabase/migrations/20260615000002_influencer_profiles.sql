alter table influencers
  add column if not exists profile_url  text,
  add column if not exists social_urls  jsonb not null default '[]'::jsonb,
  add column if not exists profile_data jsonb not null default '{}'::jsonb,
  add column if not exists brand_fit    jsonb not null default '{}'::jsonb;
