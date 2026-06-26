-- Loyalty engine: programs, tiers, members, transactions, rewards

CREATE TABLE loyalty_programs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  points_currency text DEFAULT 'points',   -- e.g. "Stars", "Coins", "Points"
  points_per_ngn  numeric(8,4) DEFAULT 1,  -- points earned per ₦1 spent
  status          text DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  starts_at       timestamptz,
  ends_at         timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE loyalty_tiers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  program_id      uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  name            text NOT NULL,           -- 'Bronze', 'Silver', 'Gold', 'Platinum'
  min_points      integer NOT NULL DEFAULT 0,
  max_points      integer,
  multiplier      numeric(4,2) DEFAULT 1.0, -- earn multiplier at this tier
  color           text DEFAULT '#6B7280',
  perks           text[] DEFAULT '{}',
  sort_order      integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE loyalty_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  program_id      uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  customer_profile_id uuid REFERENCES customer_profiles(id) ON DELETE SET NULL,
  email           text,
  phone           text,
  name            text,
  points_balance  integer DEFAULT 0,
  lifetime_points integer DEFAULT 0,
  current_tier_id uuid REFERENCES loyalty_tiers(id) ON DELETE SET NULL,
  joined_at       timestamptz DEFAULT now(),
  last_activity   timestamptz,
  status          text DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'opted_out')),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE loyalty_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  member_id       uuid NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('earn', 'redeem', 'bonus', 'expire', 'adjust')),
  points          integer NOT NULL,         -- positive = earn, negative = redeem/expire
  balance_after   integer NOT NULL,
  description     text NOT NULL,
  reference       text,                     -- order ref, campaign code, etc.
  spend_amount    numeric(12,2),            -- NGN spend that triggered earn
  expires_at      timestamptz,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE loyalty_rewards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  program_id      uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  points_cost     integer NOT NULL,
  reward_type     text DEFAULT 'discount' CHECK (reward_type IN ('discount', 'free_product', 'upgrade', 'experience', 'voucher')),
  value           numeric(10,2),            -- NGN value of reward
  stock           integer,                  -- null = unlimited
  redeemed_count  integer DEFAULT 0,
  is_active       boolean DEFAULT true,
  image_url       text,
  expires_at      timestamptz,
  created_at      timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX loyalty_programs_brand_idx    ON loyalty_programs(brand_id);
CREATE INDEX loyalty_tiers_program_idx     ON loyalty_tiers(program_id, sort_order);
CREATE INDEX loyalty_members_brand_idx     ON loyalty_members(brand_id, program_id);
CREATE INDEX loyalty_members_email_idx     ON loyalty_members(brand_id, lower(email)) WHERE email IS NOT NULL;
CREATE INDEX loyalty_transactions_member_idx ON loyalty_transactions(member_id, created_at DESC);
CREATE INDEX loyalty_rewards_program_idx   ON loyalty_rewards(program_id, is_active);

-- RLS
ALTER TABLE loyalty_programs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_tiers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_programs_workspace"
  ON loyalty_programs FOR ALL
  USING (is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id)));

CREATE POLICY "loyalty_tiers_workspace"
  ON loyalty_tiers FOR ALL
  USING (is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id)));

CREATE POLICY "loyalty_members_workspace"
  ON loyalty_members FOR ALL
  USING (is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id)));

CREATE POLICY "loyalty_transactions_workspace"
  ON loyalty_transactions FOR ALL
  USING (is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id)));

CREATE POLICY "loyalty_rewards_workspace"
  ON loyalty_rewards FOR ALL
  USING (is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id)));
