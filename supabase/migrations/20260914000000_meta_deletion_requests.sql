-- Meta Data Deletion Request callback storage.
--
-- Meta requires every app using Facebook Login to expose a Data Deletion Request
-- callback, and requires that callback to return a status URL a reviewer can open.
-- /api/auth/meta/deauthorize already writes here fire-and-forget, but the table was
-- never created, so every deletion request has been silently dropped. Meta's
-- reviewer checks this path during App Review.
--
-- RLS note: this table is deliberately NOT workspace-scoped. A deletion request
-- arrives from Meta before we know which workspace (if any) the Meta user maps to,
-- so there is no brand_id to scope by. RLS is enabled with NO permissive policy,
-- which denies anon and authenticated entirely. Only the service-role client
-- (the callback route and the public status page) can read or write it, which is
-- the correct posture for a table holding third-party user identifiers.

create table if not exists meta_deletion_requests (
  id            uuid primary key default gen_random_uuid(),
  meta_user_id  text not null,
  deletion_id   text not null unique,
  status        text not null default 'pending'
                check (status in ('pending', 'completed', 'not_found')),
  requested_at  timestamptz not null default now(),
  completed_at  timestamptz,
  raw_payload   jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists meta_deletion_requests_deletion_id_idx
  on meta_deletion_requests (deletion_id);

create index if not exists meta_deletion_requests_meta_user_id_idx
  on meta_deletion_requests (meta_user_id);

alter table meta_deletion_requests enable row level security;

-- No policy is created on purpose. See the RLS note above.
