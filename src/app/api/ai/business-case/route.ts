import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'
import { buildBrandContext, formatBrandContextBlock } from '@/lib/ai/brand-context'
import { z } from 'zod'

export const runtime = 'nodejs'
export const maxDuration = 120

const bodySchema = z.object({
  initiative: z.string().min(10),
  budget:     z.string().optional(),
  timeline:   z.string().optional(),
  objective:  z.string().optional(),
})

interface ExpectedOutcome {
  metric:   string
  target:   string
  timeline: string
}

interface RiskFactor {
  risk:       string
  mitigation: string
}

interface BusinessCaseResult {
  title:                string
  executive_summary:    string
  market_opportunity:   string
  strategic_rationale:  string[]
  proposed_investment:  string
  expected_outcomes:    ExpectedOutcome[]
  risk_factors:         RiskFactor[]
  success_metrics:      string[]
  recommendation:       string
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { initiative, budget, timeline, objective } = parsed.data

  let brandContext = ''
  try {
    const ctx = await buildBrandContext(brand.id)
    brandContext = formatBrandContextBlock(ctx)
  } catch {
    // Non-fatal — proceed without brand context
  }

  const userPrompt = `${brandContext ? `BRAND CONTEXT:\n${brandContext}\n\n` : ''}INITIATIVE:\n${initiative}${budget ? `\n\nBUDGET: ${budget}` : ''}${timeline ? `\n\nTIMELINE: ${timeline}` : ''}${objective ? `\n\nOBJECTIVE: ${objective}` : ''}

Build a comprehensive board-ready business case for this initiative. Ground every claim in specific Nigerian/West African market dynamics — reference realistic CPMs, typical awareness-lift benchmarks, market penetration rates, and competitive context as applicable.

Return ONLY this JSON, no preamble, no markdown:
{
  "title": "string — a crisp title for the business case",
  "executive_summary": "string — 3-4 sentences presenting the investment thesis clearly",
  "market_opportunity": "string — market size, growth rate, and specific Nigerian/West African context",
  "strategic_rationale": ["string", "string", "string"],
  "proposed_investment": "string — budget breakdown narrative aligned to stated budget if provided",
  "expected_outcomes": [
    { "metric": "string", "target": "string", "timeline": "string" }
  ],
  "risk_factors": [
    { "risk": "string", "mitigation": "string" }
  ],
  "success_metrics": ["string", "string", "string"],
  "recommendation": "string — clear Go/No-Go verdict with conditions"
}`

  try {
    const raw = await callAi({
      tier:        'boardGrade',
      system:      'You are a senior business strategist helping a Nigerian/West African brand build a board-ready business case. You are direct, evidence-based, and cite specific market dynamics. Return ONLY valid JSON.',
      messages:    [{ role: 'user', content: userPrompt }],
      maxTokens:   3000,
      temperature: 0.2,
    })

    // Strip any accidental markdown fencing
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const result = JSON.parse(cleaned) as BusinessCaseResult
    return NextResponse.json(result)
  } catch (err) {
    console.error('[business-case] AI error:', err)
    return NextResponse.json({ error: 'Failed to generate business case. Please try again.' }, { status: 500 })
  }
}
