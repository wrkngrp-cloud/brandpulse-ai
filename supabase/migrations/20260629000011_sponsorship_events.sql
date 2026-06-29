-- 20260629000011_sponsorship_events.sql
create table sponsorship_events (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  event_name      text not null,
  event_type      text check (event_type in ('sports','music','cultural','community','corporate')),
  start_date      date,
  end_date        date,
  estimated_reach integer,
  actual_reach    integer,
  brand_lift_pct  numeric(6,2),
  spend_ngn       numeric(20,2),
  created_at      timestamptz default now()
);
create index on sponsorship_events(brand_id, start_date desc);
alter table sponsorship_events enable row level security;
create policy "workspace members" on sponsorship_events
  using (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));
