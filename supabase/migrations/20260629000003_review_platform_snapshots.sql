-- 20260629000003_review_platform_snapshots.sql
create table review_platform_snapshots (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null references brands(id) on delete cascade,
  platform       text not null check (platform in ('play_store','app_store','google_maps','tripadvisor','g2','capterra','product_hunt','jumia','konga')),
  rating         numeric(3,2),
  review_count   integer,
  review_velocity integer,
  period_start   date,
  period_end     date,
  place_id       text,
  metadata       jsonb default '{}',
  created_at     timestamptz default now()
);
create index on review_platform_snapshots(brand_id, platform, period_end desc);
alter table review_platform_snapshots enable row level security;
create policy "workspace members" on review_platform_snapshots
  using (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));
