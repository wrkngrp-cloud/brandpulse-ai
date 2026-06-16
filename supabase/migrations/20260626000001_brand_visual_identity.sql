-- Brand visual identity: logo + colours
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS logo_url     TEXT,
  ADD COLUMN IF NOT EXISTS brand_colors TEXT[] DEFAULT '{}';

-- Per-channel creative asset URLs (optional, used by E6 visual detection)
ALTER TABLE campaign_channels
  ADD COLUMN IF NOT EXISTS creative_urls TEXT[] DEFAULT '{}';

-- ── Storage buckets ───────────────────────────────────────────────────────────
-- Public buckets so Claude Vision can fetch images by URL directly.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  true,
  5242880,   -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-creatives',
  'campaign-creatives',
  true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can manage their own brand/campaign assets
CREATE POLICY "brand_assets_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brand-assets');

CREATE POLICY "brand_assets_select" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'brand-assets');

CREATE POLICY "brand_assets_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'brand-assets');

CREATE POLICY "campaign_creatives_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campaign-creatives');

CREATE POLICY "campaign_creatives_select" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'campaign-creatives');

CREATE POLICY "campaign_creatives_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'campaign-creatives');
