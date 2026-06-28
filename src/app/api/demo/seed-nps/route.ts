/**
 * @deprecated This route is no longer needed for fresh demo environments.
 * Awareness check + post-purchase NPS survey responses are now seeded
 * automatically in sections 13c-13d of /api/admin/seed-demo (main seed route).
 *
 * This route remains available as a manual top-up for existing demo accounts
 * that were seeded before the main seed absorbed this logic. It is restricted
 * to demo@jarafoods.brandpulse.ai only.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// Realistic NPS distribution averaging ~7.8
// 8 promoters (9-10), 13 passives (7-8), 4 detractors (0-6)
const NPS_SCORES = [
  10, 9, 9, 9, 10, 9, 8, 7, 8, 9,
  8, 7, 8, 8, 7, 9, 10, 7, 8, 9,
  6, 8, 7, 9, 8,
]

// Awareness responses: 80% "Yes — I know them well", 20% "I have heard of them"
const AWARENESS_ANSWERS = Array.from({ length: 20 }, (_, i) =>
  i < 16 ? 'Yes — I know them well' : 'I have heard of them'
)

const DEMO_EMAIL = 'demo@jarafoods.brandpulse.ai'

export async function POST() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (user.email !== DEMO_EMAIL) {
    return NextResponse.json({ error: 'Not a demo account' }, { status: 403 })
  }

  // Get the brand
  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .limit(1)
    .single()

  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  let totalInserted = 0

  // ── 1. Awareness check survey ────────────────────────────────────────────────
  const { data: existingAwareness } = await supabase
    .from('surveys')
    .select('id')
    .eq('type', 'awareness_check')
    .eq('brand_id', brand.id)

  let awarenessSurveyId: string

  if (existingAwareness && existingAwareness.length > 0) {
    awarenessSurveyId = existingAwareness[0].id
  } else {
    const { data: newSurvey, error: surveyErr } = await supabase
      .from('surveys')
      .insert({
        brand_id: brand.id,
        type:     'awareness_check',
        name:     'Brand Awareness Check Q2 2025',
        status:   'active',
      })
      .select('id')
      .single()

    if (surveyErr || !newSurvey) {
      return NextResponse.json({ error: surveyErr?.message ?? 'Failed to create awareness survey' }, { status: 500 })
    }
    awarenessSurveyId = newSurvey.id
  }

  // Insert 20 awareness responses
  const awarenessResponses = AWARENESS_ANSWERS.map(answer => ({
    survey_id:    awarenessSurveyId,
    answers:      { q1: answer },
    quality_flag: 'ok',
  }))

  const { data: awInserted, error: awErr } = await supabase
    .from('survey_responses')
    .insert(awarenessResponses)
    .select('id')

  if (awErr) {
    return NextResponse.json({ error: awErr.message }, { status: 500 })
  }
  totalInserted += awInserted?.length ?? 0

  // ── 2. NPS survey ────────────────────────────────────────────────────────────
  const { data: existingNps } = await supabase
    .from('surveys')
    .select('id')
    .eq('type', 'post_purchase_nps')
    .eq('brand_id', brand.id)

  let npsSurveyId: string

  if (existingNps && existingNps.length > 0) {
    npsSurveyId = existingNps[0].id
  } else {
    const { data: newNps, error: npsErr } = await supabase
      .from('surveys')
      .insert({
        brand_id: brand.id,
        type:     'post_purchase_nps',
        name:     'Customer NPS Survey Q2 2025',
        status:   'active',
      })
      .select('id')
      .single()

    if (npsErr || !newNps) {
      return NextResponse.json({ error: npsErr?.message ?? 'Failed to create NPS survey' }, { status: 500 })
    }
    npsSurveyId = newNps.id
  }

  // Insert 25 NPS responses
  const npsResponses = NPS_SCORES.map(score => ({
    survey_id:    npsSurveyId,
    answers:      { q2: score },
    quality_flag: 'ok',
  }))

  const { data: npsInserted, error: npsInsertErr } = await supabase
    .from('survey_responses')
    .insert(npsResponses)
    .select('id')

  if (npsInsertErr) {
    return NextResponse.json({ error: npsInsertErr.message }, { status: 500 })
  }
  totalInserted += npsInserted?.length ?? 0

  return NextResponse.json({
    success:  true,
    inserted: totalInserted,
    surveys:  {
      awareness: awarenessSurveyId,
      nps:       npsSurveyId,
    },
  })
}
