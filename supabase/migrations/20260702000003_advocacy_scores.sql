-- UGC advocacy score: weekly aggregate of social proof signals per brand

CREATE TABLE advocacy_scores (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  week_start          date NOT NULL,
  ugc_mentions        integer DEFAULT 0,  -- total @mentions / tagged posts
  positive_mentions   integer DEFAULT 0,
  neutral_mentions    integer DEFAULT 0,
  negative_mentions   integer DEFAULT 0,
  avg_sentiment       numeric(5,2),
  total_reach         integer DEFAULT 0,
  total_engagement    integer DEFAULT 0,
  top_platforms       jsonb DEFAULT '{}',  -- { "instagram": 40, "twitter": 20, ... }
  top_themes          jsonb DEFAULT '[]',  -- [{ theme, count }]
  advocacy_score      numeric(5,2),        -- 0-100 composite
  score_delta         numeric(5,2),        -- vs prior week
  score_factors       jsonb DEFAULT '{}',  -- { volume: 30, sentiment: 40, reach: 30 }
  created_at          timestamptz DEFAULT now(),
  UNIQUE(brand_id, week_start)
);

CREATE INDEX advocacy_scores_brand_week_idx ON advocacy_scores(brand_id, week_start DESC);

ALTER TABLE advocacy_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advocacy_scores_workspace"
  ON advocacy_scores FOR ALL
  USING (is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id)));
