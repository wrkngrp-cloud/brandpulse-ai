-- Let any free tool capture a lead, not only the scoreboard.
--
-- Today an address is only ever asked for on the scoreboard. The other four
-- tools (competitor-tracker, market-demand, offline-tracker, campaign-audit)
-- end their report with a signup CTA and nothing else, so a visitor who is
-- not ready to create an account leaves no trail at all. This migration
-- widens the schema so the same "address for the weekly watch" ask can run
-- on any of them, before the gate UI and API route that use it are built.

-- ── Leads can now come from any tool ─────────────────────────────────────────
alter table leads drop constraint leads_source_check;
alter table leads add constraint leads_source_check
  check (source in ('scoreboard','landing','other',
                     'competitor-tracker','market-demand','offline-tracker','campaign-audit'));

-- role: what they typed for "what best describes you" on the gate, free text
-- rather than an enum because the gate's own copy will change before the
-- taxonomy is worth locking in SQL.
-- website: theirs, not the one they searched. The gate asks for it once so
-- the desk's follow-up never has to.
alter table leads add column if not exists role text;
alter table leads add column if not exists website text;

-- ── The trail behind a lead ──────────────────────────────────────────────────
--
-- One lead can run several tools, and several times, before giving an
-- address. This is that trail: every anonymous run known to have happened
-- before or alongside the row in `leads`. It points at whichever table that
-- tool's run actually lives in — `tool_runs` for the four newer tools,
-- `public_scans` for the scoreboard, which predates `tool_runs` and keeps its
-- own table — never both, and never neither.
-- The shape here is the reconciled one, which 20261019120000 also arrives at
-- by altering whatever ran. Both files have to describe the same table: this
-- one already ran on the live database and is never re-applied, while a
-- replay from empty runs this one and then finds 20261019120000 a no-op. When
-- they disagreed, 20261019090000 inserted into columns that did not exist yet
-- and no fresh database could be built from this set at all. Read
-- 20261019120000 for why each of these is the way it is.
create table if not exists lead_tool_runs (
  id               uuid primary key default gen_random_uuid(),
  lead_id          uuid not null references leads(id) on delete cascade,
  tool_id          text not null,
  run_id           uuid references tool_runs(id) on delete set null,
  scan_id          uuid references public_scans(id) on delete set null,
  inputs           jsonb not null default '{}'::jsonb,
  headline         text,
  wants_monitoring boolean not null default false,
  consent_text     text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_lead_tool_runs_lead on lead_tool_runs(lead_id, created_at desc);
-- A visitor re-running the same tool before converting must not duplicate the
-- trail; a second run of the same tool is still its own row. No predicate on
-- this one: PostgREST cannot infer a partial index as an ON CONFLICT target.
create unique index if not exists idx_lead_tool_runs_lead_run
  on lead_tool_runs(lead_id, run_id);
create unique index if not exists idx_lead_tool_runs_lead_scan
  on lead_tool_runs(lead_id, scan_id) where scan_id is not null;

alter table lead_tool_runs enable row level security;
-- Same rule as leads and public_scans: a lead belongs to BrandGauge, not to a
-- tenant, so this scopes to the desk permission rather than a workspace.
-- Written by the service route only.
create policy lead_tool_runs_read on lead_tool_runs for select
  using (staff_can('leads.view'));

-- ── The gate, as an event ────────────────────────────────────────────────────
--
-- The funnel today can see a result viewed and a signup clicked, but not the
-- step in between on a tool that asks for an address first. Two events close
-- that gap: shown when the gate renders, submitted when the address lands,
-- so free_tool_funnel can read a gate's conversion the same way it already
-- reads the CTA's.
alter table tool_events drop constraint tool_events_event_check;
alter table tool_events add constraint tool_events_event_check
  check (event in (
    'free_tool_viewed','free_tool_started','free_tool_completed',
    'free_tool_result_viewed','free_tool_result_engaged',
    'beta_cta_viewed','beta_cta_clicked',
    'beta_signup_started','beta_signup_completed',
    'beta_workspace_activated','first_value_received',
    'beta_feature_used','user_returned',
    'external_connection_activated',
    'email_gate_shown','email_gate_submitted'));
