import { NextRequest, NextResponse } from 'next/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'
import { buildBrandContext, formatBrandContextBlock } from '@/lib/ai/brand-context'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { surveyId } = await req.json() as { surveyId: string }
  if (!surveyId) return NextResponse.json({ error: 'surveyId required' }, { status: 400 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand' }, { status: 404 })
  const brand = { id: brandId }

  const service = await createServiceClient()

  const [{ data: survey }, { data: responses }, brandCtx] = await Promise.all([
    // Scope the survey to the active brand — without this, any authenticated user
    // could read another tenant's survey questions and responses by guessing an id.
    service.from('surveys').select('name, questions').eq('id', surveyId).eq('brand_id', brand.id).single(),
    service.from('survey_responses')
      .select('answers, quality_flag, collected_at')
      .eq('survey_id', surveyId)
      .order('collected_at', { ascending: false }),
    buildBrandContext(brand.id),
  ])

  if (!survey) return NextResponse.json({ error: 'Survey not found' }, { status: 404 })

  const okResponses = (responses ?? []).filter(r => r.quality_flag === 'ok')
  if (okResponses.length === 0) {
    return NextResponse.json({ error: 'No quality responses to analyse yet' }, { status: 400 })
  }

  // Compute NPS breakdown
  const npsScores = okResponses
    .map(r => (r.answers as Record<string, unknown>)?.q2 as number | undefined)
    .filter((s): s is number => typeof s === 'number')

  const promoters  = npsScores.filter(s => s >= 9).length
  const passives   = npsScores.filter(s => s >= 7 && s <= 8).length
  const detractors = npsScores.filter(s => s <= 6).length
  const avgNps     = npsScores.length ? (npsScores.reduce((a, b) => a + b, 0) / npsScores.length).toFixed(1) : null
  const npsGap     = npsScores.length ? (((promoters - detractors) / npsScores.length) * 100).toFixed(0) : null

  // Awareness source breakdown
  const sourceCounts: Record<string, number> = {}
  okResponses.forEach(r => {
    const q1 = (r.answers as Record<string, unknown>)?.q1 as string | undefined
    if (q1) sourceCounts[q1] = (sourceCounts[q1] ?? 0) + 1
  })
  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([src, count]) => `${src}: ${count} (${Math.round((count / okResponses.length) * 100)}%)`)
    .join('\n')

  const dataBlock = `
Survey: "${survey.name}"
Total responses: ${responses?.length ?? 0} (${okResponses.length} quality)
NPS scores available: ${npsScores.length}
Average NPS: ${avgNps ?? '—'} / 10
Promoters (9-10): ${promoters} (${Math.round((promoters / npsScores.length) * 100)}%)
Passives (7-8): ${passives} (${Math.round((passives / npsScores.length) * 100)}%)
Detractors (0-6): ${detractors} (${Math.round((detractors / npsScores.length) * 100)}%)
Net Promoter Score: ${npsGap ? npsGap + ' pts' : '—'}
How people heard about ${brandCtx.brandName}:
${topSources || 'No awareness source data'}
`.trim()

  const systemPrompt = `You are BrandGauge, a brand intelligence assistant specialising in Nigerian and West African consumer markets. You analyse survey data and produce plain-English insights for marketing teams.

${formatBrandContextBlock(brandCtx)}

You MUST return ONLY valid JSON in this exact shape — no markdown fences, no preamble:
{
  "headline": "string — one punchy sentence summarising the key finding",
  "nps_interpretation": "string — what this NPS score means for the brand (2-3 sentences, plain English)",
  "promoter_insight": "string — what's driving the high scorers and how to leverage them",
  "detractor_risk": "string — what's driving low scores and what to fix first",
  "awareness_insight": "string — which channels are working and any gaps or surprises",
  "recommendations": ["string", "string", "string"],
  "confidence": "High" | "Medium" | "Low"
}`

  const userMessage = `Analyse this survey data and generate actionable brand intelligence:\n\n${dataBlock}`

  try {
    const raw = await callAi({
      tier: 'structural',
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 1200,
    })
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    const result = JSON.parse(cleaned)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[survey-analysis] error:', err)
    return NextResponse.json({ error: 'Analysis failed. Try again.' }, { status: 500 })
  }
}
