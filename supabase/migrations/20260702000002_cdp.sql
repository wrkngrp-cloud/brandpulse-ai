-- Customer Data Platform: unified customer profiles

CREATE TABLE customer_profiles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id              uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  -- Identity (at least one must be non-null)
  email                 text,
  phone                 text,
  name                  text,
  -- Lifecycle
  first_seen_at         timestamptz,
  last_seen_at          timestamptz,
  acquisition_source    text,   -- 'survey' | 'whatsapp' | 'app_review' | 'manual'
  -- Commercial
  total_orders          integer DEFAULT 0,
  total_spend           numeric(14,2) DEFAULT 0,
  currency              text DEFAULT 'NGN',
  -- Engagement
  nps_score             smallint CHECK (nps_score BETWEEN 0 AND 10),
  nps_label             text CHECK (nps_label IN ('promoter', 'passive', 'detractor')),
  last_nps_at           timestamptz,
  -- Retention risk (0 = no risk, 100 = critical)
  retention_risk_score  integer DEFAULT 0 CHECK (retention_risk_score BETWEEN 0 AND 100),
  risk_signals          jsonb DEFAULT '[]',
  -- Segments & advocacy
  segments              text[] DEFAULT '{}',
  is_promoter           boolean DEFAULT false,
  promoter_id           uuid REFERENCES promoters(id) ON DELETE SET NULL,
  -- Source tracking (which systems contributed data)
  sources               jsonb DEFAULT '{}',
  last_synced_at        timestamptz,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Unique per brand+email or brand+phone (not both enforced simultaneously)
CREATE UNIQUE INDEX cdp_brand_email_idx
  ON customer_profiles(brand_id, lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX cdp_brand_phone_idx
  ON customer_profiles(brand_id, phone)
  WHERE phone IS NOT NULL AND email IS NULL;

CREATE INDEX cdp_brand_id_idx        ON customer_profiles(brand_id);
CREATE INDEX cdp_nps_label_idx       ON customer_profiles(brand_id, nps_label);
CREATE INDEX cdp_risk_score_idx      ON customer_profiles(brand_id, retention_risk_score DESC);
CREATE INDEX cdp_last_seen_idx       ON customer_profiles(brand_id, last_seen_at DESC);

-- RLS
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_profiles_workspace"
  ON customer_profiles FOR ALL
  USING (is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id)));

-- Service role for sync jobs
CREATE POLICY "customer_profiles_service"
  ON customer_profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
