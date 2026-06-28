-- Creative Library: bank of vetted brand creatives with performance data and replication learnings

CREATE TABLE IF NOT EXISTS creative_assets (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id              uuid        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title                 text        NOT NULL,
  description           text,
  asset_type            text        NOT NULL DEFAULT 'image'
                                    CHECK (asset_type IN ('image','video','copy','carousel','audio')),
  format                text,       -- story, feed, reel, banner, print, ooh, script, brief
  platform              text,       -- instagram, facebook, tiktok, ooh, radio, print, email
  asset_url             text,
  thumbnail_url         text,
  status                text        NOT NULL DEFAULT 'draft'
                                    CHECK (status IN ('draft','active','vetted','archived')),
  fit_for_ads           boolean     NOT NULL DEFAULT false,
  performance           jsonb       DEFAULT '{}',
  notes                 text,
  replication_elements  jsonb       DEFAULT '[]',
  tags                  text[]      DEFAULT '{}',
  campaign_id           uuid        REFERENCES campaigns(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE creative_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can manage creative assets"
  ON creative_assets
  FOR ALL
  USING  (is_workspace_member(brand_id))
  WITH CHECK (is_workspace_member(brand_id));

CREATE INDEX creative_assets_brand_id_idx ON creative_assets (brand_id);
CREATE INDEX creative_assets_fit_for_ads_idx ON creative_assets (brand_id, fit_for_ads);
