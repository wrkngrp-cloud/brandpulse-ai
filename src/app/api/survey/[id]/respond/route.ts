import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: { answers: Record<string, unknown>; started_at: number; source?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  const { data: survey } = await supabase
    .from('surveys')
    .select('id, status')
    .eq('id', id)
    .single()

  if (!survey) return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
  if (survey.status !== 'live') return NextResponse.json({ error: 'Survey is not active' }, { status: 403 })

  const elapsed = Date.now() - (Number(body.started_at) || 0)
  const quality_flag: 'ok' | 'low_effort' = elapsed < 5000 ? 'low_effort' : 'ok'

  const { error } = await supabase.from('survey_responses').insert({
    survey_id: id,
    answers: body.answers,
    source: body.source ?? 'link',
    language: 'english',
    quality_flag,
    respondent_profile: {},
  })

  if (error) return NextResponse.json({ error: 'Failed to save response' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
