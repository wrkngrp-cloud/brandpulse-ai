-- ============================================================
-- Free Tools & product-led acquisition
-- ============================================================
--
-- Five public tools run for a visitor who has connected nothing and signed up
-- for nothing. That shapes every table here.
--
-- Two RLS shapes live in this file, and the difference is deliberate.
--
--   Anonymous tables (tool_runs, tool_events, tool_campaigns, tool_placements,
--   tool_visits, tool_responses) hold work that has no workspace yet. They
--   follow the lead-desk pattern from 20260914090000: service-role writes from
--   the public API routes, reads for is_lead_desk(), and — once a run or a
--   campaign is claimed — reads for the members of the workspace that claimed
--   it. There is no anon policy anywhere in this file. A visitor reads their
--   own run by presenting the opaque token to a service-role route, never by
--   querying PostgREST.
--
--   Workspace tables (competitor_moves, acquisition_opportunities,
--   page_audits, page_audit_findings) are ordinary tenant tables and scope
--   through is_workspace_member() like everything else in the schema.

-- ── Anonymous analysis sessions ──────────────────────────────────────────────

create table if not exists tool_runs (
  id            uuid primary key default gen_random_uuid(),
  tool_id       text not null
                check (tool_id in ('pr-scoreboard','competitor-tracker',
                       'market-demand','offline-tracker','campaign-audit')),
  -- SHA-256 of the 32-byte token handed to the visitor. The token itself is
  -- never stored: a leaked backup must not hand anyone a stranger's report.
  token_hash    text not null unique,
  -- What they typed. Public business inputs only (websites, markets, campaign
  -- names). Never an email, a name or a phone number.
  inputs        jsonb not null default '{}'::jsonb,
  status        text not null default 'running'
                check (status in ('running','complete','failed','insufficient_evidence')),
  result        jsonb,
  -- Shown to the visitor when status is failed or insufficient_evidence. Plain
  -- language, no stack traces.
  failure_note  text,
  -- Which sources answered and which did not, so the report can say what it
  -- could not see instead of quietly narrowing.
  coverage      jsonb not null default '{}'::jsonb,
  ip_hash       text,
  referrer      text,
  user_agent    text,
  -- Claim: set once, when a signed-in user continues the work in BrandGauge.
  claimed_by    uuid references auth.users(id) on delete set null,
  workspace_id  uuid references workspaces(id) on delete set null,
  brand_id      uuid references brands(id) on delete set null,
  claimed_at    timestamptz,
  -- Retention. An unclaimed run is a stranger's scratch work; it goes after
  -- thirty days. A claimed run belongs to a workspace and is kept.
  expires_at    timestamptz not null default (now() + interval '30 days'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_tool_runs_tool     on tool_runs(tool_id, created_at desc);
create index if not exists idx_tool_runs_ws       on tool_runs(workspace_id);
create index if not exists idx_tool_runs_expires  on tool_runs(expires_at)
  where claimed_at is null;

alter table tool_runs enable row level security;

create policy tool_runs_read on tool_runs for select
  using (is_lead_desk() or (workspace_id is not null and is_workspace_member(workspace_id)));

create trigger trg_tool_runs_updated before update on tool_runs
  for each row execute function set_updated_at();

-- ── The acquisition funnel ───────────────────────────────────────────────────
--
-- First-party because there is no analytics provider wired into this codebase:
-- posthog-js is in package.json and imported nowhere. A table we own also means
-- the founder's funnel view is a SQL query rather than a vendor dashboard, and
-- that anonymous and signed-in halves of one journey join on the same run id.

create table if not exists tool_events (
  id            bigserial primary key,
  event         text not null
                check (event in (
                  'free_tool_viewed','free_tool_started','free_tool_completed',
                  'free_tool_result_viewed','free_tool_result_engaged',
                  'beta_cta_viewed','beta_cta_clicked',
                  'beta_signup_started','beta_signup_completed',
                  'beta_workspace_activated','first_value_received',
                  'beta_feature_used','user_returned',
                  'external_connection_activated')),
  tool_id       text,
  run_id        uuid references tool_runs(id) on delete set null,
  -- A per-browser random id, not a fingerprint and not an IP. It links the
  -- steps of one visit without identifying anybody.
  visitor_id    text,
  user_id       uuid references auth.users(id) on delete set null,
  workspace_id  uuid references workspaces(id) on delete set null,
  props         jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_tool_events_tool  on tool_events(tool_id, created_at desc);
create index if not exists idx_tool_events_event on tool_events(event, created_at desc);
create index if not exists idx_tool_events_run   on tool_events(run_id);

alter table tool_events enable row level security;
create policy tool_events_read on tool_events for select using (is_lead_desk());

-- ── Offline Campaign Tracker ─────────────────────────────────────────────────
--
-- The campaign starts anonymous and keeps its identity when it is claimed:
-- workspace_id and brand_id are filled in on the same row rather than the rows
-- being copied into ooh_sites. A QR code on a printed billboard cannot be
-- reissued, so the slug it encodes must never move.

create table if not exists tool_campaigns (
  id            uuid primary key default gen_random_uuid(),
  -- Cascade, not set null: an unclaimed run that reaches its expiry takes its
  -- campaign, placements and visits with it. A claimed run is never purged, so
  -- a claimed campaign is never reached by this.
  run_id        uuid references tool_runs(id) on delete cascade,
  name          text not null,
  campaign_type text not null
                check (campaign_type in ('outdoor','event','activation','radio',
                       'flyer','in_store','sponsorship','other')),
  destination_url text not null,
  market        text,
  -- Claimed state. Null brand_id means the campaign still belongs to the
  -- anonymous run and is reachable only with the run token.
  workspace_id  uuid references workspaces(id) on delete set null,
  brand_id      uuid references brands(id) on delete cascade,
  -- Response capture, off until the owner turns it on in BrandGauge.
  response_enabled boolean not null default false,
  response_headline text,
  response_blurb    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_tool_campaigns_brand on tool_campaigns(brand_id);
create index if not exists idx_tool_campaigns_run   on tool_campaigns(run_id);

alter table tool_campaigns enable row level security;
create policy tool_campaigns_read on tool_campaigns for select
  using (is_lead_desk() or (brand_id is not null and is_workspace_member(
    (select workspace_id from brands where id = brand_id))));
create policy tool_campaigns_write on tool_campaigns for update
  using (brand_id is not null and is_workspace_member(
    (select workspace_id from brands where id = brand_id)))
  with check (brand_id is not null and is_workspace_member(
    (select workspace_id from brands where id = brand_id)));

create trigger trg_tool_campaigns_updated before update on tool_campaigns
  for each row execute function set_updated_at();

create table if not exists tool_placements (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references tool_campaigns(id) on delete cascade,
  name          text not null,
  -- The slug behind /go/<slug>. Unique across the whole redirect namespace is
  -- enforced by the lookup order in /go, and by this table's own uniqueness;
  -- the generator checks print_placements and ooh_sites before settling.
  slug          text not null unique,
  -- utm_content, so one campaign's placements are separable in the
  -- destination's own analytics as well as in ours.
  utm_content   text not null,
  visits        integer not null default 0,
  unique_visits integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_tool_placements_campaign on tool_placements(campaign_id);
create index if not exists idx_tool_placements_slug     on tool_placements(slug);

alter table tool_placements enable row level security;
create policy tool_placements_read on tool_placements for select
  using (is_lead_desk() or exists (
    select 1 from tool_campaigns c join brands b on b.id = c.brand_id
    where c.id = campaign_id and is_workspace_member(b.workspace_id)));

create table if not exists tool_visits (
  id            bigserial primary key,
  placement_id  uuid not null references tool_placements(id) on delete cascade,
  campaign_id   uuid not null references tool_campaigns(id) on delete cascade,
  -- Coarse only, and hashed. This is a public redirect: we record that a visit
  -- happened and roughly from where, not who.
  visitor_hash  text,
  ip_region     text,
  device_type   text,
  referrer      text,
  is_unique     boolean not null default true,
  -- A hit we did not count as a human. Kept rather than dropped so the
  -- dashboard can say "and 14 we judged automated" instead of silently
  -- shrinking the number.
  is_bot        boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists idx_tool_visits_placement on tool_visits(placement_id, created_at desc);
create index if not exists idx_tool_visits_campaign  on tool_visits(campaign_id, created_at desc);

alter table tool_visits enable row level security;
create policy tool_visits_read on tool_visits for select
  using (is_lead_desk() or exists (
    select 1 from tool_campaigns c join brands b on b.id = c.brand_id
    where c.id = campaign_id and is_workspace_member(b.workspace_id)));

-- First-party enquiries from a campaign response page. Consent is not a
-- checkbox we infer: consented_at is written only when the visitor ticked the
-- box, and the row is refused without it by the API route.
create table if not exists tool_responses (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references tool_campaigns(id) on delete cascade,
  placement_id  uuid references tool_placements(id) on delete set null,
  name          text,
  email         text,
  phone         text,
  message       text,
  wants_callback boolean not null default false,
  consented_at  timestamptz not null,
  consent_text  text not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_tool_responses_campaign on tool_responses(campaign_id, created_at desc);

alter table tool_responses enable row level security;
-- Personal data. Readable only by the workspace that owns the campaign —
-- never by the lead desk, and never through a run token.
create policy tool_responses_read on tool_responses for select
  using (exists (
    select 1 from tool_campaigns c join brands b on b.id = c.brand_id
    where c.id = campaign_id and is_workspace_member(b.workspace_id)));

-- ── Competitor Move Tracker (claimed workspace) ──────────────────────────────

create table if not exists competitor_moves (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references brands(id) on delete cascade,
  competitor_id uuid references competitors(id) on delete cascade,
  competitor_name text not null,
  category      text not null
                check (category in ('product_launch','product_change','pricing',
                       'partnership','expansion','positioning','company')),
  headline      text not null,
  -- Why it matters, and what to consider doing. Both are AI interpretation of
  -- the evidence below, and the UI labels them as such.
  significance  text,
  implication   text,
  -- The evidence. A move without a source_url is not stored.
  source_url    text not null,
  source_kind   text not null
                check (source_kind in ('press','announcement','site_page','site_change')),
  quote         text,
  published_at  date,
  discovered_at timestamptz not null default now(),
  confidence    text not null default 'medium'
                check (confidence in ('high','medium','low')),
  -- Baseline rows are what we found on the first run: already true when the
  -- watch started, so never alerted on.
  is_baseline   boolean not null default false,
  alerted_at    timestamptz,
  -- Stable identity of one development, so a second crawl of the same story
  -- updates rather than duplicates.
  fingerprint   text not null,
  created_at    timestamptz not null default now(),
  unique (brand_id, fingerprint)
);

create index if not exists idx_competitor_moves_brand on competitor_moves(brand_id, discovered_at desc);

alter table competitor_moves enable row level security;
create policy competitor_moves_all on competitor_moves for all
  using (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

-- Monitoring configuration, one row per competitor being watched.
create table if not exists competitor_watches (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references brands(id) on delete cascade,
  competitor_id uuid references competitors(id) on delete cascade,
  competitor_name text not null,
  website_url   text not null,
  market        text,
  enabled       boolean not null default true,
  -- The homepage and pricing text we last read, hashed. A change in the hash
  -- is a detected website change, which is a weaker claim than an
  -- announcement and is labelled differently in the UI.
  home_hash     text,
  pricing_hash  text,
  last_checked_at timestamptz,
  created_at    timestamptz not null default now(),
  unique (brand_id, website_url)
);

create index if not exists idx_competitor_watches_brand on competitor_watches(brand_id);

alter table competitor_watches enable row level security;
create policy competitor_watches_all on competitor_watches for all
  using (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

-- ── Market Demand Gap Finder (claimed workspace) ─────────────────────────────

create table if not exists acquisition_opportunities (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references brands(id) on delete cascade,
  run_id        uuid references tool_runs(id) on delete set null,
  title         text not null,
  -- The customer problem in the customer's words, not ours.
  customer_problem text,
  intent_stage  text
                check (intent_stage in ('problem_aware','solution_discovery',
                       'brand_alternatives','comparison','purchase')),
  -- What kind of claim this is. demand_evidence means a licensed search
  -- provider answered; visibility_gap means it did not, and the opportunity
  -- rests on who is visible rather than on measured demand.
  evidence_kind text not null default 'visibility_gap'
                check (evidence_kind in ('demand_evidence','visibility_gap','content_gap')),
  evidence      jsonb not null default '[]'::jsonb,
  competitors_visible jsonb not null default '[]'::jsonb,
  recommended_action text,
  priority      integer not null default 3 check (priority between 1 and 5),
  status        text not null default 'identified'
                check (status in ('identified','planned','in_progress','done','dismissed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_acq_opps_brand on acquisition_opportunities(brand_id, priority);

alter table acquisition_opportunities enable row level security;
create policy acq_opps_all on acquisition_opportunities for all
  using (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create trigger trg_acq_opps_updated before update on acquisition_opportunities
  for each row execute function set_updated_at();

-- ── Campaign Conversion Audit (claimed workspace) ────────────────────────────

create table if not exists page_audits (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references brands(id) on delete cascade,
  run_id        uuid references tool_runs(id) on delete set null,
  page_url      text not null,
  objective     text,
  market        text,
  -- Measured mobile performance, when PageSpeed answered. Null is null, never
  -- a guess: the report says the check did not run.
  performance   jsonb,
  summary       text,
  -- Which checks ran and which could not, for the limitations block.
  coverage      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_page_audits_brand on page_audits(brand_id, created_at desc);

alter table page_audits enable row level security;
create policy page_audits_all on page_audits for all
  using (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create table if not exists page_audit_findings (
  id            uuid primary key default gen_random_uuid(),
  audit_id      uuid not null references page_audits(id) on delete cascade,
  brand_id      uuid not null references brands(id) on delete cascade,
  area          text not null
                check (area in ('performance','accessibility','cta','clarity',
                       'friction','local_readiness','tracking')),
  title         text not null,
  detail        text,
  severity      text not null default 'medium'
                check (severity in ('high','medium','low')),
  -- observed: a check measured it. interpreted: a model read the page and
  -- formed a view. The UI never presents the second as the first.
  provenance    text not null default 'observed'
                check (provenance in ('observed','interpreted')),
  confidence    text not null default 'medium'
                check (confidence in ('high','medium','low')),
  evidence      text,
  recommendation text,
  status        text not null default 'open'
                check (status in ('open','planned','fixed','wont_fix')),
  -- Did the next audit of this page still find it? Set by a re-run.
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_audit_findings_audit on page_audit_findings(audit_id);
create index if not exists idx_audit_findings_brand on page_audit_findings(brand_id, status);

alter table page_audit_findings enable row level security;
create policy audit_findings_all on page_audit_findings for all
  using (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

create trigger trg_audit_findings_updated before update on page_audit_findings
  for each row execute function set_updated_at();

-- ── Retention ────────────────────────────────────────────────────────────────
-- Called by the nightly Inngest job. An unclaimed run past its expiry is
-- deleted outright; a claimed one belongs to a workspace and is never touched
-- here. Cascades clear the campaign, its placements and its visits with it.
create or replace function purge_expired_tool_runs()
returns integer language plpgsql security definer
set search_path = public as $$
declare removed integer;
begin
  with gone as (
    delete from tool_runs
    where claimed_at is null and expires_at < now()
    returning 1
  )
  select count(*) into removed from gone;
  return removed;
end $$;
