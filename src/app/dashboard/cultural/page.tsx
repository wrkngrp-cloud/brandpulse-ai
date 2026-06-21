import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CulturalClient } from './cultural-client'
import { getActiveBrandId } from '@/lib/active-brand'

export const dynamic = 'force-dynamic'

function avg(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function computeEmotionResonance(
  rows: Array<{ emotion_distribution: unknown }>,
): number | null {
  const POSITIVE_EMOTIONS = ['joy', 'trust', 'anticipation']
  let positiveTotal = 0
  let grandTotal = 0

  for (const row of rows) {
    const dist = row.emotion_distribution as Record<string, number> | null
    if (!dist || typeof dist !== 'object') continue
    const vals = Object.values(dist)
    const rowTotal = vals.reduce((a, b) => a + b, 0)
    if (!rowTotal) continue
    const rowPositive = POSITIVE_EMOTIONS.reduce((sum, key) => sum + (dist[key] ?? 0), 0)
    positiveTotal += rowPositive
    grandTotal += rowTotal
  }

  if (!grandTotal) return null
  return (positiveTotal / grandTotal) * 100
}

function computeDrift(
  analyses: Array<{ cultural_score: number; created_at: string }>,
  today: Date,
): number | null {
  const cutoff7 = new Date(today)
  cutoff7.setDate(cutoff7.getDate() - 7)

  const recent = analyses
    .filter(r => new Date(r.created_at) >= cutoff7)
    .map(r => r.cultural_score)

  const prior = analyses
    .filter(r => new Date(r.created_at) < cutoff7)
    .map(r => r.cultural_score)

  if (!recent.length || !prior.length) return null

  const avgRecent = avg(recent)!
  const avgPrior = avg(prior)!
  return avgRecent - avgPrior
}

export default async function CulturalPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const fourteenDaysAgo = new Date(today)
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  const brandId = await getActiveBrandId(supabase)
  const bid = brandId ?? ''

  const [
    { data: brandRow },
    { data: analyses },
    { data: sentimentRows },
  ] = await Promise.all([
    bid
      ? supabase.from('brands').select('id, name, category, cultural_profile, brand_values').eq('id', bid).maybeSingle()
      : supabase.from('brands').select('id, name, category, cultural_profile, brand_values').limit(1).maybeSingle(),
    supabase
      .from('pre_post_analyses')
      .select('id, content_text, platform, funnel_goal, cultural_score, tone_score, engagement_score, risk_score, created_at')
      .eq('brand_id', bid)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false }),
    supabase
      .from('sentiment_daily')
      .select('day, emotion_distribution, social_score')
      .eq('brand_id', bid)
      .gte('day', fourteenDaysAgo.toISOString().slice(0, 10))
      .order('day', { ascending: false }),
  ])

  type AnalysisRow = {
    id: string
    cultural_score: number
    created_at: string
    content_text: string | null
    platform: string | null
    funnel_goal: string | null
    tone_score: number | null
    engagement_score: number | null
    risk_score: number | null
  }

  const validAnalyses = (analyses ?? []).filter(
    r => typeof r.cultural_score === 'number',
  ) as AnalysisRow[]

  const crsScore = avg(validAnalyses.map(r => r.cultural_score))
  const drift = computeDrift(validAnalyses, today)
  const emotionResonance = computeEmotionResonance(sentimentRows ?? [])

  const brandValues: string[] = Array.isArray(
    (brandRow as { brand_values?: unknown } | null)?.brand_values,
  )
    ? ((brandRow as { brand_values: string[] }).brand_values as string[])
    : []

  return (
    <CulturalClient
      brandName={brandRow?.name ?? 'Your brand'}
      category={brandRow?.category ?? null}
      crsScore={crsScore !== null ? Math.round(crsScore * 10) / 10 : null}
      drift={drift !== null ? Math.round(drift * 10) / 10 : null}
      emotionResonance={
        emotionResonance !== null ? Math.round(emotionResonance * 10) / 10 : null
      }
      today={today.toISOString().slice(0, 10)}
      analysisCount={validAnalyses.length}
      brandValues={brandValues}
      analyses={validAnalyses}
    />
  )
}
