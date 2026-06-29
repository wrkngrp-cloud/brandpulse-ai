-- 20260629000012_markers_and_dimensions.sql

-- Feature/event launch markers
create table brand_launch_markers (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references brands(id) on delete cascade,
  label       text not null,
  marker_type text check (marker_type in ('product_launch','campaign_launch','partnership','crisis','rebrand','event','other')),
  marker_date date not null,
  notes       text,
  created_at  timestamptz default now()
);
create index on brand_launch_markers(brand_id, marker_date desc);
alter table brand_launch_markers enable row level security;
create policy "workspace members" on brand_launch_markers
  using (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

-- Audience type on mentions
alter table mentions add column if not exists audience_type text
  check (audience_type in ('consumer','creator','developer','retailer','media','general'));

-- Respondent role on nps_records
alter table nps_records add column if not exists respondent_role text default 'consumer'
  check (respondent_role in ('consumer','trade_partner','retailer','developer','decision_maker','end_user'));
