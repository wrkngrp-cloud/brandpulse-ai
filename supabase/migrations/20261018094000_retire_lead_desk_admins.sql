-- Retire the lead desk's own allowlist now that the lead desk has a home
-- inside the Desk (`/desk/leads`, gated by `staff_can('leads.view')`).
--
-- `lead_desk_admins` and `is_lead_desk()` were the stopgap from before staff
-- permissions existed: a lead belongs to BrandGauge and not to a tenant, so
-- it could not scope through `is_workspace_member()` like everything else,
-- and there was no other notion of "staff" to scope through instead. There
-- is now, so the eight policies that read `is_lead_desk()` repoint to
-- `staff_can('leads.view')`, which is already seeded for the support,
-- bizdev, admin and super_admin role templates.

alter policy public_scans_read on public_scans
  using (staff_can('leads.view'));

alter policy leads_read on leads
  using (staff_can('leads.view'));

alter policy leads_update on leads
  using (staff_can('leads.view')) with check (staff_can('leads.view'));

alter policy tool_runs_read on tool_runs
  using (staff_can('leads.view') or (workspace_id is not null and is_workspace_member(workspace_id)));

alter policy tool_events_read on tool_events
  using (staff_can('leads.view'));

alter policy tool_campaigns_read on tool_campaigns
  using (staff_can('leads.view') or (brand_id is not null and is_workspace_member(
    (select workspace_id from brands where id = brand_id))));

alter policy tool_placements_read on tool_placements
  using (staff_can('leads.view') or exists (
    select 1 from tool_campaigns c join brands b on b.id = c.brand_id
    where c.id = campaign_id and is_workspace_member(b.workspace_id)));

alter policy tool_visits_read on tool_visits
  using (staff_can('leads.view') or exists (
    select 1 from tool_campaigns c join brands b on b.id = c.brand_id
    where c.id = campaign_id and is_workspace_member(b.workspace_id)));

-- Nothing reads `is_lead_desk()` or `lead_desk_admins` after the eight
-- policies above, so both can go. `staff` already holds everyone who was on
-- the allowlist (desk_staff.sql copied them across on the admin role when
-- the Desk was built), so dropping the table loses no one's access.
drop function if exists is_lead_desk();
drop table if exists lead_desk_admins;
