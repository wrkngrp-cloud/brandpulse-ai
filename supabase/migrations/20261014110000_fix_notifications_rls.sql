-- Fix the notifications RLS policy.
--
-- The policy added in 20260628000001 reads:
--
--   using (is_workspace_member(brand_id))
--
-- and `is_workspace_member(ws uuid)` expects a WORKSPACE id. A brand id is
-- never a workspace id, so the predicate is false for every row and every
-- caller: no signed-in user has ever been able to read a notification. The
-- volume-surge job and the campaign-target monitor have been writing rows that
-- nothing could read, and the one query that reads the table
-- (dashboard/brand-equity, counting volume-surge alerts) has always come back
-- empty.
--
-- This came up while adding competitor watchlist alerts, which write to the
-- same table and would have been invisible for the same reason.
--
-- The fix is the standard shape used by every other brand-scoped table in this
-- schema: resolve the workspace through the brand.

drop policy if exists "notifications_workspace_member" on notifications;

create policy notifications_workspace_member on notifications
  for all
  using (exists (
    select 1 from brands b
    where b.id = notifications.brand_id and is_workspace_member(b.workspace_id)
  ))
  with check (exists (
    select 1 from brands b
    where b.id = notifications.brand_id and is_workspace_member(b.workspace_id)
  ));
