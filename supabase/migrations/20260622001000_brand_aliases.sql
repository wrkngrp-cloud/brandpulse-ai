alter table brands
  add column if not exists brand_aliases text[] default '{}';
