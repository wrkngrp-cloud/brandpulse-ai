-- WhatsApp Deep Integration (Phase 4 — Model A)
-- BrandGauge-owned WABA via Meta Cloud API v20.0

create table whatsapp_contacts (
  id             uuid        primary key default gen_random_uuid(),
  brand_id       uuid        not null references brands(id) on delete cascade,
  phone_e164     text        not null,
  name           text,
  whatsapp_opted_in boolean  not null default true,
  opted_in_at    timestamptz default now(),
  opted_out_at   timestamptz,
  created_at     timestamptz default now(),
  unique(brand_id, phone_e164)
);

create table whatsapp_campaigns (
  id              uuid        primary key default gen_random_uuid(),
  brand_id        uuid        not null references brands(id) on delete cascade,
  name            text        not null,
  objective       text        not null default 'broadcast',
  template_name   text        not null,
  template_language text      not null default 'en',
  template_vars   jsonb,
  list_size       int         not null default 0,
  sent            int         not null default 0,
  delivered       int         not null default 0,
  read_count      int         not null default 0,
  replied         int         not null default 0,
  failed          int         not null default 0,
  status          text        not null default 'scheduled',
  scheduled_at    timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz default now()
);

create table whatsapp_send_log (
  id              uuid        primary key default gen_random_uuid(),
  campaign_id     uuid        not null references whatsapp_campaigns(id) on delete cascade,
  brand_id        uuid        not null,
  recipient_hash  text        not null,
  wamid           text,
  status          text        not null default 'pending',
  error_code      text,
  sent_at         timestamptz,
  delivered_at    timestamptz,
  read_at         timestamptz,
  created_at      timestamptz default now()
);

create index on whatsapp_contacts(brand_id);
create index on whatsapp_campaigns(brand_id, created_at desc);
create index on whatsapp_send_log(campaign_id);
create index on whatsapp_send_log(wamid) where wamid is not null;

alter table whatsapp_contacts    enable row level security;
alter table whatsapp_campaigns   enable row level security;
alter table whatsapp_send_log    enable row level security;

create policy "workspace members can manage contacts"
  on whatsapp_contacts for all
  using (is_workspace_member(( select workspace_id from brands where id = brand_id )));

create policy "workspace members can manage campaigns"
  on whatsapp_campaigns for all
  using (is_workspace_member(( select workspace_id from brands where id = brand_id )));

create policy "workspace members can view send log"
  on whatsapp_send_log for all
  using (is_workspace_member(( select workspace_id from brands where id = brand_id )));

-- Helper RPC called by the webhook handler to increment delivery counters
create or replace function increment_whatsapp_campaign_counter(
  p_campaign_id uuid,
  p_column      text
) returns void language plpgsql security definer as $$
begin
  if p_column = 'delivered' then
    update whatsapp_campaigns set delivered  = delivered  + 1 where id = p_campaign_id;
  elsif p_column = 'read_count' then
    update whatsapp_campaigns set read_count = read_count + 1 where id = p_campaign_id;
  elsif p_column = 'replied' then
    update whatsapp_campaigns set replied    = replied    + 1 where id = p_campaign_id;
  elsif p_column = 'failed' then
    update whatsapp_campaigns set failed     = failed     + 1 where id = p_campaign_id;
  end if;
end;
$$;
