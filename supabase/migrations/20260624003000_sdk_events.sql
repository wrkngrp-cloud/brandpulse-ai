-- SDK Events: lightweight pixel ingestion for brand websites
create table if not exists sdk_events (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references brands(id) on delete cascade,
  event_type  text not null,
  value       numeric(12,4),
  session_id  text,
  user_agent  text,
  page_url    text,
  referrer    text,
  metadata    jsonb default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index idx_sdk_events_brand on sdk_events(brand_id, occurred_at desc);
create index idx_sdk_events_type  on sdk_events(brand_id, event_type, occurred_at desc);

-- No RLS on insert (public ingestion) — service role handles writes
-- Read RLS for dashboard:
alter table sdk_events enable row level security;
create policy sdk_events_read on sdk_events for select using (
  brand_id in (
    select b.id from brands b
    join workspace_members wm on wm.workspace_id = b.workspace_id
    where wm.user_id = auth.uid()
  )
);
create policy sdk_events_insert_service on sdk_events for insert with check (true);

-- Pixel configs: one per brand, stores the pixel_id used in the JS snippet
create table if not exists pixel_configs (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  pixel_id        text not null unique default substr(md5(gen_random_uuid()::text), 1, 16),
  allowed_origins text[] default '{}',
  created_at      timestamptz not null default now(),
  unique (brand_id)
);
alter table pixel_configs enable row level security;
create policy pixel_configs_workspace_member on pixel_configs for all using (
  brand_id in (
    select b.id from brands b
    join workspace_members wm on wm.workspace_id = b.workspace_id
    where wm.user_id = auth.uid()
  )
);
