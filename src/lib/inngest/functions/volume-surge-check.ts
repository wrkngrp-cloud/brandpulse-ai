import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'
import { runVolumeSurgeCheck } from '@/lib/sentiment/volume-surge'

// Daily complaint-surge sweep across every brand. 8 AM Lagos so it runs after
// the 4 AM nightly mention crawl has populated yesterday's mentions.
export const volumeSurgeCheck = inngest.createFunction(
  {
    id:   'sentiment-volume-surge-check',
    name: 'Sentiment Volume Surge Check (daily 8 AM Lagos)',
    triggers: [{ cron: 'TZ=Africa/Lagos 0 8 * * *' }],
  },
  async ({ step, logger }) => {
    const supabase = await createServiceClient()

    const { data: brands } = await supabase.from('brands').select('id, name')
    if (!brands?.length) {
      logger.info('[volume-surge-check] No brands to evaluate')
      return { evaluated: 0, fired: 0 }
    }

    let fired = 0
    for (const brand of brands) {
      const result = await step.run(`check-${brand.id}`, () =>
        runVolumeSurgeCheck(supabase, brand as { id: string; name: string | null }),
      )
      if (result.alert_fired) fired++
    }

    return { evaluated: brands.length, fired }
  },
)
