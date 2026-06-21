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

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, category, market_share_pct')
    .limit(1).single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { initiative, budget, timeline, objective } = parsed.data

  let brandContext = ''
  let sovPct: number | null = null
  let bhiScore: number | null = null

  try {
    const ctx = await buildBrandContext(brand.id)
    brandContext = formatBrandContextBlock(ctx)
  } catch {
    // Non-fatal
  }

  try {
    const [{ data: sovSnap }, { data: bhiSnap }] = await Promise.all([
      supabase.from('sov_snapshots').select('social_sov').eq('brand_id', brand.id).order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('brand_health_snapshots').select('bhi').eq('brand_id', brand.id).order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
    ])
    sovPct    = sovSnap?.social_sov    != null ? Number(sovSnap.social_sov)    : null
    bhiScore  = bhiSnap?.bhi           != null ? Number(bhiSnap.bhi)           : null
  } catch {
    // Non-fatal
  }

  const marketSharePct = brand.market_share_pct ? Number(brand.market_share_pct) : null
  const esov = sovPct != null && marketSharePct != null ? sovPct - marketSharePct : null

  const esovBlock = esov != null
    ? `ESOV (Binet & Field): ${esov > 0 ? '+' : ''}${esov.toFixed(1)}% (SOV ${sovPct?.toFixed(1)}% − market share ${marketSharePct}%). ${esov >= 5 ? 'Growth posture: positive ESOV predicts market share gain.' : esov >= 0 ? 'Mild growth posture — incremental spend can tip this into clear growth.' : 'Underinvestment risk: negative ESOV means competitors are compounding their equity advantage.'}`
    : `SOV: ${sovPct != null ? `${sovPct.toFixed(1)}%` : 'N/A'} | Market share: ${marketSharePct != null ? `${marketSharePct}%` : 'not configured'} | ESOV: insufficient data`

  const userPrompt = `${brandContext ? `BRAND CONTEXT:\n${brandContext}\n\n` : ''}BRAND EQUITY DATA:
BHI (Brand Health Index): ${bhiScore != null ? `${bhiScore.toFixed(1)}/100` : 'N/A'}
${esovBlock}

INITIATIVE: ${initiative}${budget ? `\nBUDGET: ${budget}` : ''}${timeline ? `\nTIMELINE: ${timeline}` : ''}${objective ? `\nOBJECTIVE: ${objective}` : ''}

Build a board-ready business case applying these frameworks:
- ESOV / Binet & Field: use the ESOV signal to justify why spend level is right, too low, or at risk
- Aaker Brand Equity: frame expected outcomes in terms of the five equity sources (Loyalty, Awareness, Perceived Quality, Associations, Proprietary Assets)
- Porter's Five Forces: frame competitive risks in terms of rivalry intensity, buyer power, substitution threat
- Ansoff Matrix: identify which quadrant this initiative sits in (Market Penetration / Market Development / Product Development / Diversification) and what that implies for risk and return
- SWOT: derive 2 strengths, 2 weaknesses, 2 opportunities, 2 threats from the data

Ground every claim in specific Nigerian/West African market dynamics. Be direct — boards want evidence, not hedged consultant language.

Return ONLY this JSON, no preamble, no markdown:
{
  "title": "string — a crisp title for the business case",
  "executive_summary": "string — 3-4 sentences presenting the investment thesis including ESOV signal",
  "ansoff_quadrant": "Market Penetration | Market Development | Product Development | Diversification",
  "ansoff_implication": "string — what this quadrant means for risk and expected return timeline",
  "market_opportunity": "string — market size, growth rate, and specific Nigerian/West African context",
  "esov_signal": "string — what the current ESOV position means for this initiative",
  "aaker_equity_outcomes": {
    "loyalty": "string — expected loyalty impact",
    "awareness": "string — expected awareness impact",
    "perceived_quality": "string — expected quality perception impact",
    "associations": "string — brand association outcome"
  },
  "strategic_rationale": ["string", "string", "string"],
  "proposed_investment": "string — budget breakdown narrative",
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
      system:      'You are a senior business strategist building board-ready investment cases for Nigerian/West African brands. Apply Aaker, ESOV, Porter, and Ansoff frameworks explicitly. Return ONLY valid JSON.',
      messages:    [{ role: 'user', content: userPrompt }],
      maxTokens:   3200,
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
