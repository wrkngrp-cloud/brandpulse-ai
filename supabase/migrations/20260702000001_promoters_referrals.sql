-- Promoters, referral codes, and referral event tracking

CREATE TABLE promoters (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name                text NOT NULL,
  email               text,
  phone               text,
  source              text NOT NULL DEFAULT 'manual'
                        CHECK (source IN ('nps', 'survey', 'whatsapp', 'manual', 'import')),
  source_response_id  uuid,   -- nps_records.id or survey_responses.id
  nps_score           smallint CHECK (nps_score BETWEEN 0 AND 10),
  status              text NOT NULL DEFAULT 'invited'
                        CHECK (status IN ('invited', 'active', 'paused', 'removed')),
  notes               text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE referral_codes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  promoter_id         uuid NOT NULL REFERENCES promoters(id) ON DELETE CASCADE,
  code                text NOT NULL,
  label               text,
  destination_url     text NOT NULL,
  clicks              integer DEFAULT 0,
  unique_clicks       integer DEFAULT 0,
  conversions         integer DEFAULT 0,
  attributed_revenue  numeric(14,2) DEFAULT 0,
  currency            text DEFAULT 'NGN',
  is_active           boolean DEFAULT true,
  expires_at          timestamptz,
  created_at          timestamptz DEFAULT now(),
  CONSTRAINT referral_codes_code_unique UNIQUE (code)
);

CREATE TABLE referral_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  referral_code_id    uuid NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  promoter_id         uuid NOT NULL REFERENCES promoters(id) ON DELETE CASCADE,
  event_type          text NOT NULL
                        CHECK (event_type IN ('click', 'signup', 'purchase', 'app_install', 'custom')),
  -- Privacy-safe identifiers
  referee_hash        text,   -- SHA-256 of email or phone (if known)
  session_id          text,   -- browser session fingerprint
  ip_hash             text,   -- SHA-256 of IP for deduplication
  is_unique           boolean DEFAULT false,
  revenue             numeric(10,2),
  currency            text DEFAULT 'NGN',
  metadata            jsonb   DEFAULT '{}',
  occurred_at         timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX promoters_brand_id_idx         ON promoters(brand_id);
CREATE INDEX promoters_status_idx           ON promoters(brand_id, status);
CREATE INDEX promoters_source_response_idx  ON promoters(source_response_id) WHERE source_response_id IS NOT NULL;
CREATE INDEX referral_codes_brand_id_idx    ON referral_codes(brand_id);
CREATE INDEX referral_codes_promoter_idx    ON referral_codes(promoter_id);
CREATE INDEX referral_codes_code_idx        ON referral_codes(code);
CREATE INDEX referral_events_code_idx       ON referral_events(referral_code_id);
CREATE INDEX referral_events_promoter_idx   ON referral_events(promoter_id, occurred_at DESC);
CREATE INDEX referral_events_occurred_idx   ON referral_events(brand_id, occurred_at DESC);

-- RLS
ALTER TABLE promoters        ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_events  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promoters_workspace"
  ON promoters FOR ALL
  USING (is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id)));

CREATE POLICY "referral_codes_workspace"
  ON referral_codes FOR ALL
  USING (is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id)));

CREATE POLICY "referral_events_workspace"
  ON referral_events FOR ALL
  USING (is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id)));

-- Service role bypass for public referral tracking (no auth on click)
CREATE POLICY "referral_events_service_insert"
  ON referral_events FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "referral_codes_service_update"
  ON referral_codes FOR UPDATE
  TO service_role
  USING (true);
