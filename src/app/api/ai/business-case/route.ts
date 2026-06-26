import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'
import { buildBrandContext, formatBrandContextBlock } from '@/lib/ai/brand-context'
import { getActiveBrand } from '@/lib/active-brand'
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

interface FinancialReturn {
  marketing_roi_estimate: string
  payback_period:         string
  clv_cac_implication:    string
  mer_impact:             string
}

interface ScenarioAnalysis {
  base: string
  bull: string
  bear: string
}

interface AakerEquityOutcomes {
  loyalty:            string
  awareness:          string
  perceived_quality:  string
  associations:       string
  proprietary_assets: string
}

export interface BusinessCaseResult {
  title:                  string
  executive_summary:      string
  ansoff_quadrant:        string
  ansoff_implication:     string
  market_opportunity:     string
  esov_signal:            string
  financial_return:       FinancialReturn
  scenario_analysis:      ScenarioAnalysis
  aaker_equity_outcomes:  AakerEquityOutcomes
  strategic_rationale:    string[]
  proposed_investment:    string
  resource_requirements:  string
  expected_outcomes:      ExpectedOutcome[]
  risk_factors:           RiskFactor[]
  decision_gates:         string[]
  success_metrics:        string[]
  alternatives_considered: string
  recommendation:         string
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string; name: string; category: string | null; market_share_pct: number | null }>(
    supabase, 'id, name, category, market_share_pct'
  )
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
    sovPct    = sovSnap?.social_sov  != null ? Number(sovSnap.social_sov) : null
    bhiScore  = bhiSnap?.bhi         != null ? Number(bhiSnap.bhi)        : null
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

You are building a board-ready marketing investment case for a global VP of Marketing presenting to executive leadership. Apply these frameworks explicitly:
- ESOV / Binet & Field: justify why spend level is right, too low, or at risk; quantify long-run market share prediction
- Aaker Brand Equity: frame expected outcomes across all five equity sources (Loyalty, Awareness, Perceived Quality, Associations, Proprietary Assets)
- Porter's Five Forces: frame competitive risks (rivalry intensity, buyer power, substitution threat, new entrants)
- Ansoff Matrix: identify the quadrant and what it implies for risk profile and expected return timeline
- Financial return framing: Marketing ROI estimate, payback period, CLV:CAC ratio implication, MER (Marketing Efficiency Ratio)
- Scenario analysis: Base, Bull, and Bear cases for the initiative
- Resource requirements: what headcount, agency, or technology is needed beyond budget
- Decision gates: what milestones trigger a go/no-go review mid-flight

Ground every claim in specific Nigerian/West African market dynamics. Be direct — boards want evidence, numbers, and clear verdicts, not hedged consultant language.

Return ONLY this JSON, no preamble, no markdown fences:
{
  "title": "string — crisp title for the business case",
  "executive_summary": "string — 4-5 sentences presenting the investment thesis, ESOV signal, and financial return headline",
  "ansoff_quadrant": "Market Penetration | Market Development | Product Development | Diversification",
  "ansoff_implication": "string — what this quadrant means for risk profile and expected return timeline",
  "market_opportunity": "string — category size, growth rate, penetration gap, and specific Nigerian/West African context",
  "esov_signal": "string — what the current ESOV position means for this initiative and long-run market share trajectory",
  "financial_return": {
    "marketing_roi_estimate": "string — estimated ROI range with assumptions stated",
    "payback_period": "string — how long to recover the investment",
    "clv_cac_implication": "string — what CLV:CAC ratio this investment is expected to achieve or improve",
    "mer_impact": "string — how this affects the overall Marketing Efficiency Ratio"
  },
  "scenario_analysis": {
    "base": "string — expected outcome under realistic assumptions",
    "bull": "string — upside scenario and what would drive it",
    "bear": "string — downside scenario and early warning signals"
  },
  "aaker_equity_outcomes": {
    "loyalty": "string — expected loyalty impact",
    "awareness": "string — expected awareness impact",
    "perceived_quality": "string — expected quality perception impact",
    "associations": "string — brand association outcome",
    "proprietary_assets": "string — any IP, channel, or capability advantage built"
  },
  "strategic_rationale": ["string", "string", "string", "string"],
  "proposed_investment": "string — budget breakdown narrative with cost-per-outcome benchmarks",
  "resource_requirements": "string — headcount, agency, technology, and capability requirements beyond budget",
  "expected_outcomes": [
    { "metric": "string", "target": "string", "timeline": "string" }
  ],
  "risk_factors": [
    { "risk": "string", "mitigation": "string" }
  ],
  "decision_gates": ["string", "string"],
  "success_metrics": ["string", "string", "string", "string"],
  "alternatives_considered": "string — what else could be done with this budget and why this approach wins",
  "recommendation": "string — clear Go/No-Go/Conditional verdict with specific conditions"
}`

  try {
    const raw = await callAi({
      tier:        'boardGrade',
      system:      'You are a senior business strategist building board-ready investment cases for Nigerian/West African brands. Apply Aaker, ESOV, Porter, and Ansoff frameworks explicitly. Return ONLY valid JSON with no markdown fences.',
      messages:    [{ role: 'user', content: userPrompt }],
      maxTokens:   4500,
      temperature: 0.2,
    })

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const result = JSON.parse(cleaned) as BusinessCaseResult
    return NextResponse.json(result)
  } catch (err) {
    console.error('[business-case] AI error:', err)
    return NextResponse.json({ error: 'Failed to generate business case. Please try again.' }, { status: 500 })
  }
}
