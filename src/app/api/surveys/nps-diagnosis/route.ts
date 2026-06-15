import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'
import { z } from 'zod'

const bodySchema = z.object({
  npsScore:         z.number(),
  promoterCount:    z.number(),
  passiveCount:     z.number(),
  detractorCount:   z.number(),
  totalResponses:   z.number(),
  trendDirection:   z.enum(['rising', 'falling', 'stable', 'insufficient_data']),
  brandName:        z.string(),
  industry:         z.string().nullable(),
  // Optional: recent detractor verbatims (open text answers)
  detractorTexts:   z.array(z.string()).max(10).optional(),
  promoterTexts:    z.array(z.string()).max(10).optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const {
    npsScore, promoterCount, passiveCount, detractorCount, totalResponses,
    trendDirection, brandName, industry, detractorTexts, promoterTexts,
  } = parsed.data

  const npsLabel = npsScore >= 50 ? 'Excellent' : npsScore >= 30 ? 'Good' : npsScore >= 0 ? 'Needs improvement' : 'Critical'
  const trendNote =
    trendDirection === 'rising'   ? 'trending upward over the past weeks' :
    trendDirection === 'falling'  ? 'trending downward — requires attention' :
    trendDirection === 'stable'   ? 'stable with no significant movement' :
    'based on limited data'

  const detractorSection = detractorTexts?.length
    ? `\n\nSample detractor feedback:\n${detractorTexts.slice(0, 5).map(t => `- "${t}"`).join('\n')}`
    : ''

  const promoterSection = promoterTexts?.length
    ? `\n\nSample promoter feedback:\n${promoterTexts.slice(0, 5).map(t => `- "${t}"`).join('\n')}`
    : ''

  const systemPrompt = `You are a brand strategist specialising in ${industry ?? 'consumer'} brands in Nigeria and West Africa.
You interpret NPS data and give practical, actionable recommendations grounded in the African market context.
Your recommendations reference real channels: WhatsApp marketing, loyalty programmes, field events, community engagement, influencer amplification.
Respond with valid JSON only. No markdown. No preamble.`

  const userPrompt = `Brand: ${brandName}
Industry: ${industry ?? 'not specified'}

NPS data:
- NPS score: ${npsScore} (${npsLabel}, ${trendNote})
- Total responses: ${totalResponses}
- Promoters (9–10): ${promoterCount} (${Math.round(promoterCount / totalResponses * 100)}%)
- Passives (7–8): ${passiveCount} (${Math.round(passiveCount / totalResponses * 100)}%)
- Detractors (0–6): ${detractorCount} (${Math.round(detractorCount / totalResponses * 100)}%)${detractorSection}${promoterSection}

Tasks:
1. Diagnose what is driving the detractor segment — identify 2-3 likely root causes given the industry and Nigerian market context.
2. Identify the most likely promoter archetype — describe who these people are (demographic, behavioural, motivational) and how to activate them as brand advocates.
3. Give 3 specific, actionable recommendations to improve NPS within 90 days.

Return exactly this JSON shape:
{
  "detractorDiagnosis": "2-3 sentence diagnosis of what is likely causing detraction",
  "promoterArchetype": "2-3 sentence description of who your promoters likely are and what drives their loyalty",
  "recommendations": ["action 1", "action 2", "action 3"],
  "npsContext": "one sentence putting this NPS score in Nigerian market context (what is typical for this industry here)"
}`

  try {
    const text = await callAi({
      tier:        'structural',
      system:      systemPrompt,
      messages:    [{ role: 'user', content: userPrompt }],
      maxTokens:   900,
      temperature: 0.3,
    })
    const result = JSON.parse(text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim())
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Diagnosis failed — please try again.' }, { status: 500 })
  }
}
