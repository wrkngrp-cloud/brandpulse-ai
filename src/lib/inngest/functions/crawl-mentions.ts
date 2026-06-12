import { inngest } from '@/lib/inngest/client'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchTwitterMentions } from '@/lib/social/twitter'
import { classifySentiment } from '@/lib/ai/classify-sentiment'

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
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const today = new Date().toISOString().slice(0, 10)

    const manualRunId = (event.data as { runId?: string } | undefined)?.runId

    const { data: brands } = await supabase.from('brands').select('id, name')
    if (!brands?.length) {
      if (manualRunId) {
        await supabase.from('crawl_runs').update({
          status: 'error', error_message: 'No brands found', completed_at: new Date().toISOString(),
        }).eq('id', manualRunId)
      }
      return { processed: 0 }
    }

    // For cron triggers: create a new run row. For manual triggers: row already exists.
    let activeRunId = manualRunId
    if (!activeRunId) {
      const { data: run } = await supabase
        .from('crawl_runs')
        .insert({ brand_id: brands[0].id, trigger_type: 'cron', status: 'running' })
        .select('id')
        .single()
      activeRunId = run?.id ?? null
    }

    let totalMentionsFound = 0
    let totalClassified = 0

    for (const brand of brands) {
      await step.run(`crawl-x-${brand.id}`, async () => {
        const mentions = await fetchTwitterMentions(brand.name, since)
        if (!mentions.length) return

        const { data: existing } = await supabase
          .from('mentions')
          .select('external_id')
          .eq('brand_id', brand.id)
          .eq('platform', 'twitter')
          .in('external_id', mentions.map(m => m.id))

        const seenIds = new Set((existing ?? []).map(m => m.external_id))
        const fresh = mentions.filter(m => !seenIds.has(m.id))
        if (!fresh.length) return

        const rows = fresh.map(m => ({
          brand_id: brand.id,
          platform: 'twitter',
          external_id: m.id,
          content: m.content,
          author_handle: m.authorHandle,
          author_followers: m.authorFollowers,
          reach: m.reach,
          created_at: m.created_at,
        }))

        const { error } = await supabase.from('mentions').insert(rows)
        if (error) {
          logger.error(`Insert mentions failed for brand ${brand.id}: ${error.message}`)
        } else {
          totalMentionsFound += rows.length
        }
      })

      await step.run(`classify-${brand.id}`, async () => {
        const { data: unclassified } = await supabase
          .from('mentions')
          .select('id, content')
          .eq('brand_id', brand.id)
          .is('sentiment_label', null)
          .gte('created_at', since.toISOString())
          .limit(100)

        const items = (unclassified ?? [])
          .filter(m => m.content)
          .map(m => ({ id: m.id, text: m.content! }))

        if (!items.length) return

        try {
          const results = await classifySentiment(brand.id, items)
          for (const r of results) {
            await supabase
              .from('mentions')
              .update({
                sentiment_label: r.sentiment,
                sentiment_score: Math.round(r.confidence * 100),
                emotion_tags: [r.emotion],
              })
              .eq('id', r.id)
          }
          totalClassified += results.length
        } catch (err) {
          logger.error(`Classify step failed for brand ${brand.id}: ${String(err)}`)
        }
      })

      await step.run(`aggregate-${brand.id}`, async () => {
        const { data: classified } = await supabase
          .from('mentions')
          .select('sentiment_label, emotion_tags')
          .eq('brand_id', brand.id)
          .not('sentiment_label', 'is', null)
          .gte('created_at', `${today}T00:00:00.000Z`)

        if (!classified?.length) return

        const total        = classified.length
        const positiveCount = classified.filter(m => m.sentiment_label === 'positive').length
        const neutralCount  = classified.filter(m => m.sentiment_label === 'neutral').length
        const negativeCount = classified.filter(m => m.sentiment_label === 'negative').length
        const mixedCount    = classified.filter(m => m.sentiment_label === 'mixed').length

        const positive_pct = Number(((positiveCount / total) * 100).toFixed(2))
        const neutral_pct  = Number((((neutralCount + mixedCount) / total) * 100).toFixed(2))
        const negative_pct = Number(((negativeCount / total) * 100).toFixed(2))
        const social_score = Number(
          ((positiveCount * 100 + (neutralCount + mixedCount) * 50) / total).toFixed(2)
        )

        const emotionDistribution: Record<string, number> = {}
        for (const m of classified) {
          for (const emotion of (m.emotion_tags ?? [])) {
            emotionDistribution[emotion] = (emotionDistribution[emotion] ?? 0) + 1
          }
        }

        const { error } = await supabase.from('sentiment_daily').upsert(
          { brand_id: brand.id, day: today, social_score, blended_score: social_score, positive_pct, neutral_pct, negative_pct, emotion_distribution: emotionDistribution },
          { onConflict: 'brand_id,day' }
        )
        if (error) logger.error(`Aggregate sentiment failed for brand ${brand.id}: ${error.message}`)
        else logger.info(`Aggregated sentiment for brand ${brand.id}: total=${total}, score=${social_score}`)
      })
    }

    // Mark the run complete
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
