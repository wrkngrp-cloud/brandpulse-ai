create table crawl_runs (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null references brands(id) on delete cascade,
  trigger_type   text not null default 'cron',   -- 'cron' | 'manual'
  status         text not null default 'running', -- 'running' | 'done' | 'error'
  mentions_found int  not null default 0,
  classified     int  not null default 0,
  started_at     timestamptz not null default now(),
  completed_at   timestamptz,
  error_message  text
);

create index idx_crawl_runs_brand_started on crawl_runs(brand_id, started_at desc);

alter table crawl_runs enable row level security;

create policy crawl_runs_all on crawl_runs for all
  using  (exists (select 1 from brands b where b.id = crawl_runs.brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = crawl_runs.brand_id and is_workspace_member(b.workspace_id)));
