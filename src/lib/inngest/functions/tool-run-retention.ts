import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Nightly retention sweep over anonymous tool runs.
 *
 * An unclaimed run is a stranger's scratch work: a website they typed into a
 * free tool and a report nobody came back for. Keeping those for ever is a
 * liability with no upside, so they go thirty days after they were made. A
 * claimed run belongs to a workspace and is never touched here.
 *
 * The deletion cascades to any campaign created by an unclaimed offline-tracker
 * run, with its placements and visits, which is correct: nobody claimed the
 * campaign, so nothing is in print that we would be breaking.
 */
export const toolRunRetention = inngest.createFunction(
  {
    id:       'tool-run-retention',
    name:     'Free tools: purge expired anonymous runs',
    triggers: [{ cron: 'TZ=Africa/Lagos 30 3 * * *' }],
    retries:  1,
  },
  async ({ step, logger }) => {
    const removed = await step.run('purge', async () => {
      const svc = await createServiceClient()
      const { data, error } = await svc.rpc('purge_expired_tool_runs')
      if (error) throw new Error(error.message)
      return (data as number | null) ?? 0
    })

    logger.info(`[tool-retention] removed ${removed} expired anonymous runs`)
    return { removed }
  },
)
