import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'
import { z } from 'zod'

const bodySchema = z.object({
  momentName:  z.string(),
  brandName:   z.string(),
  category:    z.string().optional(),
  brandValues: z.array(z.string()).optional(),
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

  const { momentName, brandName, category, brandValues } = parsed.data

  const valuesLine =
    brandValues && brandValues.length
      ? `Brand values: ${brandValues.join(', ')}`
      : ''

  const userPrompt = `Brand: ${brandName}
Category: ${category ?? 'not specified'}
${valuesLine}
Cultural moment: ${momentName}

Generate 4 practical brand activation ideas for this moment targeted at Nigerian and West African consumers.

Return ONLY valid JSON in this exact shape — no markdown, no explanation:
{
  "ideas": [
    {
      "title": "short idea title",
      "description": "2-3 sentence description of the activation, including specific Nigerian cultural context",
      "channel": "e.g. Instagram, WhatsApp, Events, OOH, Influencer",
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
