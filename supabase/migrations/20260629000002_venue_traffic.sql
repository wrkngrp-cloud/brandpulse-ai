-- 20260629000002_venue_traffic.sql
create table venue_traffic (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references brands(id) on delete cascade,
  date        date not null,
  covers      integer,
  capacity    integer,
  reservation_count integer,
  walk_in_count     integer,
  occasion_type text check (occasion_type in ('birthday','corporate','casual','special_event','other')),
  source      text default 'manual',
  created_at  timestamptz default now()
);
create index on venue_traffic(brand_id, date);
alter table venue_traffic enable row level security;
create policy "workspace members" on venue_traffic
  using (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));
