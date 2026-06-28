-- OOH Geo Attribution + Retargeting Audiences

-- Extend ooh_visits with precise geolocation and attribution metadata
ALTER TABLE ooh_visits
  ADD COLUMN IF NOT EXISTS geo_lat             numeric(10,7),
  ADD COLUMN IF NOT EXISTS geo_lng             numeric(10,7),
  ADD COLUMN IF NOT EXISTS geo_city            text,
  ADD COLUMN IF NOT EXISTS geo_state           text,
  ADD COLUMN IF NOT EXISTS matched_site_id     uuid REFERENCES ooh_sites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attribution_method  text CHECK (attribution_method IN ('branded_link', 'geo_proximity', 'direct')),
  ADD COLUMN IF NOT EXISTS attribution_confidence numeric(3,2) CHECK (attribution_confidence BETWEEN 0 AND 1);

CREATE INDEX IF NOT EXISTS ooh_visits_geo_idx    ON ooh_visits(brand_id, geo_lat, geo_lng) WHERE geo_lat IS NOT NULL;
CREATE INDEX IF NOT EXISTS ooh_visits_matched_idx ON ooh_visits(matched_site_id)            WHERE matched_site_id IS NOT NULL;

-- Geo-retargeting audience configurations per OOH site
CREATE TABLE IF NOT EXISTS ooh_geo_audiences (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id              uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  ooh_site_id           uuid NOT NULL REFERENCES ooh_sites(id) ON DELETE CASCADE,
  audience_name         text NOT NULL,
  platform              text NOT NULL CHECK (platform IN ('meta', 'google')),
  fence_radius_m        integer NOT NULL DEFAULT 500,
  dwell_minutes         integer DEFAULT 5,        -- min minutes in zone to qualify
  creative_asset_id     uuid REFERENCES creative_assets(id) ON DELETE SET NULL,
  creative_headline     text,
  creative_description  text,
  external_audience_id  text,                     -- Meta/Google audience ID once synced
  estimated_reach       integer,
  status                text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'syncing', 'active', 'paused', 'error')),
  status_message        text,
  synced_at             timestamptz,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ooh_geo_audiences_brand_idx ON ooh_geo_audiences(brand_id);
CREATE INDEX IF NOT EXISTS ooh_geo_audiences_site_idx  ON ooh_geo_audiences(ooh_site_id);

ALTER TABLE ooh_geo_audiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ooh_geo_audiences_workspace"
  ON ooh_geo_audiences FOR ALL
  USING (is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id)));
