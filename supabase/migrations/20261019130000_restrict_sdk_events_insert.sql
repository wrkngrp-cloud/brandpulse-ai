-- sdk_events_insert_service read "with check (true)" as a stand-in for
-- "the service role handles writes," but a with-check has no bearing on WHO
-- is running the statement, only on the row's shape. Supabase grants
-- table-level INSERT to anon/authenticated by default, so any caller with the
-- public anon key could POST straight to PostgREST and write an arbitrary
-- brand_id into sdk_events, bypassing the pixel_id -> brand_id resolution and
-- validation in src/app/api/sdk/event/route.ts entirely.
drop policy if exists sdk_events_insert_service on sdk_events;
create policy sdk_events_insert_service on sdk_events for insert
  to service_role
  with check (true);
