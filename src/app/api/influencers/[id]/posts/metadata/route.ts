/**
 * GET /api/influencers/[id]/posts/metadata?url={postUrl}
 *
 * Fetches public metadata for a social post URL using platform oEmbed APIs.
 * Returns: author_name, caption, thumbnail_url, platform, post_type
 * Engagement metrics (views, likes, etc.) require authenticated platform APIs
 * and must be entered manually by the brand.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
  const res  = await fetch(endpoint, { headers: { 'User-Agent': 'BrandPulse/1.0' }, signal: AbortSignal.timeout(8000) })
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
  const res  = await fetch(endpoint, { headers: { 'User-Agent': 'BrandPulse/1.0' }, signal: AbortSignal.timeout(8000) })
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
  const res  = await fetch(endpoint, { headers: { 'User-Agent': 'BrandPulse/1.0' }, signal: AbortSignal.timeout(8000) })
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
  await params  // ensure dynamic route is resolved
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const postUrl = request.nextUrl.searchParams.get('url')
  if (!postUrl) return NextResponse.json({ error: 'url param required' }, { status: 400 })

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
    // Instagram & Facebook require OAuth token — return platform/type only
  } catch (e) {
    console.warn('[posts/metadata] oEmbed fetch error:', e)
    // Return what we know from URL analysis — don't fail the request
  }

  return NextResponse.json({
    ...result,
    note: platform === 'instagram' || platform === 'facebook'
      ? 'Caption and metrics for Instagram/Facebook posts must be entered manually (API requires connected account).'
      : platform === 'other'
      ? 'Unrecognised platform. Please enter metrics manually.'
      : null,
  })
}
