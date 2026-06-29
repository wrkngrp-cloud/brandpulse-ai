import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'

interface PlaceDetailsResponse {
  result?: {
    rating?: number
    user_ratings_total?: number
    reviews?: { time: number; text?: string; rating?: number; author_name?: string }[]
  }
  status?: string
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string; name: string; google_place_id: string | null }>(
    supabase,
    'id, name, google_place_id',
  )

  if (!brand?.google_place_id) {
    return NextResponse.json(
      { error: 'No Google Place ID configured. Add it in Brand Settings.' },
      { status: 400 },
    )
  }

  const API_KEY = process.env.GOOGLE_MAPS_API_KEY
  if (!API_KEY) return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 })

  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
  url.searchParams.set('place_id', brand.google_place_id)
  url.searchParams.set('fields', 'rating,user_ratings_total,reviews')
  url.searchParams.set('key', API_KEY)

  const res = await fetch(url.toString())
  const data = (await res.json()) as PlaceDetailsResponse

  if (data.result?.rating == null) {
    return NextResponse.json({ error: 'Place not found or no ratings yet.' }, { status: 404 })
  }

  const today   = new Date().toISOString().split('T')[0]
  const weekAgo = Date.now() / 1000 - 7 * 86400
  const reviews = data.result.reviews ?? []
  const currentCount = data.result.user_ratings_total ?? 0

  // Velocity vs the previous snapshot; first snapshot falls back to last-7-day review count.
  const { data: prev } = await supabase
    .from('review_platform_snapshots')
    .select('review_count')
    .eq('brand_id', brand.id)
    .eq('platform', 'google_maps')
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle()

  const prevCount = prev?.review_count ?? 0
  const recentReviews = reviews.filter(r => r.time > weekAgo).length
  const velocity = prevCount > 0 ? Math.max(0, currentCount - prevCount) : recentReviews

  const { error } = await supabase.from('review_platform_snapshots').insert({
    brand_id:        brand.id,
    platform:        'google_maps',
    rating:          data.result.rating,
    review_count:    currentCount,
    review_velocity: velocity,
    period_end:      today,
    place_id:        brand.google_place_id,
    metadata: {
      recent_reviews: reviews.slice(0, 5).map(r => ({
        text:   r.text?.slice(0, 200),
        rating: r.rating,
        author: r.author_name,
        time:   r.time,
      })),
    },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, rating: data.result.rating, reviewCount: currentCount })
}
