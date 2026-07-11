-- ============================================================
-- BrandGauge — Initial Schema v7.0
-- ============================================================

-- ── Helpers ──────────────────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ── TENANCY ───────────────────────────────────────────────────────────────────

create table workspaces (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  logo_url      text,
  plan          text not null default 'starter'
                check (plan in ('starter','growth','pro','agency','enterprise')),
  type          text not null default 'brand'
                check (type in ('brand','multi_brand','agency')),
  industry      text,
  base_currency char(3) not null default 'NGN',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_workspaces_updated before update on workspaces
  for each row execute function set_updated_at();

create table workspace_members (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'member'
                check (role in ('owner','admin','member','analyst','field','viewer')),
  created_at    timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index idx_members_user on workspace_members(user_id);
create index idx_members_ws   on workspace_members(workspace_id);

-- Membership check used by every RLS policy.
-- security definer so it reads workspace_members as the function owner,
-- not as the calling user (avoids infinite RLS recursion on that table).
create or replace function is_workspace_member(ws uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

-- ── BRANDS ───────────────────────────────────────────────────────────────────

create table brands (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  name             text not null,
  logo_url         text,
  category         text,
  -- five cultural sliders 0-100:
  -- community↔corporate, traditional↔modern, religious↔secular, mass↔premium, local↔global
  cultural_profile jsonb not null default '{}'::jsonb,
  brand_values     text[] default '{}',
  target_segments  jsonb not null default '[]'::jsonb,
  brand_voice      jsonb not null default '{}'::jsonb,
  primary_color    text,
  secondary_color  text,
  market_share_pct numeric(5,2),
  bhi_weights      jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_brands_ws on brands(workspace_id);
create trigger trg_brands_updated before update on brands
  for each row execute function set_updated_at();

create table competitors (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null references brands(id) on delete cascade,
  name           text not null,
  social_handles jsonb not null default '{}'::jsonb,
  website_url    text,
  app_name       text,
  created_at     timestamptz not null default now()
);
create index idx_competitors_brand on competitors(brand_id);

-- ── DIGITAL ──────────────────────────────────────────────────────────────────

create table social_connections (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  platform        text not null
                  check (platform in ('instagram','facebook','twitter','tiktok',
                         'linkedin','youtube','whatsapp')),
  account_id      text,
  account_name    text,
  -- access_token and refresh_token are read server-side only; never exposed via PostgREST
  access_token    text,
  refresh_token   text,
  followers_count integer,
  sync_status     text not null default 'pending'
                  check (sync_status in ('pending','active','error','revoked')),
  last_synced_at  timestamptz,
  connected_at    timestamptz not null default now(),
  unique (brand_id, platform, account_id)
);
create index idx_social_conn_brand on social_connections(brand_id);

create table social_posts (
  id                  uuid primary key default gen_random_uuid(),
  brand_id            uuid not null references brands(id) on delete cascade,
  platform            text not null,
  external_id         text not null,
  content             text,
  media_url           text,
  content_type        text,
  reach               integer default 0,
  impressions         integer default 0,
  likes               integer default 0,
  comments            integer default 0,
  shares              integer default 0,
  saves               integer default 0,
  video_views         integer default 0,
  engagement_rate     numeric(6,3),
  funnel_stage        text check (funnel_stage in
                      ('awareness','consideration','preference','action','loyalty','advocacy')),
  campaign_id         uuid,
  sentiment_score     numeric(5,2),
  sentiment_label     text check (sentiment_label in ('positive','neutral','negative','mixed')),
  emotion_tags        text[] default '{}',
  language_tag        text,
  ai_performance_score numeric(5,2),
  ai_diagnosis        text,
  posted_at           timestamptz,
  created_at          timestamptz not null default now(),
  unique (platform, external_id)
);
create index idx_posts_brand_date on social_posts(brand_id, posted_at desc);
create index idx_posts_stage      on social_posts(brand_id, funnel_stage);

create table mentions (
  id               uuid primary key default gen_random_uuid(),
  brand_id         uuid not null references brands(id) on delete cascade,
  platform         text not null,
  external_id      text,
  content          text,
  author_handle    text,
  author_followers integer,
  reach            integer default 0,
  sentiment_label  text check (sentiment_label in ('positive','neutral','negative','mixed')),
  sentiment_score  numeric(5,2),
  emotion_tags     text[] default '{}',
  topics           text[] default '{}',
  language_tag     text,
  is_competitor    boolean default false,
  competitor_id    uuid references competitors(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index idx_mentions_brand_date on mentions(brand_id, created_at desc);

create table paid_campaigns (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references brands(id) on delete cascade,
  platform     text not null,
  name         text not null,
  objective    text,
  funnel_stage text,
  spend        numeric(14,2) default 0,
  currency     char(3) not null default 'NGN',
  impressions  integer default 0,
  reach        integer default 0,
  clicks       integer default 0,
  conversions  integer default 0,
  revenue      numeric(14,2) default 0,
  start_date   date,
  end_date     date,
  utm_source   text, utm_medium text, utm_campaign text, utm_content text,
  created_at   timestamptz not null default now()
);
create index idx_paid_brand on paid_campaigns(brand_id);

create table pre_post_analyses (
  id               uuid primary key default gen_random_uuid(),
  brand_id         uuid not null references brands(id) on delete cascade,
  created_by       uuid references auth.users(id) on delete set null,
  content_text     text not null,
  platform         text,
  target_segment   text,
  funnel_goal      text,
  engagement_score numeric(5,2),
  cultural_score   numeric(5,2),
  tone_score       numeric(5,2),
  clarity_score    numeric(5,2),
  risk_score       numeric(5,2),
  risk_flags       jsonb default '[]'::jsonb,
  verdict          text,
  improvements     text[] default '{}',
  suggested_rewrite text,
  raw_response     jsonb,
  created_at       timestamptz not null default now()
);
create index idx_prepost_brand_date on pre_post_analyses(brand_id, created_at desc);

-- ── BRAND EQUITY ─────────────────────────────────────────────────────────────

create table brand_health_snapshots (
  id               uuid primary key default gen_random_uuid(),
  brand_id         uuid not null references brands(id) on delete cascade,
  snapshot_date    date not null,
  bhi              numeric(5,2),
  components       jsonb not null default '{}'::jsonb,
  data_coverage_pct numeric(5,2),
  created_at       timestamptz not null default now(),
  unique (brand_id, snapshot_date)
);
create index idx_bhi_brand_date on brand_health_snapshots(brand_id, snapshot_date desc);

create table sov_snapshots (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  snapshot_date   date not null,
  social_sov      numeric(5,2),
  paid_sov        numeric(5,2),
  ooh_sov         numeric(5,2),
  press_sov       numeric(5,2),
  search_sov      numeric(5,2),
  blended_sov     numeric(5,2),
  esov            numeric(5,2),
  competitor_data jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  unique (brand_id, snapshot_date)
);

create table funnel_snapshots (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references brands(id) on delete cascade,
  snapshot_date date not null,
  segment       text default 'all',
  awareness     numeric(5,2), consideration numeric(5,2), preference numeric(5,2),
  action        numeric(5,2), loyalty       numeric(5,2), advocacy    numeric(5,2),
  dropoffs      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (brand_id, snapshot_date, segment)
);

create table emv_records (
  id               uuid primary key default gen_random_uuid(),
  brand_id         uuid not null references brands(id) on delete cascade,
  source_type      text,
  initiative_name  text,
  impressions      integer default 0,
  reach            integer default 0,
  engagements      integer default 0,
  cpm_benchmark    numeric(10,2),
  cpe_benchmark    numeric(10,2),
  emv              numeric(14,2),
  currency         char(3) default 'NGN',
  period_start     date,
  period_end       date,
  created_at       timestamptz not null default now()
);
create index idx_emv_brand on emv_records(brand_id);

-- ── CULTURAL ─────────────────────────────────────────────────────────────────

create table cultural_resonance_scores (
  id                uuid primary key default gen_random_uuid(),
  brand_id          uuid not null references brands(id) on delete cascade,
  segment           text not null,
  snapshot_date     date not null,
  crs               numeric(5,2),
  authenticity      numeric(5,2),
  language_relevance numeric(5,2),
  visual_rep        numeric(5,2),
  symbol_value      numeric(5,2),
  community_embed   numeric(5,2),
  drift_flag        text check (drift_flag in ('normal','watch','warning','critical')),
  created_at        timestamptz not null default now(),
  unique (brand_id, segment, snapshot_date)
);
create index idx_crs_brand_seg on cultural_resonance_scores(brand_id, segment, snapshot_date desc);

-- Global library (is_global = true, workspace_id = null) is readable by everyone.
-- Workspace-specific events are scoped to that workspace.
create table cultural_events (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null,
  season_start              date,
  season_end                date,
  recurrence                text,
  geographic_relevance      text[],
  religious_ethnic_relevance text[],
  opportunity_type          text,
  risk_level                text,
  is_global                 boolean default true,
  workspace_id              uuid references workspaces(id) on delete cascade,
  created_at                timestamptz not null default now()
);

-- ── EVENTS ───────────────────────────────────────────────────────────────────

create table events (
  id                   uuid primary key default gen_random_uuid(),
  brand_id             uuid not null references brands(id) on delete cascade,
  name                 text not null,
  event_type           text,
  venue                text,
  city                 text,
  state                text,
  date_start           date,
  date_end             date,
  expected_attendance  integer,
  objectives           jsonb default '{}'::jsonb,
  activation_mechanics text[] default '{}',
  kpi_targets          jsonb default '{}'::jsonb,
  budget               numeric(14,2),
  currency             char(3) default 'NGN',
  missed_call_number   text,
  status               text default 'planned'
                       check (status in ('planned','live','closed','reported')),
  created_at           timestamptz not null default now()
);
create index idx_events_brand on events(brand_id);

create table event_ambassadors (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  name          text not null,
  phone         text,
  session_token text not null unique,
  created_at    timestamptz not null default now()
);

-- Public writes go through a service-role API route that validates session_token.
-- RLS covers authenticated workspace members reading/managing their own event data.
create table event_interactions (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references events(id) on delete cascade,
  ambassador_id    uuid references event_ambassadors(id) on delete set null,
  interaction_type text not null,
  customer_type    text,
  lead_name        text,
  lead_phone       text,
  lead_interest    text,
  capture_method   text default 'ambassador'
                   check (capture_method in ('ambassador','missed_call')),
  client_uuid      text,
  metadata         jsonb default '{}'::jsonb,
  occurred_at      timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  unique (event_id, client_uuid)
);
create index idx_interactions_event on event_interactions(event_id, occurred_at desc);

-- ── SENTIMENT / AUDIO / SURVEYS ──────────────────────────────────────────────

create table audio_files (
  id               uuid primary key default gen_random_uuid(),
  brand_id         uuid not null references brands(id) on delete cascade,
  uploaded_by      uuid references auth.users(id) on delete set null,
  storage_path     text not null,
  file_type        text,
  duration_seconds integer,
  context          text,
  language         text,
  status           text default 'uploaded'
                   check (status in ('uploaded','transcribing','analysing','done','error')),
  created_at       timestamptz not null default now()
);

create table transcriptions (
  id               uuid primary key default gen_random_uuid(),
  audio_file_id    uuid not null references audio_files(id) on delete cascade,
  brand_id         uuid not null references brands(id) on delete cascade,
  transcript       text,
  sentences        jsonb,
  keywords         jsonb,
  themes           jsonb,
  executive_summary text,
  competitor_mentions jsonb,
  created_at       timestamptz not null default now()
);
create index idx_transcriptions_brand on transcriptions(brand_id);

create table surveys (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  name            text not null,
  type            text,
  questions       jsonb not null default '[]'::jsonb,
  deploy_channels text[] default '{}',
  languages       text[] default '{english}',
  status          text default 'draft'
                  check (status in ('draft','live','closed')),
  created_at      timestamptz not null default now()
);

-- Public writes go through a service-role API route that validates survey id.
-- Anon RLS is deliberately absent; the service-role route is the gate.
create table survey_responses (
  id                 uuid primary key default gen_random_uuid(),
  survey_id          uuid not null references surveys(id) on delete cascade,
  respondent_profile jsonb default '{}'::jsonb,
  answers            jsonb not null default '{}'::jsonb,
  location_lat       numeric(9,6),
  location_lng       numeric(9,6),
  source             text,
  language           text,
  quality_flag       text default 'ok' check (quality_flag in ('ok','low_effort','excluded')),
  collected_at       timestamptz not null default now()
);
create index idx_responses_survey on survey_responses(survey_id, collected_at desc);

create table nps_records (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references brands(id) on delete cascade,
  score         smallint check (score between 0 and 10),
  verbatim      text,
  segment       jsonb,
  channel       text,
  promoter_type text check (promoter_type in ('promoter','passive','detractor')),
  created_at    timestamptz not null default now()
);
create index idx_nps_brand on nps_records(brand_id, created_at desc);

create table sentiment_daily (
  id                   uuid primary key default gen_random_uuid(),
  brand_id             uuid not null references brands(id) on delete cascade,
  day                  date not null,
  social_score         numeric(5,2),
  offline_score        numeric(5,2),
  blended_score        numeric(5,2),
  positive_pct         numeric(5,2),
  neutral_pct          numeric(5,2),
  negative_pct         numeric(5,2),
  top_themes           jsonb,
  emotion_distribution jsonb,
  created_at           timestamptz not null default now(),
  unique (brand_id, day)
);

-- ── OOH ──────────────────────────────────────────────────────────────────────

-- Vanity-link visits (/go/[slug]) are logged via service-role route.
-- No anon RLS on this table.
create table ooh_sites (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null references brands(id) on delete cascade,
  site_name      text not null,
  lat            numeric(9,6),
  lng            numeric(9,6),
  city           text,
  state          text,
  country        text default 'Nigeria',
  format_type    text,
  illuminated    boolean default false,
  daily_traffic  integer,
  operator       text,
  weekly_cost    numeric(14,2),
  currency       char(3) default 'NGN',
  campaign_start date,
  campaign_end   date,
  cultural_zone  text,
  photo_url      text,
  vanity_slug    text unique,
  landing_url    text,
  visits         integer default 0,
  qr_token       text unique,
  qr_scan_count  integer default 0,
  notes          text,
  created_at     timestamptz not null default now()
);
create index idx_ooh_brand   on ooh_sites(brand_id);
create index idx_ooh_vanity  on ooh_sites(vanity_slug);

-- ── INFLUENCER / CREATIVE / COMPETITIVE ──────────────────────────────────────

create table creators (
  id                    uuid primary key default gen_random_uuid(),
  brand_id              uuid not null references brands(id) on delete cascade,
  handle                text not null,
  platform              text,
  followers             integer,
  engagement_rate       numeric(6,3),
  primary_language      text,
  location              text,
  values_alignment_score numeric(5,2),
  cultural_iq_score     numeric(5,2),
  audience_fit_score    numeric(5,2),
  risk_level            text,
  analysis              jsonb,
  created_at            timestamptz not null default now()
);
create index idx_creators_brand on creators(brand_id);

create table influencer_campaigns (
  id                    uuid primary key default gen_random_uuid(),
  brand_id              uuid not null references brands(id) on delete cascade,
  creator_id            uuid references creators(id) on delete set null,
  name                  text,
  utm_campaign          text,
  promo_code            text,
  reach                 integer default 0,
  impressions           integer default 0,
  engagements           integer default 0,
  emv                   numeric(14,2),
  attributed_clicks     integer default 0,
  attributed_conversions integer default 0,
  fee                   numeric(14,2),
  currency              char(3) default 'NGN',
  created_at            timestamptz not null default now()
);

create table creative_analyses (
  id                  uuid primary key default gen_random_uuid(),
  brand_id            uuid not null references brands(id) on delete cascade,
  asset_type          text,
  asset_url           text,
  cultural_resonance  numeric(5,2),
  brand_consistency   numeric(5,2),
  message_clarity     numeric(5,2),
  emotional_impact    numeric(5,2),
  cta_strength        numeric(5,2),
  funnel_suitability  text,
  red_flags           jsonb,
  recommendations     text[],
  created_at          timestamptz not null default now()
);

create table competitor_intelligence_daily (
  id            uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitors(id) on delete cascade,
  brand_id      uuid not null references brands(id) on delete cascade,
  day           date not null,
  social_data   jsonb,
  search_data   jsonb,
  ad_data       jsonb,
  press_data    jsonb,
  app_data      jsonb,
  hiring_data   jsonb,
  ai_mention_data jsonb,
  created_at    timestamptz not null default now(),
  unique (competitor_id, day)
);

create table competitor_sightings (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references brands(id) on delete cascade,
  competitor_id uuid references competitors(id) on delete set null,
  reported_by   uuid references auth.users(id) on delete set null,
  lat           numeric(9,6),
  lng           numeric(9,6),
  observation_type text,
  scale         text check (scale in ('major','moderate','small')),
  photo_url     text,
  notes         text,
  occurred_at   timestamptz not null default now()
);
create index idx_sightings_brand on competitor_sightings(brand_id, occurred_at desc);

-- ── AI / PREFERENCES ─────────────────────────────────────────────────────────

create table ai_conversations (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references brands(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  messages      jsonb not null default '[]'::jsonb,
  sources_cited jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_aiconv_brand on ai_conversations(brand_id, updated_at desc);
create trigger trg_aiconv_updated before update on ai_conversations
  for each row execute function set_updated_at();

create table user_preferences (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete cascade,
  preferences  jsonb not null default '{}'::jsonb,
  unique (user_id, workspace_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on every table ──────────────────────────────────
alter table workspaces                   enable row level security;
alter table workspace_members            enable row level security;
alter table brands                       enable row level security;
alter table competitors                  enable row level security;
alter table social_connections           enable row level security;
alter table social_posts                 enable row level security;
alter table mentions                     enable row level security;
alter table paid_campaigns               enable row level security;
alter table pre_post_analyses            enable row level security;
alter table brand_health_snapshots       enable row level security;
alter table sov_snapshots                enable row level security;
alter table funnel_snapshots             enable row level security;
alter table emv_records                  enable row level security;
alter table cultural_resonance_scores    enable row level security;
alter table cultural_events              enable row level security;
alter table events                       enable row level security;
alter table event_ambassadors            enable row level security;
alter table event_interactions           enable row level security;
alter table audio_files                  enable row level security;
alter table transcriptions               enable row level security;
alter table surveys                      enable row level security;
alter table survey_responses             enable row level security;
alter table nps_records                  enable row level security;
alter table sentiment_daily              enable row level security;
alter table ooh_sites                    enable row level security;
alter table creators                     enable row level security;
alter table influencer_campaigns         enable row level security;
alter table creative_analyses            enable row level security;
alter table competitor_intelligence_daily enable row level security;
alter table competitor_sightings         enable row level security;
alter table ai_conversations             enable row level security;
alter table user_preferences             enable row level security;

-- ── Workspace-level policies ──────────────────────────────────────────────────

-- A user sees only workspaces they belong to.
create policy workspaces_select on workspaces for select
  using (is_workspace_member(id));

-- Only owners can update workspace settings.
create policy workspaces_update on workspaces for update
  using  (exists (select 1 from workspace_members m
                  where m.workspace_id = id and m.user_id = auth.uid()
                    and m.role = 'owner'))
  with check (exists (select 1 from workspace_members m
                      where m.workspace_id = id and m.user_id = auth.uid()
                        and m.role = 'owner'));

-- Members see all member rows within their workspaces.
create policy workspace_members_select on workspace_members for select
  using (is_workspace_member(workspace_id));

-- Only owners/admins can manage membership.
create policy workspace_members_insert on workspace_members for insert
  with check (exists (select 1 from workspace_members m
                      where m.workspace_id = workspace_id and m.user_id = auth.uid()
                        and m.role in ('owner','admin')));

create policy workspace_members_delete on workspace_members for delete
  using (exists (select 1 from workspace_members m
                 where m.workspace_id = workspace_id and m.user_id = auth.uid()
                   and m.role in ('owner','admin')));

-- ── Brand-level policy ────────────────────────────────────────────────────────

create policy brands_all on brands for all
  using  (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

-- ── Brand-child policy template ──────────────────────────────────────────────
-- Every table with brand_id uses this pattern.

create policy competitors_all on competitors for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create policy social_connections_all on social_connections for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create policy social_posts_all on social_posts for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create policy mentions_all on mentions for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create policy paid_campaigns_all on paid_campaigns for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create policy pre_post_analyses_all on pre_post_analyses for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create policy brand_health_snapshots_all on brand_health_snapshots for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create policy sov_snapshots_all on sov_snapshots for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create policy funnel_snapshots_all on funnel_snapshots for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create policy emv_records_all on emv_records for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create policy cultural_resonance_scores_all on cultural_resonance_scores for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create policy events_all on events for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

-- event_ambassadors and event_interactions: access via parent event → brand
create policy event_ambassadors_all on event_ambassadors for all
  using  (exists (
    select 1 from events e
    join brands b on b.id = e.brand_id
    where e.id = event_id and is_workspace_member(b.workspace_id)))
  with check (exists (
    select 1 from events e
    join brands b on b.id = e.brand_id
    where e.id = event_id and is_workspace_member(b.workspace_id)));

-- Authenticated workspace members can read interactions.
-- Public ambassador writes go through the service-role API route — no anon policy here.
create policy event_interactions_all on event_interactions for all
  using  (exists (
    select 1 from events e
    join brands b on b.id = e.brand_id
    where e.id = event_id and is_workspace_member(b.workspace_id)))
  with check (exists (
    select 1 from events e
    join brands b on b.id = e.brand_id
    where e.id = event_id and is_workspace_member(b.workspace_id)));

create policy audio_files_all on audio_files for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create policy transcriptions_all on transcriptions for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create policy surveys_all on surveys for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

-- Authenticated workspace members can read survey responses.
-- Public respondent writes go through the service-role API route — no anon policy here.
create policy survey_responses_all on survey_responses for all
  using  (exists (
    select 1 from surveys s
    join brands b on b.id = s.brand_id
    where s.id = survey_id and is_workspace_member(b.workspace_id)))
  with check (exists (
    select 1 from surveys s
    join brands b on b.id = s.brand_id
    where s.id = survey_id and is_workspace_member(b.workspace_id)));

create policy nps_records_all on nps_records for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create policy sentiment_daily_all on sentiment_daily for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

-- OOH: workspace members manage sites; vanity-link visit increments go through service-role.
create policy ooh_sites_all on ooh_sites for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create policy creators_all on creators for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create policy influencer_campaigns_all on influencer_campaigns for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create policy creative_analyses_all on creative_analyses for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create policy competitor_intelligence_daily_all on competitor_intelligence_daily for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create policy competitor_sightings_all on competitor_sightings for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create policy ai_conversations_all on ai_conversations for all
  using  (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

-- ── cultural_events: global library + workspace-specific ─────────────────────

-- Any authenticated user can read global events.
create policy cultural_events_global_select on cultural_events for select
  using (is_global = true and workspace_id is null);

-- Workspace members can read and manage their own custom events.
create policy cultural_events_workspace_all on cultural_events for all
  using  (workspace_id is not null and is_workspace_member(workspace_id))
  with check (workspace_id is not null and is_workspace_member(workspace_id));

-- ── user_preferences: users see and manage only their own rows ────────────────

create policy user_preferences_own on user_preferences for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());
