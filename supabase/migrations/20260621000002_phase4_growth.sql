-- Phase 4 Growth Layer: multi-brand active tracking, portal tokens, billing, WhatsApp inbound

-- ── Multi-brand: active brand per workspace ───────────────────────────────────
alter table workspaces add column if not exists active_brand_id uuid references brands(id) on delete set null;

-- ── Portal tokens (read-only client portal) ───────────────────────────────────
create table if not exists portal_tokens (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  brand_id      uuid not null references brands(id)    on delete cascade,
  token         text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  label         text not null default 'Client portal',
  sections      text[] default array['bhi','sentiment','sov','monthly_report'],
  expires_at    timestamptz,
  last_accessed timestamptz,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz default now()
);
create index idx_portal_tokens_token on portal_tokens(token);

alter table portal_tokens enable row level security;
create policy "workspace_member_all" on portal_tokens
  for all using (is_workspace_member(workspace_id));

-- ── Stripe billing ────────────────────────────────────────────────────────────
alter table workspaces
  add column if not exists stripe_customer_id    text unique,
  add column if not exists stripe_subscription_id text unique,
  add column if not exists subscription_status   text default 'trialing'
    check (subscription_status in ('trialing','active','past_due','canceled','paused')),
  add column if not exists trial_ends_at         timestamptz,
  add column if not exists current_period_end    timestamptz;

-- Plan limits reference table (human-readable, not enforced by DB)
create table if not exists plan_limits (
  plan          text primary key,
  brand_count   int  not null default 1,
  user_count    int  not null default 3,
  survey_mo     int  not null default 500,    -- survey responses / month
  ai_calls_mo   int  not null default 100,    -- AI calls / month
  portal_links  int  not null default 0,
  white_label   boolean not null default false,
  price_ngn_mo  int  not null default 0
);

insert into plan_limits values
  ('starter',    1,   3,    500,   100,  0, false,       0),
  ('growth',     3,   10,  2500,   500,  3, false,  299000),
  ('pro',        5,   25, 10000,  2000, 10, false,  699000),
  ('agency',    20,  100, 50000, 10000, 50, true,  1999000),
  ('enterprise', -1,  -1,    -1,    -1, -1, true,        0)
on conflict (plan) do update
  set brand_count = excluded.brand_count, user_count = excluded.user_count,
      survey_mo = excluded.survey_mo, ai_calls_mo = excluded.ai_calls_mo,
      portal_links = excluded.portal_links, white_label = excluded.white_label,
      price_ngn_mo = excluded.price_ngn_mo;

-- No RLS on plan_limits (public reference)
alter table plan_limits enable row level security;
create policy "public_read" on plan_limits for select using (true);

-- Usage tracking
create table if not exists usage_events (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  event_type   text not null, -- 'ai_call' | 'survey_response' | 'portal_view'
  occurred_at  timestamptz default now()
);
create index idx_usage_workspace_month on usage_events(workspace_id, occurred_at);

alter table usage_events enable row level security;
create policy "workspace_member_read" on usage_events
  for select using (is_workspace_member(workspace_id));

-- ── WhatsApp inbound messages ─────────────────────────────────────────────────
create table if not exists whatsapp_inbound (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references workspaces(id) on delete cascade,
  brand_id      uuid references brands(id)     on delete cascade,
  from_number   text not null,
  message_text  text,
  message_id    text unique,
  -- link to survey if this is a survey response
  survey_id     uuid references surveys(id)    on delete set null,
  survey_response_id uuid references survey_responses(id) on delete set null,
  -- NPS: if message is a 0-10 digit reply to an NPS send
  nps_score     smallint check (nps_score >= 0 and nps_score <= 10),
  raw_payload   jsonb,
  received_at   timestamptz default now()
);
create index idx_whatsapp_from on whatsapp_inbound(from_number, received_at);
create index idx_whatsapp_survey on whatsapp_inbound(survey_id);

alter table whatsapp_inbound enable row level security;
create policy "workspace_member_read" on whatsapp_inbound
  for select using (is_workspace_member(workspace_id));

-- ── WhatsApp NPS sends: track who was sent what so we can match replies ───────
create table if not exists whatsapp_nps_sends (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  brand_id      uuid not null references brands(id)     on delete cascade,
  to_number     text not null,
  survey_id     uuid references surveys(id)             on delete set null,
  message_id    text,
  sent_at       timestamptz default now(),
  replied_at    timestamptz,
  nps_score     smallint
);
create index idx_nps_sends_number on whatsapp_nps_sends(to_number, sent_at);

alter table whatsapp_nps_sends enable row level security;
create policy "workspace_member_all" on whatsapp_nps_sends
  for all using (is_workspace_member(workspace_id));
