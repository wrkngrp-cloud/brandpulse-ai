-- Add analysis_type, input_data, result columns to creative_analyses
-- The table originally had per-score columns (cultural_resonance, etc.) for
-- the seeded data path, but the API routes store unstructured AI results.

ALTER TABLE creative_analyses
  ADD COLUMN IF NOT EXISTS analysis_type text,
  ADD COLUMN IF NOT EXISTS input_data    jsonb,
  ADD COLUMN IF NOT EXISTS result        jsonb;

CREATE INDEX IF NOT EXISTS creative_analyses_brand_type_idx
  ON creative_analyses(brand_id, analysis_type, created_at DESC);
