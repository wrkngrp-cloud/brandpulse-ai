import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'
import { z } from 'zod'

const stageSchema = z.object({
  score:      z.number().nullable(),
  source:     z.string(),
  dataPoints: z.number(),
})

const bodySchema = z.object({
  scores: z.object({
    awareness:     stageSchema,
    consideration: stageSchema,
    preference:    stageSchema,
    action:        stageSchema,
    loyalty:       stageSchema,
    advocacy:      stageSchema,
  }),
  brandName: z.string(),
  industry:  z.string().nullable(),
})

const STAGE_ORDER = [
  'awareness', 'consideration', 'preference', 'action', 'loyalty', 'advocacy',
] as const

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { scores, brandName, industry } = parsed.data

  const stageValues = STAGE_ORDER.map(k => ({ name: k, score: scores[k].score }))

  // Compute drop-offs between adjacent stages
  const dropOffs = stageValues.slice(0, -1).map((s, i) => {
    const next = stageValues[i + 1]
    if (s.score == null || next.score == null || s.score === 0) return null
    return {
      from: s.name,
      to:   next.name,
      pct:  Math.round(((s.score - next.score) / s.score) * 100),
    }
  })

  const biggestDrop = dropOffs
    .filter((d): d is NonNullable<typeof dropOffs[number]> => d != null)
    .reduce<NonNullable<typeof dropOffs[number]> | null>(
      (max, d) => (max == null || d.pct > max.pct ? d : max),
      null
    )

  const scoresText = STAGE_ORDER.map(k =>
    `${k}: ${scores[k].score ?? 'no data'}/100 (${scores[k].source})`
  ).join('\n')

  const dropText = dropOffs
    .filter((d): d is NonNullable<typeof dropOffs[number]> => d != null)
    .map(d => `${d.from} → ${d.to}: ${d.pct}% drop`)
    .join('\n')

  const systemPrompt = `You are a brand strategist specialising in ${industry ?? 'consumer'} brands in Nigeria and West Africa.
You diagnose brand funnel gaps and give practical, budget-conscious recommendations relevant to the African market.
Reference channels like WhatsApp marketing, radio activations, influencer partnerships, street-level events, and OOH where appropriate.
Respond with valid JSON only. No markdown. No preamble.`

  const userPrompt = `Brand: ${brandName}
Industry: ${industry ?? 'not specified'}

Funnel scores (0-100, higher is better):
${scoresText}

Stage drop-offs:
${dropText || 'Insufficient data for drop-off calculation'}

Biggest gap: ${biggestDrop
    ? `${biggestDrop.from} to ${biggestDrop.to} (${biggestDrop.pct}% drop)`
    : 'insufficient data — diagnose lowest scoring stage instead'}

Diagnose the most critical funnel gap. Be specific to the Nigerian/West African market context.
Return exactly this JSON shape:
{
  "biggestGap": "stageName",
  "diagnosis": "2–3 sentence diagnosis explaining why this gap likely exists and what it costs the brand commercially",
  "recommendations": ["specific action 1", "specific action 2", "specific action 3"]
}`

  try {
    const text = await callAi({
      tier:        'structural',
      system:      systemPrompt,
      messages:    [{ role: 'user', content: userPrompt }],
      maxTokens:   900,
      temperature: 0.3,
    })

    const result = JSON.parse(text) as {
      biggestGap: string
      diagnosis: string
      recommendations: string[]
    }
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Diagnosis failed — please try again.' }, { status: 500 })
  }
}
