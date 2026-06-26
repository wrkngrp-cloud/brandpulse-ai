-- A/B testing framework: experiments, variants, events, results

CREATE TABLE ab_experiments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name            text NOT NULL,
  hypothesis      text NOT NULL,
  description     text,
  experiment_type text DEFAULT 'message' CHECK (experiment_type IN ('message', 'creative', 'channel', 'offer', 'landing_page', 'email', 'other')),
  metric_primary  text NOT NULL,   -- e.g. 'click_rate', 'conversion_rate', 'revenue_per_user'
  metrics_secondary text[] DEFAULT '{}',
  status          text DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'concluded')),
  confidence_target numeric(4,1) DEFAULT 95.0,   -- % confidence required to call a winner
  min_sample_size integer DEFAULT 100,
  traffic_split   jsonb DEFAULT '{}',  -- { variant_id: pct, ... } sums to 100
  winner_variant_id uuid,
  started_at      timestamptz,
  concluded_at    timestamptz,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE ab_variants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  experiment_id   uuid NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE,
  name            text NOT NULL,          -- 'Control', 'Variant A', 'Variant B', etc.
  is_control      boolean DEFAULT false,
  description     text,
  content         jsonb DEFAULT '{}',     -- arbitrary variant config (headline, cta, image_url, etc.)
  impressions     integer DEFAULT 0,
  conversions     integer DEFAULT 0,
  revenue         numeric(14,2) DEFAULT 0,
  sort_order      integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE ab_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  experiment_id   uuid NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE,
  variant_id      uuid NOT NULL REFERENCES ab_variants(id) ON DELETE CASCADE,
  event_type      text NOT NULL CHECK (event_type IN ('impression', 'click', 'conversion', 'revenue')),
  session_id      text,
  user_hash       text,                   -- SHA-256 of user identity (privacy-safe)
  value           numeric(10,2),          -- revenue amount for revenue events
  metadata        jsonb DEFAULT '{}',
  occurred_at     timestamptz DEFAULT now()
);

-- Self-reference for winner (after variants exist)
ALTER TABLE ab_experiments
  ADD CONSTRAINT ab_experiments_winner_fk
  FOREIGN KEY (winner_variant_id) REFERENCES ab_variants(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX ab_experiments_brand_idx ON ab_experiments(brand_id, status);
CREATE INDEX ab_variants_exp_idx      ON ab_variants(experiment_id, sort_order);
CREATE INDEX ab_events_variant_idx    ON ab_events(variant_id, occurred_at DESC);
CREATE INDEX ab_events_exp_idx        ON ab_events(experiment_id, event_type, occurred_at DESC);

-- RLS
ALTER TABLE ab_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_variants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_events      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ab_experiments_workspace"
  ON ab_experiments FOR ALL
  USING (is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id)));

CREATE POLICY "ab_variants_workspace"
  ON ab_variants FOR ALL
  USING (is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id)));

CREATE POLICY "ab_events_workspace"
  ON ab_events FOR ALL
  USING (is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id)));

-- Service role for pixel/event ingestion from client apps
CREATE POLICY "ab_events_service_insert"
  ON ab_events FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "ab_variants_service_update"
  ON ab_variants FOR UPDATE
  TO service_role
  USING (true);
