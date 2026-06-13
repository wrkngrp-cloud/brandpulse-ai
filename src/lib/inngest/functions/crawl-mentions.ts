import { inngest } from '@/lib/inngest/client'
import { createServiceClient } from '@/lib/supabase/server'
import { runCrawl } from '@/lib/crawl/run-crawl'
import { computeBHI } from '@/lib/bhi'

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

      await step.run(`bhi-snapshot-${brand.id}`, async () => {
        const today = new Date().toISOString().slice(0, 10)
        const [{ data: sentRow }, { data: sovRow }, { data: surveyRows }] = await Promise.all([
          supabase.from('sentiment_daily')
            .select('social_score')
            .eq('brand_id', brand.id)
            .order('day', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from('sov_snapshots')
            .select('social_sov')
            .eq('brand_id', brand.id)
            .order('snapshot_date', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from('survey_responses')
            .select('answers')
            .eq('quality_flag', 'ok')
            .in('survey_id',
              (await supabase.from('surveys').select('id').eq('brand_id', brand.id)).data?.map(s => s.id) ?? []
            )
            .order('collected_at', { ascending: false })
            .limit(100),
        ])

        const npsScores = (surveyRows ?? [])
          .map(r => (r.answers as Record<string, unknown>)?.q2 as number | undefined)
          .filter((s): s is number => typeof s === 'number' && s >= 0 && s <= 10)
        const avgNps = npsScores.length
          ? npsScores.reduce((a, b) => a + b, 0) / npsScores.length
          : null

        const bhi = computeBHI({
          sentimentScore: sentRow?.social_score ?? null,
          sovScore:       sovRow?.social_sov ?? null,
          surveyScore:    avgNps !== null ? avgNps * 10 : null,
        })

        if (bhi.score !== null) {
          await supabase.from('brand_health_snapshots').upsert({
            brand_id:          brand.id,
            snapshot_date:     today,
            bhi:               bhi.score,
            data_coverage_pct: bhi.coverage,
            components: {
              sentiment: bhi.components.sentiment,
              sov:       bhi.components.sov,
              survey:    bhi.components.survey,
            },
          }, { onConflict: 'brand_id,snapshot_date' })
        }

        return { bhi: bhi.score, coverage: bhi.coverage }
      })
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
