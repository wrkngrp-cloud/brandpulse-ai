create table if not exists hubspot_connections (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null references brands(id) on delete cascade,
  portal_id      text,
  access_token   text not null,
  refresh_token  text,
  token_expiry   timestamptz,
  last_synced_at timestamptz,
  last_error     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (brand_id)
);
alter table hubspot_connections enable row level security;
create policy hubspot_connections_workspace_member on hubspot_connections for all using (
  brand_id in (select b.id from brands b join workspace_members wm on wm.workspace_id = b.workspace_id where wm.user_id = auth.uid())
);
