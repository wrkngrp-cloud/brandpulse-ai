alter table brands
  add column if not exists monitored_hashtags text[] not null default '{}';
