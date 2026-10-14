import { createServiceClient } from '@/lib/supabase/server'

/**
 * The acquisition funnel, recorded first-party.
 *
 * There is no analytics provider wired into this codebase — posthog-js sits in
 * package.json and is imported nowhere — and the funnel these tools need spans
 * an anonymous half and a signed-in half of the same journey. Joining those on
 * a vendor's anonymous id is the usual source of a funnel nobody trusts. A
 * table we own joins them on the run id instead.
 *
 * Nothing here identifies a person. `visitorId` is a random per-browser string
 * the client mints and keeps in sessionStorage; it links the steps of one visit
 * and nothing else.
 */

export const TOOL_EVENTS = [
  'free_tool_viewed',
  'free_tool_started',
  'free_tool_completed',
  'free_tool_result_viewed',
  'free_tool_result_engaged',
  'beta_cta_viewed',
  'beta_cta_clicked',
  'beta_signup_started',
  'beta_signup_completed',
  'beta_workspace_activated',
  'first_value_received',
  'beta_feature_used',
  'user_returned',
  'external_connection_activated',
] as const

export type ToolEvent = (typeof TOOL_EVENTS)[number]

export interface RecordEventArgs {
  event:       ToolEvent
  toolId?:     string | null
  runId?:      string | null
  visitorId?:  string | null
  userId?:     string | null
  workspaceId?: string | null
  props?:      Record<string, unknown>
}

/**
 * Never throws. An analytics write that takes down a report is a worse bug
 * than a missing row, and these fire on the happy path of a public endpoint.
 */
export async function recordEvent(args: RecordEventArgs): Promise<void> {
  try {
    const svc = await createServiceClient()
    await svc.from('tool_events').insert({
      event:        args.event,
      tool_id:      args.toolId ?? null,
      run_id:       args.runId ?? null,
      visitor_id:   args.visitorId?.slice(0, 64) ?? null,
      user_id:      args.userId ?? null,
      workspace_id: args.workspaceId ?? null,
      props:        args.props ?? {},
    })
  } catch (err) {
    console.error('[tool-events] could not record', args.event, err)
  }
}
