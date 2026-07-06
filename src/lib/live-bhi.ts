import type { SupabaseClient } from '@supabase/supabase-js'
import { computeFullBHI, resolveBrandType, type FullBHIResult } from '@/lib/bhi'

const NGN_CPM_BENCHMARK = 500
const NGN_CPE_BENCHMARK = 50
const EMV_SCALE_MAX     = 10_000_000

// The single live, brand_type-aware BHI computation. Any page showing "the"
// current BHI number must call this rather than reading brand_health_snapshots.bhi
// directly or recomputing its own weights — that's what let Board Pack and
// Business Case silently drift from the Overview number (frozen snapshot row
// vs. an ad-hoc live calc, and the live calc itself was missing brand_type).
export async function computeLiveBHI(
  supabase: SupabaseClient,
  brandId: string,
  days = 30,
): Promise<FullBHIResult> {
  const cutoffISO = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: brand },
    { data: sentimentRow },
    { data: sovRow },
    { data: allSurveyResponses },
    { data: socialPosts },
    { data: awarenessCheckSurveys },
    { data: perceptionSurveys },
  ] = await Promise.all([
    supabase.from('brands').select('brand_type, industry').eq('id', brandId).single(),
    supabase.from('sentiment_daily').select('social_score, day').eq('brand_id', brandId).order('day', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('sov_snapshots').select('social_sov, snapshot_date').eq('brand_id', brandId).order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('survey_responses').select('answers, survey_id, quality_flag').eq('quality_flag', 'ok'),
    supabase.from('social_posts').select('impressions, reach, likes, comments, shares').eq('brand_id', brandId).gte('posted_at', cutoffISO),
    supabase.from('surveys').select('id').eq('brand_id', brandId).in('type', ['awareness_check', 'b2_intercept']),
    supabase.from('surveys').select('id').eq('brand_id', brandId).eq('type', 'perception_audit'),
  ]) as [
    { data: { brand_type: string | null; industry: string | null } | null },
    { data: { social_score: number; day: string } | null },
    { data: { social_sov: number; snapshot_date: string } | null },
    { data: { answers: Record<string, unknown>; survey_id: string; quality_flag: string }[] | null },
    { data: { impressions: number | null; reach: number | null; likes: number | null; comments: number | null; shares: number | null }[] | null },
    { data: { id: string }[] | null },
    { data: { id: string }[] | null },
  ]

  const sentimentScore = sentimentRow?.social_score ?? null
  const sovScore       = sovRow?.social_sov ?? null

  const awarenessIds = new Set((awarenessCheckSurveys ?? []).map(s => s.id))
  const awarenessResponses = (allSurveyResponses ?? []).filter(r => awarenessIds.has(r.survey_id))
  let salienceScore: number | null = null
  if (awarenessResponses.length >= 3) {
    const knownCount = awarenessResponses.filter(r => {
      const q1 = r.answers['q1']
      return typeof q1 === 'string' && q1.toLowerCase().startsWith('yes')
    }).length
    salienceScore = Math.round((knownCount / awarenessResponses.length) * 100)
  }

  const perceptionIds = new Set((perceptionSurveys ?? []).map(s => s.id))
  const perceptionResponses = (allSurveyResponses ?? []).filter(r => perceptionIds.has(r.survey_id))
  let perceptionScore: number | null = null
  if (perceptionResponses.length >= 2) {
    const vals: number[] = []
    for (const r of perceptionResponses) {
      for (const k of ['q2','q3','q4','q5','q6','q7','q8','q9']) {
        const v = r.answers[k]
        if (typeof v === 'number' && v >= 1 && v <= 5) vals.push((v / 5) * 100)
      }
    }
    if (vals.length > 0) perceptionScore = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
  }

  const posts = socialPosts ?? []
  let emvScore: number | null = null
  if (posts.length > 0) {
    const imp = posts.reduce((s, p) => s + (p.impressions ?? 0), 0)
    const rch = posts.reduce((s, p) => s + (p.reach ?? 0), 0)
    const eng = posts.reduce((s, p) => s + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0), 0)
    const emvRaw = ((imp + rch) * (NGN_CPM_BENCHMARK / 1000)) + (eng * NGN_CPE_BENCHMARK)
    emvScore = Math.min(Math.round((emvRaw / EMV_SCALE_MAX) * 100), 100)
  }

  const brandType = resolveBrandType(brand?.brand_type, brand?.industry)

  return computeFullBHI({
    awareness:         sovScore,
    salience:          salienceScore,
    sentiment:         sentimentScore,
    perception:        perceptionScore,
    culturalResonance: null,
    blendedSov:        sovScore,
    emv:               emvScore,
  }, undefined, brandType)
}
