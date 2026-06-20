-- Email marketing connectors (Mailchimp + Brevo) for Loyalty-stage signals
create table if not exists email_connectors (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references brands(id) on delete cascade,
  provider    text not null check (provider in ('mailchimp', 'brevo')),
  api_key     text not null,  -- AES-256-GCM encrypted
  list_id     text,           -- Mailchimp audience ID or Brevo list ID (optional)
  last_synced_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (brand_id, provider)
);

alter table email_connectors enable row level security;
create policy email_connectors_workspace_member on email_connectors for all using (
  brand_id in (
    select b.id from brands b
    join workspace_members wm on wm.workspace_id = b.workspace_id
    where wm.user_id = auth.uid()
  )
);

-- Stores aggregated email campaign metrics per sync
create table if not exists email_campaign_snapshots (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  provider        text not null,
  campaign_id     text not null,  -- provider's campaign ID
  campaign_name   text not null,
  send_date       date,
  recipients      integer,
  open_rate       numeric(5,2),   -- percentage
  click_rate      numeric(5,2),   -- percentage
  unsubscribe_rate numeric(5,2),
  synced_at       timestamptz not null default now(),
  unique (brand_id, provider, campaign_id)
);

alter table email_campaign_snapshots enable row level security;
create policy email_campaign_snapshots_workspace_member on email_campaign_snapshots for all using (
  brand_id in (
    select b.id from brands b
    join workspace_members wm on wm.workspace_id = b.workspace_id
    where wm.user_id = auth.uid()
  )
);
