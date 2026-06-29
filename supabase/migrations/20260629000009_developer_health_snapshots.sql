-- 20260629000009_developer_health_snapshots.sql
create table developer_health_snapshots (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  platform        text not null check (platform in ('github','npm','stackoverflow','devto')),
  stars           integer,
  forks           integer,
  open_issues     integer,
  contributors    integer,
  downloads_weekly integer,
  question_count  integer,
  period_end      date,
  created_at      timestamptz default now()
);
create index on developer_health_snapshots(brand_id, platform, period_end desc);
alter table developer_health_snapshots enable row level security;
create policy "workspace members" on developer_health_snapshots
  using (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));
