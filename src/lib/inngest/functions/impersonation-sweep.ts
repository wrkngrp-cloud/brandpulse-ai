import { inngest } from '@/lib/inngest/client'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Close any read-only session that outlived its window.
 *
 * Belt and braces rather than the guarantee. The guarantee is that
 * `active_impersonation` checks the clock, so a session past its expiry
 * answers as over whether or not this ever runs. What this does is take the
 * workspace_members row away, which is the access itself: without it a
 * stranded row would keep a staff member inside an account long after the
 * session read as finished.
 *
 * Every five minutes, because the sessions are thirty and a window of up to
 * five minutes of stranded membership is the cost of not running this every
 * minute.
 */
export const impersonationSweep = inngest.createFunction(
  {
    id:   'impersonation-sweep',
    name: 'Close expired impersonation sessions (every 5 minutes)',
    triggers: [{ cron: '*/5 * * * *' }],
  },
  async ({ step, logger }) => {
    const closed = await step.run('close-expired', async () => {
      const service = await createServiceClient()

      const { data: stale } = await service
        .from('impersonation_sessions')
        .select('id, staff_id, workspace_id, membership_granted')
        .in('status', ['approved', 'active'])
        .lt('expires_at', new Date().toISOString())
        .limit(200)

      if (!stale?.length) return 0

      for (const row of stale) {
        await service.rpc('end_impersonation', { p_session: row.id, p_ended_by: 'expiry' })
      }
      return stale.length
    })

    // A membership with no live session behind it should not exist. If one
    // does, something failed in a way worth seeing rather than cleaning up
    // silently, so it is logged as well as removed.
    const orphans = await step.run('remove-orphaned-viewers', async () => {
      const service = await createServiceClient()

      const { data: granted } = await service
        .from('impersonation_sessions')
        .select('id, staff_id, workspace_id')
        .eq('membership_granted', true)
        .not('ended_at', 'is', null)
        .limit(200)

      let removed = 0
      for (const row of granted ?? []) {
        await service.from('workspace_members')
          .delete()
          .eq('workspace_id', row.workspace_id)
          .eq('user_id', row.staff_id)
          .eq('role', 'viewer')
        await service.from('impersonation_sessions')
          .update({ membership_granted: false }).eq('id', row.id)
        removed += 1
      }
      return removed
    })

    if (closed || orphans) {
      logger.info(`impersonation-sweep: closed ${closed}, removed ${orphans} stranded memberships`)
    }

    return { closed, orphans }
  },
)
