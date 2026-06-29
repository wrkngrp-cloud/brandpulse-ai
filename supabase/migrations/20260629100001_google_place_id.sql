-- google_place_id on brands — for venue Google Maps reputation sync
-- review_platform_snapshots and brand_type are already created in 20260629000000/000003
alter table brands add column if not exists google_place_id text;
comment on column brands.google_place_id is 'Google Maps Place ID for venue reputation sync (starts with ChIJ...)';
