-- Short code for billboard-friendly URLs (e.g. bp.ng/k3d9x)
-- Separate from vanity_slug; 2-10 chars, alphanumeric only, globally unique.
ALTER TABLE ooh_sites
  ADD COLUMN IF NOT EXISTS short_code varchar(10),
  ADD COLUMN IF NOT EXISTS pole_count  int NOT NULL DEFAULT 1;

-- Partial unique index: only enforce uniqueness when short_code is set
CREATE UNIQUE INDEX IF NOT EXISTS ooh_sites_short_code_key
  ON ooh_sites (short_code)
  WHERE short_code IS NOT NULL;
