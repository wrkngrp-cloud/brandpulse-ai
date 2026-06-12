import { createServiceClient } from '@/lib/supabase/server'
import { fetchTwitterMentions } from '@/lib/social/twitter'
import { classifySentiment } from '@/lib/ai/classify-sentiment'

export interface CrawlResult {
  mentionsFound: number
  classified: number
  error?: string
}

export async function runCrawl(brandId: string, runId?: string): Promise<CrawlResult> {
  const supabase = await createServiceClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const today = new Date().toISOString().slice(0, 10)

  const { data: brand } = await supabase
    .from('brands').select('id, name').eq('id', brandId).single()
  if (!brand) throw new Error('Brand not found')

  // ── 1. Fetch mentions ──────────────────────────────────────────────────────
  // fetchTwitterMentions throws on 402 (tier too low) or other API errors
  const mentions = await fetchTwitterMentions(brand.name, since)

  let mentionsFound = 0
  if (mentions.length) {
    const { data: existing } = await supabase
      .from('mentions').select('external_id')
      .eq('brand_id', brandId).eq('platform', 'twitter')
      .in('external_id', mentions.map(m => m.id))

    const seenIds = new Set((existing ?? []).map(m => m.external_id))
    const fresh = mentions.filter(m => !seenIds.has(m.id))

    if (fresh.length) {
      const rows = fresh.map(m => ({
        brand_id: brandId, platform: 'twitter',
        external_id: m.id, content: m.content,
        author_handle: m.authorHandle, author_followers: m.authorFollowers,
        reach: m.reach, created_at: m.created_at,
      }))
      const { error } = await supabase.from('mentions').insert(rows)
      if (!error) mentionsFound = rows.length
    }
  }

  // ── 2. Classify unclassified mentions ──────────────────────────────────────
  let classified = 0
  const { data: unclassified } = await supabase
    .from('mentions').select('id, content')
    .eq('brand_id', brandId).is('sentiment_label', null)
    .gte('created_at', since.toISOString()).limit(100)

  const items = (unclassified ?? [])
    .filter(m => m.content)
    .map(m => ({ id: m.id, text: m.content! }))

  if (items.length) {
    try {
      const results = await classifySentiment(brandId, items)
      for (const r of results) {
        await supabase.from('mentions').update({
          sentiment_label: r.sentiment,
          sentiment_score: Math.round(r.confidence * 100),
          emotion_tags: [r.emotion],
        }).eq('id', r.id)
      }
      classified = results.length
    } catch (err) {
      console.error('[runCrawl] classification failed:', err)
    }
  }

  // ── 3. Aggregate into sentiment_daily ─────────────────────────────────────
  const { data: scored } = await supabase
    .from('mentions').select('sentiment_label, emotion_tags')
    .eq('brand_id', brandId).not('sentiment_label', 'is', null)
    .gte('created_at', `${today}T00:00:00.000Z`)

  if (scored?.length) {
    const total        = scored.length
    const positiveCount = scored.filter(m => m.sentiment_label === 'positive').length
    const neutralCount  = scored.filter(m => m.sentiment_label === 'neutral').length
    const negativeCount = scored.filter(m => m.sentiment_label === 'negative').length
    const mixedCount    = scored.filter(m => m.sentiment_label === 'mixed').length

    const positive_pct = Number(((positiveCount / total) * 100).toFixed(2))
    const neutral_pct  = Number((((neutralCount + mixedCount) / total) * 100).toFixed(2))
    const negative_pct = Number(((negativeCount / total) * 100).toFixed(2))
    const social_score = Number(((positiveCount * 100 + (neutralCount + mixedCount) * 50) / total).toFixed(2))

    const emotionDistribution: Record<string, number> = {}
    for (const m of scored) {
      for (const e of (m.emotion_tags ?? [])) {
        emotionDistribution[e] = (emotionDistribution[e] ?? 0) + 1
      }
    }

    await supabase.from('sentiment_daily').upsert({
      brand_id: brandId, day: today,
      social_score, blended_score: social_score,
      positive_pct, neutral_pct, negative_pct,
      emotion_distribution: emotionDistribution,
    }, { onConflict: 'brand_id,day' })
  }

  // ── 4. Mark run complete ───────────────────────────────────────────────────
  if (runId) {
    await supabase.from('crawl_runs').update({
      status: 'done', mentions_found: mentionsFound,
      classified, completed_at: new Date().toISOString(),
    }).eq('id', runId)
  }

  return { mentionsFound, classified }
}
