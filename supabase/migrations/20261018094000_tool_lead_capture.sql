-- Lead capture on the free tools.
--
-- The tools shipped with no way to contact anyone who used them. The PR
-- Scoreboard asked for an address; the other four did not, so a marketer could
-- run a competitor brief start to finish and remain anonymous. That makes them
-- useful products and poor acquisition levers.
--
-- Two things this migration has to get right.
--
-- First, `tool_runs` still holds no personal data. That is the property that
-- makes a report URL safe to share, and it survives: the email lives in
-- `leads`, and `lead_tool_runs` joins the two. A run id leaks nothing about a
-- person even if the link is forwarded.
--
-- Second, `leads` is unique on email and carries a single `scan_id`. One
-- person who runs three different tools would collapse into one row and the
-- desk would see only the most recent. The child table below is one row per
-- run, so the desk sees the whole trail: what they analysed, in what order,
-- and what they asked to be kept informed about.

-- ── The lead, enriched ───────────────────────────────────────────────────────

-- Every tool id joins the existing sources, because captureLead writes the
-- tool id straight into `source`. 'pr-scoreboard' is the registry's id and
-- 'scoreboard' is what the board wrote before it shared this path, so both
-- are allowed and the old rows keep their value. Dropping and re-adding is
-- the only way to widen a check constraint.
alter table leads drop constraint if exists leads_source_check;
alter table leads add constraint leads_source_check check (source in (
  'scoreboard', 'landing', 'other',
  'pr-scoreboard', 'brand-gap', 'competitor-tracker', 'market-demand',
  'offline-tracker', 'campaign-audit'
));

-- Role and seniority, asked for once at the point of capture. This is the one
-- thing a BDM cannot infer from the website, which is why it is worth a field
-- when company is not.
alter table leads add column if not exists role text;

-- The website they analysed. Company is derived from it rather than typed,
-- so the form stays at three fields.
alter table leads add column if not exists website text;

-- ── One row per tool run ─────────────────────────────────────────────────────

create table if not exists lead_tool_runs (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  -- Set null rather than cascade: an unclaimed run is purged after thirty days
  -- and the lead must outlive it. The snapshot below is why that still works.
  run_id      uuid references tool_runs(id) on delete set null,
  tool_id     text not null,
  -- What they typed, copied at capture time. The run it came from may be
  -- purged later, and a desk row that says "ran the tracker on competitor.com"
  -- is worth keeping after the report behind it has gone.
  inputs      jsonb not null default '{}'::jsonb,
  -- A one-line summary of what the report found, for the follow-up call.
  headline    text,
  -- Did they ask for the recurring version: the weekly watch, the re-audit,
  -- the campaign dashboard link. An unticked box here is a promise not made.
  wants_monitoring boolean not null default false,
  consent_text text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_lead_tool_runs_lead on lead_tool_runs(lead_id, created_at desc);
create index if not exists idx_lead_tool_runs_run  on lead_tool_runs(run_id);
create index if not exists idx_lead_tool_runs_tool on lead_tool_runs(tool_id, created_at desc);

-- A second unlock of the same report by the same person is not a second lead.
create unique index if not exists idx_lead_tool_runs_unique on lead_tool_runs(lead_id, run_id)
  where run_id is not null;

alter table lead_tool_runs enable row level security;

-- Same rule as every other lead table: the lead desk allowlist, never a
-- workspace, and writes only from the service role.
create policy lead_tool_runs_read on lead_tool_runs
  for select using (is_lead_desk());

-- ── Events ───────────────────────────────────────────────────────────────────
-- Two new points in the funnel: the gate was shown, and it was answered. The
-- gap between them is the cost of the gate, which is the number worth watching
-- after this ships.
alter table tool_events drop constraint if exists tool_events_event_check;
alter table tool_events add constraint tool_events_event_check check (event in (
  'free_tool_viewed','free_tool_started','free_tool_completed',
  'free_tool_result_viewed','free_tool_result_engaged',
  'free_tool_gate_viewed','free_tool_lead_captured',
  'beta_cta_viewed','beta_cta_clicked',
  'beta_signup_started','beta_signup_completed',
  'beta_workspace_activated','first_value_received',
  'beta_feature_used','user_returned',
  'external_connection_activated'
));
