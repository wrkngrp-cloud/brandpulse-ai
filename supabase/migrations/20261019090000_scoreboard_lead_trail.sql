-- Put the PR Scoreboard into the same lead trail as the other tools.
--
-- The scoreboard's capture predates lead_tool_runs and writes the older
-- scan_id path, so a lead who ran the scoreboard and later unlocked a
-- competitor brief showed up on the desk as two unrelated blocks instead of
-- one chronological list. The oldest and most proven tool was the one missing
-- from the view.
--
-- The route writes a trail row from now on. This backfills what is already
-- there, so the desk is consistent for leads collected before today rather
-- than only for the ones collected after it.

insert into lead_tool_runs (lead_id, run_id, tool_id, inputs, headline, wants_monitoring, created_at)
select
  l.id,
  -- No run_id: a scoreboard scan is a public_scans row, not a tool_run. The
  -- snapshot below is the whole record, which is exactly why the column is
  -- nullable and why inputs are copied rather than joined.
  null,
  'pr-scoreboard',
  jsonb_strip_nulls(jsonb_build_object(
    'brand',       s.brand_name,
    'competitors', s.competitors,
    'category',    s.category
  )),
  case
    when s.share_of_reach is not null
      then s.brand_name || ' held ' || s.share_of_reach || '% of the category''s earned reach'
    when s.mentions_found is not null
      then s.brand_name || ': ' || s.mentions_found || ' press mentions found'
    else null
  end,
  l.wants_weekly,
  l.created_at
from leads l
join public_scans s on s.id = l.scan_id
where l.scan_id is not null
  -- The unique index only covers rows with a run_id, and these have none, so
  -- the guard against a re-run has to be written out.
  and not exists (
    select 1 from lead_tool_runs r
    where r.lead_id = l.id and r.tool_id = 'pr-scoreboard'
  );
