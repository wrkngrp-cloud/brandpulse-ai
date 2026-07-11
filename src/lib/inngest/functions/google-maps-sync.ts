import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'

interface PlaceDetailsResponse {
  result?: {
    rating?: number
    user_ratings_total?: number
    reviews?: { time: number; text?: string; rating?: number; author_name?: string }[]
  }
  status?: string
}

interface VenueBrand {
  id: string
  name: string
  google_place_id: string | null
  brand_type: string | null
}

// Pull rating + review_count + recent reviews for one place.
async function fetchPlaceDetails(placeId: string, apiKey: string): Promise<PlaceDetailsResponse['result'] | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
  url.searchParams.set('place_id', placeId)
  url.searchParams.set('fields', 'rating,user_ratings_total,reviews')
  url.searchParams.set('key', apiKey)

  const res = await fetch(url.toString())
  if (!res.ok) return null
  const data = (await res.json()) as PlaceDetailsResponse
  if (data.status && data.status !== 'OK') return null
  return data.result ?? null
}

export const googleMapsSync = inngest.createFunction(
  {
    id:      'google-maps-venue-sync',
    name:    'Google Maps Venue Reputation Sync (daily)',
    triggers: [
      { cron: 'TZ=Africa/Lagos 0 9 * * *' }, // daily 9am Lagos
      { event: 'brandgauge/venue.maps.sync' },
    ],
    retries: 2,
  },
  async ({ event, step, logger }) => {
    const API_KEY = process.env.GOOGLE_MAPS_API_KEY
    if (!API_KEY) {
      logger.info('No GOOGLE_MAPS_API_KEY set, skipping Google Maps venue sync')
      return { skipped: true, reason: 'No GOOGLE_MAPS_API_KEY' }
    }

    // ── Step 1: find venue brands with a google_place_id ──────────────────────
    const brands = await step.run('fetch-venue-brands', async (): Promise<VenueBrand[]> => {
      const sb = await createServiceClient()
      const eventData = event.data as { brand_id?: string } | undefined

      const query = sb
        .from('brands')
        .select('id, name, google_place_id, brand_type')
        .eq('brand_type', 'venue')
        .not('google_place_id', 'is', null)

      if (eventData?.brand_id) query.eq('id', eventData.brand_id)

      const { data, error } = await query
      if (error) throw new Error(`Failed to fetch venue brands: ${error.message}`)
      return (data ?? []) as VenueBrand[]
    })

    if (!brands.length) {
      logger.info('No venue brands with a google_place_id found, skipping')
      return { processed: 0 }
    }

    const today   = new Date().toISOString().split('T')[0]
    const weekAgo = Date.now() / 1000 - 7 * 86400
    let processed = 0

    for (const brand of brands) {
      const placeId = brand.google_place_id
      if (!placeId) continue

      const inserted = await step.run(`sync-${brand.id}`, async (): Promise<boolean> => {
        const sb = await createServiceClient()
        const result = await fetchPlaceDetails(placeId, API_KEY)
        if (result?.rating == null) {
          logger.info(`No rating returned for brand ${brand.id} (${placeId})`)
          return false
        }

        // Previous snapshot → velocity = net new reviews since last sync
        const { data: prev } = await sb
          .from('review_platform_snapshots')
          .select('review_count')
          .eq('brand_id', brand.id)
          .eq('platform', 'google_maps')
          .order('period_end', { ascending: false })
          .limit(1)
          .maybeSingle()

        const prevCount    = prev?.review_count ?? 0
        const currentCount = result.user_ratings_total ?? 0
        // Velocity: net new reviews vs the previous snapshot. For the first-ever
        // snapshot (no prior count) fall back to reviews timestamped in the last 7 days.
        const recentReviews = (result.reviews ?? []).filter(r => r.time > weekAgo).length
        const velocity = prevCount > 0 ? Math.max(0, currentCount - prevCount) : recentReviews

        const { error } = await sb.from('review_platform_snapshots').insert({
          brand_id:        brand.id,
          platform:        'google_maps',
          rating:          result.rating,
          review_count:    currentCount,
          review_velocity: velocity,
          period_end:      today,
          place_id:        placeId,
          metadata: {
            recent_reviews: (result.reviews ?? []).slice(0, 5).map(r => ({
              text:   r.text?.slice(0, 200),
              rating: r.rating,
              author: r.author_name,
              time:   r.time,
            })),
          },
        })
        if (error) throw new Error(`Insert failed for brand ${brand.id}: ${error.message}`)
        return true
      })

      if (inserted) processed++
    }

    logger.info(`Google Maps venue sync complete: ${processed}/${brands.length} brands`)
    return { processed }
  },
)
