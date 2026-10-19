-- Catch the live constraints up to what the app already writes.
--
-- leads_source_check never grew to include the two newest tool ids:
-- captureLead writes `source` straight from the tool id, so a visitor
-- unlocking a report on the PR Scoreboard or the Brand Perception Gap hits a
-- check-constraint violation, not a lead. And tool_events_event_check still
-- only knows the gate's old event names (email_gate_shown/submitted) from
-- before they were renamed to free_tool_gate_viewed/free_tool_lead_captured,
-- so every gate-view and every capture on any tool fails to log the instant
-- the gate is wired up, taking the funnel blind on exactly the number worth
-- watching after that ships.
--
-- A handful of rows already recorded under the old names before this ships -
-- the other session's own testing of the gate, by the look of it. They move
-- to the new names rather than staying exceptions the constraint has to
-- carry forever: the event means the same thing, pre-rename and after.

alter table leads drop constraint if exists leads_source_check;
alter table leads add constraint leads_source_check check (source in (
  'scoreboard', 'landing', 'other',
  'pr-scoreboard', 'brand-gap', 'competitor-tracker', 'market-demand',
  'offline-tracker', 'campaign-audit'
));

-- Drop first, so the remap below isn't still held to the old allowed list it
-- is trying to move rows off of.
alter table tool_events drop constraint if exists tool_events_event_check;

update tool_events set event = 'free_tool_gate_viewed'   where event = 'email_gate_shown';
update tool_events set event = 'free_tool_lead_captured' where event = 'email_gate_submitted';

alter table tool_events add constraint tool_events_event_check check (event in (
  'free_tool_viewed', 'free_tool_started', 'free_tool_completed',
  'free_tool_result_viewed', 'free_tool_result_engaged',
  'free_tool_gate_viewed', 'free_tool_lead_captured',
  'beta_cta_viewed', 'beta_cta_clicked',
  'beta_signup_started', 'beta_signup_completed',
  'beta_workspace_activated', 'first_value_received',
  'beta_feature_used', 'user_returned',
  'external_connection_activated'
));
