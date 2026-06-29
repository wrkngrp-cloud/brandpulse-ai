-- brand_api_keys — first-party data ingestion credentials
create table brand_api_keys (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references brands(id) on delete cascade,
  name         text not null default 'Default Key',
  key_prefix   text not null,
  key_hash     text not null unique,
  last_used_at timestamptz,
  created_at   timestamptz default now(),
  revoked_at   timestamptz
);

create index on brand_api_keys(brand_id);
create index on brand_api_keys(key_hash);

alter table brand_api_keys enable row level security;
create policy "workspace members" on brand_api_keys
  using (exists (
    select 1 from brands b where b.id = brand_id
    and is_workspace_member(b.workspace_id)
  ));
