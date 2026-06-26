-- Marketplace intelligence: Jumia, Konga shelf performance, reviews, competitor pricing

CREATE TABLE marketplace_products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform        text NOT NULL CHECK (platform IN ('jumia', 'konga', 'amazon', 'other')),
  product_name    text NOT NULL,
  sku             text,
  product_url     text,
  category        text,
  is_own_product  boolean DEFAULT true,  -- false = competitor product
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE marketplace_snapshots (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
  snapshot_date       date NOT NULL,
  price               numeric(12,2),
  currency            text DEFAULT 'NGN',
  original_price      numeric(12,2),        -- before discount
  discount_pct        numeric(5,2),
  shelf_position      integer,              -- rank in category search
  in_stock            boolean DEFAULT true,
  rating              numeric(3,2),         -- 0.0 – 5.0
  review_count        integer DEFAULT 0,
  sales_rank          integer,
  badges              text[] DEFAULT '{}',  -- ['Best Seller', 'Choice', etc]
  image_url           text,
  scraped_at          timestamptz DEFAULT now()
);

CREATE TABLE marketplace_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
  platform        text NOT NULL,
  external_id     text,
  author          text,
  rating          smallint CHECK (rating BETWEEN 1 AND 5),
  title           text,
  body            text,
  verified        boolean DEFAULT false,
  helpful_count   integer DEFAULT 0,
  sentiment_label text CHECK (sentiment_label IN ('positive', 'neutral', 'negative')),
  sentiment_score numeric(5,2),
  reviewed_at     timestamptz,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(platform, external_id)
);

-- Indexes
CREATE INDEX marketplace_products_brand_idx   ON marketplace_products(brand_id, platform);
CREATE INDEX marketplace_snapshots_brand_idx  ON marketplace_snapshots(brand_id, snapshot_date DESC);
CREATE INDEX marketplace_snapshots_product_idx ON marketplace_snapshots(product_id, snapshot_date DESC);
CREATE INDEX marketplace_reviews_product_idx  ON marketplace_reviews(product_id, reviewed_at DESC);

-- RLS
ALTER TABLE marketplace_products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_reviews   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplace_products_workspace"
  ON marketplace_products FOR ALL
  USING (is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id)));

CREATE POLICY "marketplace_snapshots_workspace"
  ON marketplace_snapshots FOR ALL
  USING (is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id)));

CREATE POLICY "marketplace_reviews_workspace"
  ON marketplace_reviews FOR ALL
  USING (is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id)));
