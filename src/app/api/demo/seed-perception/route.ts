import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// Base perception scores for a quality-forward brand (q2–q9 on 1–5 scale)
const BASE_SCORES: Record<string, number> = {
  q2: 4.0,  // Quality
  q3: 4.5,  // Trust
  q4: 3.5,  // Innovation
  q5: 3.0,  // Value
  q6: 4.0,  // Cultural Relevance
  q7: 4.0,  // Accessibility
  q8: 4.5,  // Reliability
  q9: 3.5,  // Emotional Connection
}

function clamp(val: number, min = 1, max = 5): number {
  return Math.min(max, Math.max(min, val))
}

function varyScore(base: number): number {
  const variance = (Math.random() - 0.5) * 1.0  // ±0.5
  return Math.round(clamp(base + variance) * 2) / 2  // round to nearest 0.5
}

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

  // Check if a perception audit survey already exists
  const { data: existingSurveys } = await supabase
    .from('surveys')
    .select('id')
    .eq('type', 'perception_audit')
    .eq('brand_id', brand.id)

  let surveyId: string

  if (existingSurveys && existingSurveys.length > 0) {
    surveyId = existingSurveys[0].id
  } else {
    // Insert a new perception audit survey
    const { data: newSurvey, error: surveyErr } = await supabase
      .from('surveys')
      .insert({
        brand_id: brand.id,
        type:     'perception_audit',
        name:     'Brand Perception Audit Q2 2025',
        status:   'active',
      })
      .select('id')
      .single()

    if (surveyErr || !newSurvey) {
      return NextResponse.json({ error: surveyErr?.message ?? 'Failed to create survey' }, { status: 500 })
    }
    surveyId = newSurvey.id
  }

  // Insert 15 survey responses with realistic varied answers
  const responses = Array.from({ length: 15 }, () => {
    const answers: Record<string, number> = {
      q1: clamp(Math.round(3 + Math.random() * 2)),  // familiarity 3-5
    }
    for (const [key, base] of Object.entries(BASE_SCORES)) {
      answers[key] = varyScore(base)
    }
    return {
      survey_id:    surveyId,
      answers,
      quality_flag: 'ok',
    }
  })

  const { data: inserted, error: insertErr } = await supabase
    .from('survey_responses')
    .insert(responses)
    .select('id')

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({
    success:  true,
    inserted: inserted?.length ?? 0,
    surveyId,
  })
}
