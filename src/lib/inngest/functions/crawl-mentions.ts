import { inngest } from '@/lib/inngest/client'
import { createServiceClient } from '@/lib/supabase/server'
import { runCrawl } from '@/lib/crawl/run-crawl'

export const crawlMentions = inngest.createFunction(
  {
    id: 'crawl-mentions',
    name: 'Crawl X mentions and score sentiment (nightly)',
    triggers: [
      { cron: 'TZ=Africa/Lagos 0 4 * * *' },
      { event: 'brandpulse/crawl.requested' },
    ],
  },
  async ({ event, step, logger }) => {
    const supabase = await createServiceClient()
    const manualRunId = (event.data as { runId?: string } | undefined)?.runId

    const { data: brands } = await supabase.from('brands').select('id, name')
    if (!brands?.length) {
      if (manualRunId) {
        await supabase.from('crawl_runs').update({
          status: 'error', error_message: 'No brands found',
          completed_at: new Date().toISOString(),
        }).eq('id', manualRunId)
      }
      return { processed: 0 }
    }

    let activeRunId = manualRunId
    if (!activeRunId) {
      const { data: run } = await supabase
        .from('crawl_runs')
        .insert({ brand_id: brands[0].id, trigger_type: 'cron', status: 'running' })
        .select('id').single()
      activeRunId = run?.id ?? undefined
    }

    let totalMentionsFound = 0
    let totalClassified    = 0

    for (const brand of brands) {
      const result = await step.run(`crawl-brand-${brand.id}`, async () => {
        return runCrawl(brand.id)
      })
      totalMentionsFound += result.mentionsFound
      totalClassified    += result.classified
      logger.info(`Brand ${brand.name}: ${result.mentionsFound} mentions, ${result.classified} classified`)
    }

    if (activeRunId) {
      await supabase.from('crawl_runs').update({
        status: 'done',
        mentions_found: totalMentionsFound,
        classified: totalClassified,
        completed_at: new Date().toISOString(),
      }).eq('id', activeRunId)
    }

    return { processed: brands.length, mentionsFound: totalMentionsFound, classified: totalClassified }
  }
)
