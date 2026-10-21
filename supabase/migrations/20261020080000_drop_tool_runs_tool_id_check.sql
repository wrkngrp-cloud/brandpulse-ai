-- tool_runs.tool_id has been rejecting brand-gap since the tool shipped.
--
-- The check predates it: 20261014090000 named the five tools that existed
-- then, and nothing updated it when Brand Perception Gap was added. Every
-- call to /api/tools/brand-gap has been failing to open its own tool_runs
-- row ever since - a check constraint violation, not caught anywhere, so the
-- route 500s with no body and the client's `.json()` throws on the empty
-- response.
--
-- This is the third time a hardcoded copy of the tool id list has drifted
-- (lead_tool_runs_tool_id_check and a stale tool_events_event_check both
-- went the same way, both already fixed). No replacement constraint this
-- time either: the registry's own union type is where this list actually
-- lives, and it is already enforced at compile time everywhere a tool id is
-- written.

alter table tool_runs drop constraint if exists tool_runs_tool_id_check;
