-- /api/auth/meta/deauthorize has written here, fire-and-forget, since the
-- route was built — the table just never existed, so every data-deletion
-- request Meta sent us was acknowledged (satisfying Meta's webhook contract)
-- and then silently discarded. No per-brand tenant to scope this to: a Meta
-- user id is not one of ours until we look it up, so this is staff-only,
-- same pattern as leads/tool_runs.
create table meta_deletion_requests (
  id            uuid primary key default gen_random_uuid(),
  meta_user_id  text not null,
  deletion_id   text not null unique,
  raw_payload   jsonb,
  requested_at  timestamptz not null default now(),
  processed_at  timestamptz
);
create index idx_meta_deletion_requests_user on meta_deletion_requests(meta_user_id);

alter table meta_deletion_requests enable row level security;
create policy meta_deletion_requests_service_only on meta_deletion_requests for all
  to service_role
  using (true);
