-- Budget management & pacing: planned vs actual spend tracking

CREATE TABLE budget_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name            text NOT NULL,
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  total_budget    numeric(16,2) NOT NULL,
  currency        text DEFAULT 'NGN',
  status          text DEFAULT 'active' CHECK (status IN ('draft', 'active', 'closed')),
  notes           text,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE budget_line_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  plan_id         uuid NOT NULL REFERENCES budget_plans(id) ON DELETE CASCADE,
  channel         text NOT NULL,   -- 'digital' | 'tv' | 'radio' | 'ooh' | 'influencer' | 'events' | 'print' | 'other'
  label           text NOT NULL,
  planned_amount  numeric(14,2) NOT NULL,
  actual_amount   numeric(14,2) DEFAULT 0,
  currency        text DEFAULT 'NGN',
  campaign_id     uuid,            -- optional FK to campaigns (no hard FK — campaigns table may vary)
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE budget_actuals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  line_item_id    uuid NOT NULL REFERENCES budget_line_items(id) ON DELETE CASCADE,
  amount          numeric(12,2) NOT NULL,
  currency        text DEFAULT 'NGN',
  description     text,
  reference       text,            -- invoice / PO number
  spent_on        date NOT NULL,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX budget_plans_brand_idx     ON budget_plans(brand_id, period_start DESC);
CREATE INDEX budget_line_items_plan_idx ON budget_line_items(plan_id);
CREATE INDEX budget_actuals_line_idx    ON budget_actuals(line_item_id, spent_on DESC);

-- RLS
ALTER TABLE budget_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_actuals    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_plans_workspace"
  ON budget_plans FOR ALL
  USING (is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id)));

CREATE POLICY "budget_line_items_workspace"
  ON budget_line_items FOR ALL
  USING (is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id)));

CREATE POLICY "budget_actuals_workspace"
  ON budget_actuals FOR ALL
  USING (is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id)));
