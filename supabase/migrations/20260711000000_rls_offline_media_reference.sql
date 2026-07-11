-- Reference catalogs for offline-media planning (radio_stations, tv_channels,
-- print_publications) were created without RLS in 20260625000001_offline_media.sql.
-- With RLS off, the public anon key can INSERT/UPDATE/DELETE these rows via PostgREST,
-- so anyone could pollute or wipe the shared reference catalogs. These tables hold no
-- tenant data, so the correct posture is: any signed-in user may read them, and only
-- the service role (which bypasses RLS) may write them during admin seeding.

alter table radio_stations     enable row level security;
alter table tv_channels        enable row level security;
alter table print_publications enable row level security;

create policy radio_stations_read     on radio_stations     for select to authenticated using (true);
create policy tv_channels_read        on tv_channels        for select to authenticated using (true);
create policy print_publications_read on print_publications for select to authenticated using (true);
