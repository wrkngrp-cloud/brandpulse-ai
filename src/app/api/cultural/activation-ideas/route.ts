import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'
import { z } from 'zod'

const segmentSchema = z.object({
  name:      z.string(),
  age_range: z.string().optional(),
  income:    z.string().optional(),
  location:  z.string().optional(),
  interests: z.array(z.string()).optional(),
})

const bodySchema = z.object({
  momentName:     z.string(),
  momentDate:     z.string().optional(),
  brandName:      z.string(),
  category:       z.string().optional(),
  brandValues:    z.array(z.string()).optional(),
  targetSegments: z.array(segmentSchema).optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { momentName, momentDate, brandName, category, brandValues, targetSegments } = parsed.data

  const valuesLine = brandValues?.length ? `Brand values: ${brandValues.join(', ')}` : ''
  const segmentsLine = targetSegments?.length
    ? `Target audience segments:\n${targetSegments.map(s =>
        `  - ${s.name}${s.age_range ? `, age ${s.age_range}` : ''}${s.income ? `, ${s.income} income` : ''}${s.location ? `, ${s.location}` : ''}${s.interests?.length ? `, interests: ${s.interests.join(', ')}` : ''}`
      ).join('\n')}`
    : ''

  const userPrompt = `Brand: ${brandName}
Category: ${category ?? 'not specified'}
${valuesLine}
${segmentsLine}
Cultural moment: ${momentName}${momentDate ? ` (${momentDate})` : ''}

Generate 4 practical brand activation ideas for this moment. Ideas must be:
- Grounded in the brand's specific audience segments above (not generic)
- Rooted in genuine Nigerian and West African cultural context
- Varied across channels and effort levels

Return ONLY valid JSON in this exact shape — no markdown, no explanation:
{
  "ideas": [
    {
      "title": "short idea title",
      "description": "2-3 sentences — include specific audience angle and Nigerian cultural context",
      "channel": "e.g. Instagram, WhatsApp, Events, OOH, Influencer, Radio, TV",
      "effort": "Low" | "Medium" | "High"
    }
  ]
}`

  try {
    const text = await callAi({
      tier: 'structural',
      system:
        'You are a brand activation strategist for Nigerian and West African brands. You generate practical, culturally specific activation ideas for brand moments. Return ONLY valid JSON — no markdown.',
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 900,
      temperature: 0.4,
    })

    // Strip any accidental markdown fences
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim()

    const result = JSON.parse(cleaned) as { ideas: unknown }

    if (!Array.isArray(result.ideas)) {
      throw new Error('Unexpected response shape')
    }

    return NextResponse.json({ ideas: result.ideas })
  } catch {
    return NextResponse.json(
      { error: 'Could not generate activation ideas — please try again.' },
      { status: 500 },
    )
  }
}
