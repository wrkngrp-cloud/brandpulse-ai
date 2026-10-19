-- Retire lead_desk_admins. The Desk owns lead access now.
--
-- Why this is a fix and not only a tidy-up: nothing has ever inserted a row
-- into lead_desk_admins. Not a migration, not a route, not a seed. So
-- `is_lead_desk()` has returned false for every caller since the day the
-- scoreboard shipped, which meant /dashboard/leads and /dashboard/leads/funnel
-- bounced everyone to /dashboard, and every policy below was readable by
-- nobody at all. The lead desk has never worked.
--
-- Everything moves to `staff_can('leads.view')`, which is a real allowlist with
-- real rows in it, and which the business development role already holds. One
-- access model for the Desk instead of two, and a BDM can be invited to work
-- the pipeline without being made a founder.
--
-- The split that stays: `leads.view` reads, `leads.edit` writes. The old table
-- had one level for both.
--
-- `tool_responses` is untouched. It holds personal data from campaign
-- enquiries and scopes to the workspace that owns the campaign, never to the
-- lead desk. That was deliberate and this migration does not widen it.
--
-- Renumbered from 20261018094000 to clear a collision: the free-tool lead
-- gate took that timestamp on main the same day. This one has to run after it
-- anyway, because it repoints a policy that migration creates.

-- ── The lead capture tables ──────────────────────────────────────────────────
drop policy if exists public_scans_read on public_scans;
create policy public_scans_read on public_scans
  for select using (staff_can('leads.view'));

drop policy if exists leads_read on leads;
create policy leads_read on leads
  for select using (staff_can('leads.view'));

drop policy if exists leads_update on leads;
create policy leads_update on leads
  for update using (staff_can('leads.edit')) with check (staff_can('leads.edit'));

-- ── The free-tool tables ─────────────────────────────────────────────────────
-- Each keeps its second arm untouched: once a run or a campaign is claimed it
-- stays readable by the workspace that claimed it.
drop policy if exists tool_runs_read on tool_runs;
create policy tool_runs_read on tool_runs for select
  using (staff_can('leads.view') or (workspace_id is not null and is_workspace_member(workspace_id)));

drop policy if exists tool_events_read on tool_events;
create policy tool_events_read on tool_events
  for select using (staff_can('leads.view'));

drop policy if exists tool_campaigns_read on tool_campaigns;
create policy tool_campaigns_read on tool_campaigns for select
  using (staff_can('leads.view') or (brand_id is not null and is_workspace_member(
    (select workspace_id from brands where id = brand_id))));

drop policy if exists tool_placements_read on tool_placements;
create policy tool_placements_read on tool_placements for select
  using (staff_can('leads.view') or exists (
    select 1 from tool_campaigns c join brands b on b.id = c.brand_id
    where c.id = campaign_id and is_workspace_member(b.workspace_id)));

drop policy if exists tool_visits_read on tool_visits;
create policy tool_visits_read on tool_visits for select
  using (staff_can('leads.view') or exists (
    select 1 from tool_campaigns c join brands b on b.id = c.brand_id
    where c.id = campaign_id and is_workspace_member(b.workspace_id)));

-- The free-tool lead gate (20261018094000_tool_lead_capture.sql) added one
-- more, on the table that holds a lead's trail through the tools. Same move.
drop policy if exists lead_tool_runs_read on lead_tool_runs;
create policy lead_tool_runs_read on lead_tool_runs
  for select using (staff_can('leads.view'));

-- ── And the allowlist itself ─────────────────────────────────────────────────
-- Dropped last, once nothing refers to it. Any row that was ever in here was
-- already copied into `staff` on the admin role by 20261014120000, so nothing
-- is lost; in practice there were none.
drop policy if exists lead_desk_admins_read on lead_desk_admins;
drop function if exists is_lead_desk();
drop table if exists lead_desk_admins;
