-- Add optional ooh_site_id FK to geo_lift_studies so per-OOH-site studies
-- can be linked back to their originating billboard / screen.
alter table geo_lift_studies
  add column if not exists ooh_site_id uuid references ooh_sites(id) on delete set null;

create index if not exists idx_geolift_ooh_site on geo_lift_studies(ooh_site_id);
