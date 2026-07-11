-- Purchase Events: captures Paystack / Flutterwave / manual payment signals
-- These feed the Action → Loyalty stages of the BrandGauge funnel

create table if not exists purchase_events (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  source          text not null check (source in ('paystack','flutterwave','manual')),
  reference       text not null,
  amount          numeric(12,2),
  currency        text default 'NGN',
  customer_email  text,
  customer_phone  text,
  status          text not null check (status in ('success','failed','abandoned')),
  metadata        jsonb default '{}'::jsonb,
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (source, reference)
);

create index idx_purchase_events_brand on purchase_events(brand_id, occurred_at desc);

alter table purchase_events enable row level security;

create policy purchase_events_workspace_member on purchase_events
  for all using (
    brand_id in (
      select b.id from brands b
      join workspace_members wm on wm.workspace_id = b.workspace_id
      where wm.user_id = auth.uid()
    )
  );

-- Webhook Configs: stores encrypted webhook secrets per brand + provider

create table if not exists webhook_configs (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references brands(id) on delete cascade,
  provider    text not null check (provider in ('paystack','flutterwave')),
  secret_key  text not null,
  created_at  timestamptz not null default now(),
  unique (brand_id, provider)
);

alter table webhook_configs enable row level security;

create policy webhook_configs_workspace_member on webhook_configs
  for all using (
    brand_id in (
      select b.id from brands b
      join workspace_members wm on wm.workspace_id = b.workspace_id
      where wm.user_id = auth.uid()
    )
  );
