import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'

type Sentiment = 'positive' | 'neutral' | 'negative'

interface AspectResult {
  aspect: string
  sentiment: Sentiment
  score: number
  mention_count: number
}

const VALID_ASPECTS = new Set([
  'food', 'service', 'ambiance', 'value', 'reliability',
  'feature_quality', 'support', 'price_fairness', 'music', 'cleanliness',
])

// Map a brand's stored brand_type to the prompt's brand-type vocabulary.
function promptBrandType(brandType: string | null): 'venue' | 'fintech' | 'saas' {
  if (brandType === 'venue') return 'venue'
  if (brandType === 'b2b_saas') return 'saas'
  return 'fintech'
}

interface RecentReview {
  text?: string
  rating?: number
  author?: string
  time?: number
}

async function classifyAspects(brandType: string, texts: string[]): Promise<AspectResult[]> {
  if (!texts.length) return []

  const systemPrompt = `You are a review aspect sentiment analyzer.
Given a list of review texts and the brand type, extract aspect-level sentiment.
Return ONLY valid JSON, no markdown, no explanation.`

  const userPrompt = `Brand type: ${brandType}
Reviews (${texts.length} reviews):
${JSON.stringify(texts.slice(0, 20))}

For each of the relevant aspects for this brand type, return a JSON array:
[
  { "aspect": "service", "sentiment": "positive", "score": 78, "mention_count": 12 },
  { "aspect": "food", "sentiment": "neutral", "score": 54, "mention_count": 8 }
]

For venue brands, focus on: food, service, ambiance, value, music, cleanliness
For fintech brands, focus on: reliability, feature_quality, support, value, price_fairness
For saas brands, focus on: feature_quality, support, value, reliability

Only return aspects that have at least 2 mentions. Score is 0-100 (100=most positive).`

  const raw = await callAi({
    tier: 'cultural',
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 1200,
    temperature: 0.1,
  })

  try {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(cleaned) as AspectResult[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (a) =>
          a &&
          VALID_ASPECTS.has(a.aspect) &&
          ['positive', 'neutral', 'negative'].includes(a.sentiment) &&
          typeof a.score === 'number' &&
          typeof a.mention_count === 'number' &&
          a.mention_count >= 2,
      )
      .map((a) => ({
        aspect: a.aspect,
        sentiment: a.sentiment,
        score: Math.max(0, Math.min(100, Math.round(a.score))),
        mention_count: Math.round(a.mention_count),
      }))
  } catch {
    return []
  }
}

export const reviewAspectClassifier = inngest.createFunction(
  {
    id: 'review-aspect-classifier',
    name: 'Review Aspect Sentiment Classifier (weekly)',
    triggers: [
      { cron: 'TZ=Africa/Lagos 0 23 * * 0' },
      { event: 'brandpulse/reviews.classify.aspects' },
    ],
    retries: 1,
  },
  async ({ event, step, logger }) => {
    const eventData = event.data as { brand_id?: string } | undefined
    const onlyBrandId = eventData?.brand_id ?? null

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const periodStart = thirtyDaysAgo.toISOString().split('T')[0]
    const periodEnd = new Date().toISOString().split('T')[0]

    // ── Step 1: gather review text per brand ──────────────────────────────────
    type BrandWork = {
      brand_id: string
      brand_type: string | null
      platform: 'google_maps' | 'app_store'
      texts: string[]
    }

    const work = await step.run('gather-review-text', async (): Promise<BrandWork[]> => {
      const sb = await createServiceClient()

      // brand_id → brand_type lookup
      const brandQuery = sb.from('brands').select('id, brand_type')
      if (onlyBrandId) brandQuery.eq('id', onlyBrandId)
      const { data: brandRows } = await brandQuery
      const brandTypeMap = new Map<string, string | null>(
        (brandRows ?? []).map((b) => [b.id, b.brand_type]),
      )

      const byBrand = new Map<string, BrandWork>()

      // ── Venues: latest google_maps snapshot per brand with recent_reviews ──
      const venueQuery = sb
        .from('review_platform_snapshots')
        .select('id, brand_id, metadata, period_end')
        .eq('platform', 'google_maps')
        .order('period_end', { ascending: false })
        .limit(100)
      const { data: venueSnaps } = await venueQuery

      const seenVenue = new Set<string>()
      for (const snap of venueSnaps ?? []) {
        if (onlyBrandId && snap.brand_id !== onlyBrandId) continue
        if (seenVenue.has(snap.brand_id)) continue // only most recent snapshot per brand
        const meta = snap.metadata as { recent_reviews?: RecentReview[] } | null
        const reviews = meta?.recent_reviews ?? []
        const texts = reviews
          .map((r) => r.text?.trim())
          .filter((t): t is string => Boolean(t && t.length > 3))
        seenVenue.add(snap.brand_id)
        if (!texts.length) continue
        byBrand.set(`${snap.brand_id}:google_maps`, {
          brand_id: snap.brand_id,
          brand_type: brandTypeMap.get(snap.brand_id) ?? null,
          platform: 'google_maps',
          texts,
        })
      }

      // ── Fintech / SaaS: recent app_reviews ──
      const appQuery = sb
        .from('app_reviews')
        .select('brand_id, body, rating, reviewed_at, source')
        .gte('reviewed_at', thirtyDaysAgo.toISOString())
        .order('reviewed_at', { ascending: false })
        .limit(200)
      const { data: appReviews } = await appQuery

      for (const r of appReviews ?? []) {
        if (onlyBrandId && r.brand_id !== onlyBrandId) continue
        const body = (r.body as string | null)?.trim()
        if (!body || body.length < 3) continue
        const key = `${r.brand_id}:app_store`
        const existing = byBrand.get(key)
        if (existing) {
          if (existing.texts.length < 50) existing.texts.push(body)
        } else {
          byBrand.set(key, {
            brand_id: r.brand_id,
            brand_type: brandTypeMap.get(r.brand_id) ?? null,
            platform: 'app_store',
            texts: [body],
          })
        }
      }

      return Array.from(byBrand.values()).filter((w) => w.texts.length > 0)
    })

    if (!work.length) {
      logger.info('No review text to classify, skipping')
      return { processed: 0 }
    }

    let totalAspects = 0

    // ── Step 2: classify + persist per brand/platform ────────────────────────
    for (const w of work) {
      const aspects = await step.run(
        `classify-${w.brand_id}-${w.platform}`,
        async (): Promise<AspectResult[]> => {
          return classifyAspects(promptBrandType(w.brand_type), w.texts)
        },
      )

      if (!aspects.length) {
        logger.info(`No aspects extracted for brand ${w.brand_id} (${w.platform})`)
        continue
      }

      await step.run(`persist-${w.brand_id}-${w.platform}`, async () => {
        const sb = await createServiceClient()

        // Idempotent for the same day: clear this period's rows before inserting.
        await sb
          .from('review_aspect_sentiment')
          .delete()
          .eq('brand_id', w.brand_id)
          .eq('platform', w.platform)
          .eq('period_end', periodEnd)

        const rows = aspects.map((a) => ({
          brand_id: w.brand_id,
          platform: w.platform,
          period_start: periodStart,
          period_end: periodEnd,
          aspect: a.aspect,
          sentiment: a.sentiment,
          score: a.score,
          mention_count: a.mention_count,
        }))

        const { error } = await sb.from('review_aspect_sentiment').insert(rows)
        if (error) throw new Error(`Insert failed for brand ${w.brand_id}: ${error.message}`)
        return rows.length
      })

      totalAspects += aspects.length
      logger.info(`Brand ${w.brand_id} (${w.platform}): ${aspects.length} aspects classified`)
    }

    return { processed: work.length, totalAspects }
  },
)
