/**
 * GET /api/influencer-campaigns/post-metrics?url={postUrl}&platform={platform}&handle={creatorHandle}
 *
 * The ROI Tracker logs a campaign against a free-text creator handle, not an
 * `influencers` row, so it has no `influencer_id` to hang a lookup off. This
 * calls the same `fetchPostMetrics` the per-influencer post tracker uses, with
 * platform and handle taken straight from the campaign form instead of looked
 * up from a database row.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { fetchPostMetrics } from '@/lib/social/post-metrics'

export const runtime = 'nodejs'

const VALID_PLATFORMS = ['instagram', 'tiktok', 'twitter', 'youtube', 'facebook']

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const postUrl  = request.nextUrl.searchParams.get('url')
  const platform = request.nextUrl.searchParams.get('platform')
  const handle   = request.nextUrl.searchParams.get('handle')
  if (!postUrl)  return NextResponse.json({ error: 'url param required' }, { status: 400 })
  if (!platform || !VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: 'valid platform param required' }, { status: 400 })
  }

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand' }, { status: 404 })

  const result = await fetchPostMetrics({
    supabase,
    brandId,
    platform,
    postUrl,
    influencerHandle: handle,
  }).catch(e => {
    console.warn('[influencer-campaigns/post-metrics] fetch error:', e)
    return null
  })

  return NextResponse.json({
    metrics:        result?.metrics   ?? {},
    metric_sources: result?.sources   ?? {},
    owner_only:     result?.ownerOnly ?? [],
    metrics_note:   result?.note      ?? null,
  })
}
