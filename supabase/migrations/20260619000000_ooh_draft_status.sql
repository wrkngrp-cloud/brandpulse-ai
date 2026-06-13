-- Add draft/active status to OOH sites so incomplete forms can be saved
-- without appearing in the active sites list.

alter table ooh_sites
  add column if not exists status text not null default 'active'
    check (status in ('draft', 'active'));

-- Index for efficient draft lookups per brand
create index if not exists ooh_sites_brand_status_idx
  on ooh_sites (brand_id, status);

-- Existing rows are all active
update ooh_sites set status = 'active' where status is null;
