-- 20260706000000_brand_type_agency.sql
-- Adds 'agency' to brand_type for marketing/creative agency brands (e.g. Pinnacle
-- Media), which don't fit any existing vertical (not FMCG, not B2B SaaS).
alter table brands drop constraint if exists brands_brand_type_check;

alter table brands add constraint brands_brand_type_check
  check (brand_type in ('fmcg','fintech','venue','b2b_saas','marketplace','beverage_alcohol','b2b_distribution','agency'));
