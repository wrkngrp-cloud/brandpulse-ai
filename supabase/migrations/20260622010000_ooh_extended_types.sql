-- Extend ooh_sites to support keke fleet, wall painting, and branded vehicle formats
-- The schema uses format_type (free text) — no check constraint to drop/recreate.
-- These new columns carry format-specific metadata for the three new Nigerian OOH types.

alter table ooh_sites
  add column if not exists fleet_size           integer,
  add column if not exists route_lgas           text[],
  add column if not exists surface_width_m      numeric(8,2),
  add column if not exists surface_height_m     numeric(8,2),
  add column if not exists urban_classification text check (urban_classification in ('urban', 'semi_urban', 'rural')),
  add column if not exists vehicle_type         text check (vehicle_type in ('truck', 'tanker', 'bus', 'van', 'keke'));
