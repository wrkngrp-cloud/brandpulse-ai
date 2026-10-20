-- Catch lead_tool_runs up to the code it has always been read against.
--
-- 20261019080000 shipped a narrower table than the gate and the lead desk
-- were built on (the fixed side: eaa6bc3/6eb832d). Four columns were missing
-- outright, so every gate submission's upsert failed and the lead desk page
-- 500ed on the embedded relation rather than just losing the trail. The
-- tool_id check listed five ids where the registry has six, rejecting every
-- Brand Perception Gap row. The one-run check demanded exactly one of
-- run_id/scan_id, which no caller satisfies - the scoreboard and the demo
-- route both pass run_id: null and neither ever sets scan_id, so the
-- constraint rejected every row from either path. And the partial unique
-- index on (lead_id, run_id) can't be named as an ON CONFLICT target through
-- PostgREST, which needs the predicate-free form to infer against.
--
-- Written idempotently throughout: correct whether or not 20261019080000 is
-- the version that actually ran.

alter table lead_tool_runs add column if not exists inputs jsonb not null default '{}'::jsonb;
alter table lead_tool_runs add column if not exists headline text;
alter table lead_tool_runs add column if not exists wants_monitoring boolean not null default false;
alter table lead_tool_runs add column if not exists consent_text text;

-- No replacement: a hardcoded tool-id list has drifted from the registry
-- twice now, and the registry's own union type already does this job at
-- compile time.
alter table lead_tool_runs drop constraint if exists lead_tool_runs_tool_id_check;

alter table lead_tool_runs drop constraint if exists lead_tool_runs_one_run;

drop index if exists idx_lead_tool_runs_lead_run;
create unique index if not exists idx_lead_tool_runs_lead_run
  on lead_tool_runs(lead_id, run_id);
