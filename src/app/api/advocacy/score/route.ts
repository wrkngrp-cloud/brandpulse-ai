import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function weekStart(d: Date): string {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(d)
  mon.setDate(diff)
  return mon.toISOString().slice(0, 10)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string; name: string }>(supabase, 'id, name')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  // Last 12 weeks of advocacy scores
  const { data: scores } = await supabase
    .from('advocacy_scores')
    .select('*')
    .eq('brand_id', brand.id)
    .order('week_start', { ascending: false })
    .limit(12)

  // Compute current week's score on-the-fly from social_posts
  const since30 = new Date(Date.now() - 30 * 24 * 3600_000).toISOString().slice(0, 10)
  const { data: posts } = await supabase
    .from('social_posts')
    .select('sentiment_label, sentiment_score, reach, likes, comments, shares, platform, posted_at')
    .eq('brand_id', brand.id)
    .gte('posted_at', `${since30}T00:00:00.000Z`)

  const totalPosts    = posts?.length ?? 0
  const positive      = posts?.filter(p => p.sentiment_label === 'positive').length ?? 0
  const neutral       = posts?.filter(p => p.sentiment_label === 'neutral').length  ?? 0
  const negative      = posts?.filter(p => p.sentiment_label === 'negative').length ?? 0
  const totalReach    = posts?.reduce((s, p) => s + (p.reach ?? 0), 0) ?? 0
  const totalEngmt    = posts?.reduce((s, p) => s + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0), 0) ?? 0

  const sentimentAvg  = totalPosts > 0
    ? posts!.reduce((s, p) => s + (p.sentiment_score ?? 0), 0) / totalPosts
    : null

  // Platform breakdown
  const platforms: Record<string, number> = {}
  for (const p of posts ?? []) {
    if (p.platform) platforms[p.platform] = (platforms[p.platform] ?? 0) + 1
  }

  // Advocacy score: 40% sentiment ratio, 40% volume/reach, 20% engagement
  const sentimentRatio = totalPosts > 0 ? positive / totalPosts : 0
  const volumeScore    = Math.min(100, (totalPosts / 50) * 100) // normalise: 50 posts/week = 100
  const reachScore     = Math.min(100, (totalReach / 100_000) * 100)
  const engmtScore     = Math.min(100, (totalEngmt / 10_000) * 100)

  const advocacyScore  = totalPosts === 0 ? 0 :
    (sentimentRatio * 40) + ((volumeScore * 0.5 + reachScore * 0.5) * 0.4) + (engmtScore * 0.2)

  const currentWeek = weekStart(new Date())
  const priorScore  = scores?.[0]?.advocacy_score ?? null
  const scoreDelta  = priorScore != null ? advocacyScore - priorScore : null

  return NextResponse.json({
    brand_id:          brand.id,
    current_week:      currentWeek,
    advocacy_score:    Math.round(advocacyScore * 10) / 10,
    score_delta:       scoreDelta != null ? Math.round(scoreDelta * 10) / 10 : null,
    ugc_mentions:      totalPosts,
    positive_mentions: positive,
    neutral_mentions:  neutral,
    negative_mentions: negative,
    avg_sentiment:     sentimentAvg != null ? Math.round(sentimentAvg * 10) / 10 : null,
    total_reach:       totalReach,
    total_engagement:  totalEngmt,
    top_platforms:     platforms,
    weekly_history:    (scores ?? []).reverse(),
  })
}

// POST: persist computed score for current week
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  // Delegate to GET to compute then persist
  const since7 = new Date(Date.now() - 7 * 24 * 3600_000).toISOString().slice(0, 10)
  const { data: posts } = await supabase
    .from('social_posts')
    .select('sentiment_label, sentiment_score, reach, likes, comments, shares, platform')
    .eq('brand_id', brand.id)
    .gte('posted_at', `${since7}T00:00:00.000Z`)

  const totalPosts    = posts?.length ?? 0
  const positive      = posts?.filter(p => p.sentiment_label === 'positive').length ?? 0
  const neutral       = posts?.filter(p => p.sentiment_label === 'neutral').length  ?? 0
  const negative      = posts?.filter(p => p.sentiment_label === 'negative').length ?? 0
  const totalReach    = posts?.reduce((s, p) => s + (p.reach ?? 0), 0) ?? 0
  const totalEngmt    = posts?.reduce((s, p) => s + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0), 0) ?? 0
  const sentimentAvg  = totalPosts > 0
    ? posts!.reduce((s, p) => s + (p.sentiment_score ?? 0), 0) / totalPosts
    : null
  const platforms: Record<string, number> = {}
  for (const p of posts ?? []) {
    if (p.platform) platforms[p.platform] = (platforms[p.platform] ?? 0) + 1
  }
  const sentimentRatio = totalPosts > 0 ? positive / totalPosts : 0
  const volumeScore    = Math.min(100, (totalPosts / 50) * 100)
  const reachScore     = Math.min(100, (totalReach / 100_000) * 100)
  const engmtScore     = Math.min(100, (totalEngmt / 10_000) * 100)
  const advocacyScore  = totalPosts === 0 ? 0 :
    (sentimentRatio * 40) + ((volumeScore * 0.5 + reachScore * 0.5) * 0.4) + (engmtScore * 0.2)

  const currentWeek = weekStart(new Date())
  const { data: prior } = await supabase
    .from('advocacy_scores')
    .select('advocacy_score')
    .eq('brand_id', brand.id)
    .lt('week_start', currentWeek)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  const scoreDelta = prior?.advocacy_score != null ? advocacyScore - Number(prior.advocacy_score) : null

  const { error } = await supabase
    .from('advocacy_scores')
    .upsert({
      brand_id:          brand.id,
      week_start:        currentWeek,
      ugc_mentions:      totalPosts,
      positive_mentions: positive,
      neutral_mentions:  neutral,
      negative_mentions: negative,
      avg_sentiment:     sentimentAvg,
      total_reach:       totalReach,
      total_engagement:  totalEngmt,
      top_platforms:     platforms,
      advocacy_score:    Math.round(advocacyScore * 10) / 10,
      score_delta:       scoreDelta != null ? Math.round(scoreDelta * 10) / 10 : null,
      score_factors:     { sentiment: sentimentRatio * 40, volume: (volumeScore * 0.5 + reachScore * 0.5) * 0.4, engagement: engmtScore * 0.2 },
    }, { onConflict: 'brand_id,week_start' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, advocacy_score: Math.round(advocacyScore * 10) / 10 })
}
