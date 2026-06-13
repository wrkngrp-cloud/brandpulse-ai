-- Event & Sponsorship ROI module additions
-- Core tables (events, event_ambassadors, event_interactions) already exist.
-- This migration adds the new columns, tables, and indexes needed for Module 10.

-- ── Add missing columns to events ────────────────────────────────────────────

alter table events
  add column if not exists hashtags             text[]      not null default '{}',
  add column if not exists debrief              jsonb;

-- Add NOT NULL constraints that were missing in initial schema
alter table events
  alter column city         set not null,
  alter column date_start   set not null,
  alter column date_end     set not null,
  alter column objectives   set not null,
  alter column activation_mechanics set not null,
  alter column kpi_targets  set not null,
  alter column currency     set not null,
  alter column status       set not null;

-- ── Add missing index on ambassador session_token ─────────────────────────────

create index if not exists idx_event_ambassadors_event  on event_ambassadors(event_id);
create index if not exists idx_event_ambassadors_token  on event_ambassadors(session_token);

-- ── E4 intercept survey responses ────────────────────────────────────────────

create table if not exists event_intercept_responses (
  id            uuid        primary key default gen_random_uuid(),
  event_id      uuid        not null references events(id) on delete cascade,
  ambassador_id uuid        references event_ambassadors(id) on delete set null,
  answers       jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_intercept_event on event_intercept_responses(event_id);

-- ── ROI reports ───────────────────────────────────────────────────────────────

create table if not exists event_roi_reports (
  id           uuid        primary key default gen_random_uuid(),
  event_id     uuid        not null references events(id) on delete cascade unique,
  metrics      jsonb       not null default '{}'::jsonb,
  narrative    text,
  generated_at timestamptz not null default now()
);

-- ── RLS for new tables ────────────────────────────────────────────────────────

alter table event_intercept_responses enable row level security;
alter table event_roi_reports         enable row level security;

create policy event_intercept_responses_workspace_member on event_intercept_responses
  for all using (
    event_id in (
      select e.id from events e
      join brands b on b.id = e.brand_id
      join workspace_members wm on wm.workspace_id = b.workspace_id
      where wm.user_id = auth.uid()
    )
  );

create policy event_roi_reports_workspace_member on event_roi_reports
  for all using (
    event_id in (
      select e.id from events e
      join brands b on b.id = e.brand_id
      join workspace_members wm on wm.workspace_id = b.workspace_id
      where wm.user_id = auth.uid()
    )
  );

-- ── Enable Realtime for live dashboard (E3) ───────────────────────────────────

alter publication supabase_realtime add table event_interactions;
