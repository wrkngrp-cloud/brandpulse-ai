create table if not exists ecommerce_sales (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references brands(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  campaign_id  uuid references campaigns(id) on delete set null,
  source       text not null check (source in ('jumia', 'konga', 'paystack', 'flutterwave', 'manual')),
  order_ref    text,
  product_name text,
  sku          text,
  units        integer default 1,
  amount       numeric(14,2) not null,
  currency     text not null default 'NGN',
  promo_code   text,
  sold_at      timestamptz,
  imported_at  timestamptz default now(),
  created_at   timestamptz default now()
);

create index if not exists ecommerce_sales_brand_id_idx on ecommerce_sales(brand_id);
create index if not exists ecommerce_sales_sold_at_idx  on ecommerce_sales(sold_at);
create index if not exists ecommerce_sales_source_idx   on ecommerce_sales(source);

alter table ecommerce_sales enable row level security;

create policy "workspace members can manage ecommerce_sales"
  on ecommerce_sales for all
  using (is_workspace_member(workspace_id));
