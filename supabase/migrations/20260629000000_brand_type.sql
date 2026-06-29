-- 20260629000000_brand_type.sql
alter table brands add column if not exists brand_type text not null default 'fmcg'
  check (brand_type in ('fmcg','fintech','venue','b2b_saas','marketplace','beverage_alcohol','b2b_distribution'));

comment on column brands.brand_type is 'Drives funnel signal selection and BHI weight presets per industry';
