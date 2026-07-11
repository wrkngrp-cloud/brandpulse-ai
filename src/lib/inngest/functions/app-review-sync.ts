import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'

interface AppleEntry {
  id: { label: string }
  author: { name: { label: string } }
  'im:rating': { label: string }
  title: { label: string }
  content: { label: string }
  updated: { label: string }
  'im:name'?: { label: string }
}

interface AppleFeedResponse {
  feed?: {
    entry?: AppleEntry[]
  }
}

interface RawReview {
  review_id: string
  author: string
  rating: number
  title: string
  body: string
  reviewed_at: string
}

interface SentimentResult {
  review_id: string
  sentiment_label: 'positive' | 'neutral' | 'negative'
  sentiment_score: number
}

async function fetchAppleReviews(appleAppId: string): Promise<RawReview[]> {
  const url = `https://itunes.apple.com/rss/customerreviews/page=1/id=${appleAppId}/sortby=mostrecent/json`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return []

  const data = (await res.json()) as AppleFeedResponse
  const entries = data?.feed?.entry ?? []

  // entry[0] is app info, skip it
  const reviews = entries.slice(1, 21)

  return reviews.map((entry) => ({
    review_id:   entry.id.label,
    author:      entry.author.name.label,
    rating:      Number(entry['im:rating'].label),
    title:       entry.title.label,
    body:        entry.content.label,
    reviewed_at: entry.updated.label,
  }))
}

async function fetchPlayStoreRating(packageName: string): Promise<{ rating: number; count: number } | null> {
  try {
    const url = `https://play.google.com/store/apps/details?id=${packageName}&hl=en&gl=ng`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrandGauge/1.0)' },
    })
    if (!res.ok) return null
    const html = await res.text()

    const ratingMatch = html.match(/"starRating":\{"label":"([0-9.]+)"\}/) ||
                        html.match(/itemprop="ratingValue" content="([0-9.]+)"/)
    const countMatch  = html.match(/"reviews":"([0-9,]+)"/) ||
                        html.match(/itemprop="ratingCount" content="([0-9]+)"/)

    if (!ratingMatch) return null
    const rating = parseFloat(ratingMatch[1])
    const count  = countMatch ? parseInt(countMatch[1].replace(/,/g, ''), 10) : 0

    return { rating, count }
  } catch {
    return null
  }
}

async function runSentiment(reviews: RawReview[]): Promise<SentimentResult[]> {
  if (!reviews.length) return []

  const batch = reviews.slice(0, 15)
  const reviewsPayload = batch.map((r) => ({ review_id: r.review_id, text: r.body }))

  const raw = await callAi({
    tier: 'cultural',
    system:
      'You are a sentiment classifier. Respond with only a valid JSON array, no markdown, no explanation.',
    messages: [
      {
        role: 'user',
        content: `For each review, output a JSON array with objects: {review_id, sentiment_label: "positive"|"neutral"|"negative", sentiment_score: 0-100 (100=most positive)}.\nReviews:\n${JSON.stringify(reviewsPayload)}`,
      },
    ],
    maxTokens: 1000,
    temperature: 0.1,
  })

  try {
    // Strip markdown fences if present
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(cleaned) as SentimentResult[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const appReviewSync = inngest.createFunction(
  {
    id:      'app-review-sync',
    name:    'App Store Reviews Sync (weekly)',
    triggers: [
      { cron: 'TZ=Africa/Lagos 0 7 * * 0' },
      { event: 'brandgauge/app.reviews.sync' },
    ],
    retries: 2,
  },
  async ({ event, step, logger }) => {
    const supabase = await createServiceClient()

    // ── Step 1: fetch all app_store_configs ───────────────────────────────────
    const configs = await step.run('fetch-configs', async () => {
      const eventData = (event.data as { brand_id?: string } | undefined)
      let query = supabase
        .from('app_store_configs')
        .select('id, brand_id, apple_app_id, google_pkg_name')

      if (eventData?.brand_id) {
        query = query.eq('brand_id', eventData.brand_id)
      }

      const { data, error } = await query
      if (error) throw new Error(`Failed to fetch app_store_configs: ${error.message}`)
      return data ?? []
    })

    if (!configs.length) {
      logger.info('No app store configs found, skipping')
      return { processed: 0 }
    }

    let totalUpserted = 0

    for (const config of configs) {
      const { brand_id, apple_app_id, google_pkg_name } = config

      // ── Step 2a: fetch Apple reviews ────────────────────────────────────────
      const appleReviews = await step.run(`fetch-apple-${brand_id}`, async (): Promise<RawReview[]> => {
        if (!apple_app_id) return []
        logger.info(`Fetching Apple reviews for app ID ${apple_app_id}`)
        return fetchAppleReviews(apple_app_id)
      })

      // ── Step 2b: Google Play placeholder ────────────────────────────────────
      const googleReviews = await step.run(`fetch-google-${brand_id}`, async (): Promise<RawReview[]> => {
        if (!google_pkg_name) return []
        // Google Play has no free public reviews API.
        // The official API (androidpublisher.reviews.list) requires being the app
        // publisher with a service account. We return an empty array here and log
        // so the UI can surface the limitation without breaking the sync.
        logger.info(
          `Google Play reviews for ${google_pkg_name} require the official Google Play Developer API (service account). Skipping — 0 reviews collected.`
        )
        return []
      })

      type TaggedReview = RawReview & { source: 'apple' | 'google' }

      const allReviews: TaggedReview[] = [
        ...appleReviews.map((r): TaggedReview => ({ ...r, source: 'apple' })),
        ...googleReviews.map((r): TaggedReview => ({ ...r, source: 'google' })),
      ]

      if (!allReviews.length) {
        logger.info(`No reviews fetched for brand ${brand_id}`)
        continue
      }

      // ── Step 3: sentiment analysis ───────────────────────────────────────────
      const sentimentMap = await step.run(`sentiment-${brand_id}`, async () => {
        const results = await runSentiment(allReviews)
        const map: Record<string, SentimentResult> = {}
        for (const r of results) map[r.review_id] = r
        return map
      })

      // ── Step 4: upsert into app_reviews ─────────────────────────────────────
      const upserted = await step.run(`upsert-reviews-${brand_id}`, async () => {
        const svc = await createServiceClient()

        const rows = allReviews.map((r) => {
          const sentiment = sentimentMap[r.review_id] ?? null
          return {
            brand_id,
            source:          r.source,
            review_id:       r.review_id,
            author:          r.author,
            rating:          r.rating,
            title:           r.title,
            body:            r.body,
            sentiment_label: sentiment?.sentiment_label ?? null,
            sentiment_score: sentiment?.sentiment_score ?? null,
            reviewed_at:     r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null,
          }
        })

        const { error } = await svc
          .from('app_reviews')
          .upsert(rows, { onConflict: 'source,review_id' })

        if (error) throw new Error(`Upsert failed: ${error.message}`)
        return rows.length
      })

      totalUpserted += upserted

      // ── Step 5: compute avg rating → sdk_events ──────────────────────────────
      await step.run(`sdk-event-${brand_id}`, async () => {
        const svc = await createServiceClient()

        const { data: recent } = await svc
          .from('app_reviews')
          .select('rating')
          .eq('brand_id', brand_id)
          .order('reviewed_at', { ascending: false })
          .limit(30)

        if (!recent?.length) return

        const avgRating =
          recent.reduce((sum: number, row: { rating: number }) => sum + (row.rating ?? 0), 0) /
          recent.length

        // Scale 1-5 star rating to 0-100
        const value = Math.round(((avgRating - 1) / 4) * 100)

        await svc
          .from('sdk_events')
          .upsert(
            {
              brand_id,
              event_type:  'app_rating',
              value,
              metadata:    { avg_rating: avgRating, sample_size: recent.length },
              occurred_at: new Date().toISOString(),
            },
            { onConflict: 'brand_id,event_type' }
          )
      })

      // ── Step 6: write aggregate App Store snapshot → review_platform_snapshots ──
      await step.run(`review-snapshot-apple-${brand_id}`, async () => {
        if (!apple_app_id || !appleReviews.length) return
        const svc = await createServiceClient()
        const avgRating = appleReviews.reduce((s, r) => s + r.rating, 0) / appleReviews.length
        const today = new Date().toISOString().split('T')[0]

        const { data: prevSnap } = await svc
          .from('review_platform_snapshots')
          .select('review_count')
          .eq('brand_id', brand_id)
          .eq('platform', 'app_store')
          .order('period_end', { ascending: false })
          .limit(1)
          .maybeSingle()

        const velocity = Math.max(0, appleReviews.length - (prevSnap?.review_count ?? 0))

        await svc.from('review_platform_snapshots').insert({
          brand_id,
          platform:        'app_store',
          rating:          +avgRating.toFixed(2),
          review_count:    appleReviews.length,
          review_velocity: velocity,
          period_end:      today,
          metadata: {
            positive_pct: Math.round(appleReviews.filter(r => r.rating >= 4).length / appleReviews.length * 100),
            negative_pct: Math.round(appleReviews.filter(r => r.rating <= 2).length / appleReviews.length * 100),
          },
        })
      })

      // ── Step 7: scrape Play Store aggregate rating ───────────────────────────
      await step.run(`review-snapshot-play-${brand_id}`, async () => {
        if (!google_pkg_name) return
        const svc = await createServiceClient()
        const playData = await fetchPlayStoreRating(google_pkg_name)
        if (!playData) return

        const today = new Date().toISOString().split('T')[0]

        const { data: prevPlay } = await svc
          .from('review_platform_snapshots')
          .select('review_count')
          .eq('brand_id', brand_id)
          .eq('platform', 'play_store')
          .order('period_end', { ascending: false })
          .limit(1)
          .maybeSingle()

        await svc.from('review_platform_snapshots').insert({
          brand_id,
          platform:        'play_store',
          rating:          +playData.rating.toFixed(2),
          review_count:    playData.count,
          review_velocity: Math.max(0, playData.count - (prevPlay?.review_count ?? 0)),
          period_end:      today,
        })
      })

      logger.info(`Brand ${brand_id}: ${upserted} reviews upserted`)
    }

    return { processed: configs.length, totalUpserted }
  }
)
