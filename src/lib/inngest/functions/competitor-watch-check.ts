import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'
import { checkWatch, type WatchRow } from '@/lib/tools/competitor-watch'

/**
 * The weekly sweep over every enabled competitor watch.
 *
 * Monday morning Lagos time, which is when a marketing lead opens the week and
 * wants to know what moved. Each watch is its own step so one unreachable site
 * cannot lose the rest of the sweep, and the work is spread rather than fired
 * at twenty newsrooms at once.
 *
 * All of the care about what counts as new lives in checkWatch. This function
 * only decides who gets checked and writes the notification.
 */
export const competitorWatchCheck = inngest.createFunction(
  {
    id:       'competitor-watch-check',
    name:     'Competitor watchlist: weekly public-source check',
    triggers: [{ cron: 'TZ=Africa/Lagos 0 7 * * 1' }, { event: 'competitor/watch.check' }],
    retries:  1,
  },
  async ({ step, logger }) => {
    const watches = await step.run('load-watches', async () => {
      const svc = await createServiceClient()
      const { data } = await svc
        .from('competitor_watches')
        .select('id, brand_id, competitor_id, competitor_name, website_url, market, home_hash, pricing_hash')
        .eq('enabled', true)
      return (data ?? []) as WatchRow[]
    })

    if (!watches.length) return { checked: 0 }

    let newMoves = 0
    let siteChanges = 0

    for (const watch of watches) {
      const result = await step.run(`check-${watch.id}`, async () => {
        try {
          return await checkWatch(watch)
        } catch (err) {
          logger.error(`[competitor-watch] ${watch.competitor_name} failed`, err)
          return { watchId: watch.id, newMoves: 0, siteChanges: 0, alreadyKnown: 0, errors: [String(err)] }
        }
      })
      newMoves += result.newMoves
      siteChanges += result.siteChanges

      if (result.newMoves > 0 || result.siteChanges > 0) {
        await step.run(`notify-${watch.id}`, async () => {
          const svc = await createServiceClient()
          const parts = [
            result.newMoves ? `${result.newMoves} new ${result.newMoves === 1 ? 'story' : 'stories'}` : null,
            result.siteChanges ? `${result.siteChanges} site ${result.siteChanges === 1 ? 'change' : 'changes'}` : null,
          ].filter(Boolean).join(' and ')

          await svc.from('notifications').insert({
            brand_id: watch.brand_id,
            type:     'competitor_move',
            title:    `${watch.competitor_name}: ${parts}`,
            body:     `We found ${parts} for ${watch.competitor_name} since the last check. Open the watchlist to see the sources.`,
            href:     '/dashboard/competitive/watchlist',
          })
        })
      }
    }

    return { checked: watches.length, newMoves, siteChanges }
  },
)
