/**
 * GET /api/influencers/[id]/posts/metadata?url={postUrl}
 *
 * Fetches what a post URL can tell us without the creator's permission:
 *   - descriptive metadata (author, caption, thumbnail) via platform oEmbed
 *   - public engagement counts via the connected platform APIs, where the
 *     platform exposes them for someone else's post
 *
 * Reach, impressions and saves are owner-only on every platform here, so they
 * are never returned. `owner_only` names them and `metric_sources` tags every
 * number we did pull, so the form can label provenance instead of implying the
 * whole row was measured.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { fetchPostMetrics } from '@/lib/social/post-metrics'

export const runtime = 'nodejs'

interface OembedResult {
  platform:       string
  post_type:      string | null
  author_name:    string | null
  caption:        string | null
  thumbnail_url:  string | null
  video_url:      string | null
}

function detectPlatform(url: string): string {
  if (url.includes('instagram.com'))                            return 'instagram'
  if (url.includes('tiktok.com'))                              return 'tiktok'
  if (url.includes('twitter.com') || url.includes('x.com'))   return 'twitter'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('facebook.com'))                            return 'facebook'
  return 'other'
}

function detectPostType(url: string, platform: string): string | null {
  if (platform === 'instagram') {
    if (url.includes('/reel/'))    return 'reel'
    if (url.includes('/p/'))       return 'feed'
    if (url.includes('/stories/')) return 'story'
    return 'feed'
  }
  if (platform === 'youtube')  return url.includes('/shorts/') ? 'short' : 'video'
  if (platform === 'tiktok')   return 'video'
  if (platform === 'twitter')  return 'tweet'
  return 'post'
}

async function fetchTikTokOembed(url: string): Promise<OembedResult> {
  const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
  const res  = await fetch(endpoint, { headers: { 'User-Agent': 'BrandGauge/1.0' }, signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error('TikTok oEmbed failed')
  const data = await res.json() as { title?: string; author_name?: string; thumbnail_url?: string; author_url?: string }
  return {
    platform:      'tiktok',
    post_type:     'video',
    author_name:   data.author_name ?? null,
    caption:       data.title       ?? null,
    thumbnail_url: data.thumbnail_url ?? null,
    video_url:     null,
  }
}

async function fetchYoutubeOembed(url: string): Promise<OembedResult> {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
  const res  = await fetch(endpoint, { headers: { 'User-Agent': 'BrandGauge/1.0' }, signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error('YouTube oEmbed failed')
  const data = await res.json() as { title?: string; author_name?: string; thumbnail_url?: string }
  const postType = url.includes('/shorts/') ? 'short' : 'video'
  return {
    platform:      'youtube',
    post_type:     postType,
    author_name:   data.author_name ?? null,
    caption:       data.title       ?? null,
    thumbnail_url: data.thumbnail_url ?? null,
    video_url:     null,
  }
}

async function fetchTwitterOembed(url: string): Promise<OembedResult> {
  const endpoint = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`
  const res  = await fetch(endpoint, { headers: { 'User-Agent': 'BrandGauge/1.0' }, signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error('Twitter oEmbed failed')
  const data = await res.json() as { author_name?: string; html?: string }
  // Extract text from HTML: strip tags, keep readable text
  const html   = data.html ?? ''
  const text   = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)
  return {
    platform:      'twitter',
    post_type:     'tweet',
    author_name:   data.author_name ?? null,
    caption:       text || null,
    thumbnail_url: null,
    video_url:     null,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const postUrl = request.nextUrl.searchParams.get('url')
  if (!postUrl) return NextResponse.json({ error: 'url param required' }, { status: 400 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand' }, { status: 404 })

  const platform = detectPlatform(postUrl)
  const postType = detectPostType(postUrl, platform)

  let result: OembedResult = {
    platform,
    post_type:     postType,
    author_name:   null,
    caption:       null,
    thumbnail_url: null,
    video_url:     null,
  }

  try {
    if (platform === 'tiktok')  result = await fetchTikTokOembed(postUrl)
    if (platform === 'youtube') result = await fetchYoutubeOembed(postUrl)
    if (platform === 'twitter') result = await fetchTwitterOembed(postUrl)
    // Instagram & Facebook have no open oEmbed — metrics below still work
  } catch (e) {
    console.warn('[posts/metadata] oEmbed fetch error:', e)
    // Return what we know from URL analysis — don't fail the request
  }

  // The influencer's handle is what Instagram needs to look a post up.
  // RLS scopes this read, and it is re-checked against the active brand.
  const { data: influencer } = await supabase
    .from('influencers')
    .select('handle')
    .eq('id', id)
    .eq('brand_id', brandId)
    .maybeSingle()

  const metrics = await fetchPostMetrics({
    supabase,
    brandId,
    platform,
    postUrl,
    influencerHandle: influencer?.handle ?? null,
  }).catch(e => {
    console.warn('[posts/metadata] metric fetch error:', e)
    return null
  })

  return NextResponse.json({
    ...result,
    metrics:        metrics?.metrics  ?? {},
    metric_sources: metrics?.sources  ?? {},
    owner_only:     metrics?.ownerOnly ?? [],
    metrics_note:   metrics?.note     ?? null,
    note: platform === 'other'
      ? 'Unrecognised platform. Please enter metrics manually.'
      : null,
  })
}
