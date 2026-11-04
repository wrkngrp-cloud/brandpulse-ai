-- Meta data deletion that actually deletes (Meta App Review requirement).
--
-- Meta sends a signed request with an app-scoped user id when someone removes
-- BrandGauge from their Facebook settings or asks for their data to be
-- deleted. We have to delete what we hold from that person and give Meta a
-- status page. Until now we stored no Meta user id at all, so a request
-- could not be matched to anything even when it was recorded, which it was
-- not (the insert was never awaited).

-- Who connected each Meta-sourced row, so a deletion request can find it.
alter table social_connections  add column if not exists meta_user_id text;
alter table digital_ad_accounts add column if not exists meta_user_id text;
create index if not exists idx_social_connections_meta_user on social_connections (meta_user_id) where meta_user_id is not null;
create index if not exists idx_digital_ad_accounts_meta_user on digital_ad_accounts (meta_user_id) where meta_user_id is not null;

-- When a Meta login stops working (about 60 days), so we can warn before it
-- goes silent. X and others leave it null.
alter table social_connections add column if not exists token_expires_at timestamptz;

-- The status page is public, so it is looked up by an unguessable token, not
-- by the old timestamp-based id. It shows the outcome and nothing personal.
alter table meta_deletion_requests
  add column if not exists status_token text unique,
  add column if not exists status text not null default 'received'
    check (status in ('received', 'completed', 'nothing_found')),
  add column if not exists result jsonb;
