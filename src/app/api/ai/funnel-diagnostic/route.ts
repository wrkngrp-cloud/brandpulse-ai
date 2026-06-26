import { NextRequest, NextResponse } from 'next/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { createClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'
import { buildBrandContext, formatBrandContextBlock } from '@/lib/ai/brand-context'
import { z } from 'zod'

export const runtime = 'nodejs'
export const maxDuration = 120

const bodySchema = z.object({
  stages: z.array(
    z.object({
      name:    z.string(),
      score:   z.number().nullable(),
      dropOff: z.number().nullable(),
    })
  ),
})

interface StageAction {
  action:   string
  timeline: string
  effort:   'Low' | 'Medium' | 'High'
}

interface StageDiagnosis {
  stage:      string
  score:      number | null
  framework?: string
  diagnosis:  string
  rootCauses: string[]
  actions:    StageAction[]
}

interface FunnelDiagnosticResult {
  overallHealth:    'Critical' | 'At Risk' | 'Building' | 'Strong'
  criticalLeak:     string
  stageDiagnoses:   StageDiagnosis[]
  priorityPlan:     string
  expectedImpact:   string
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand' }, { status: 404 })
  const brand = { id: brandId }

  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { stages } = parsed.data

  let brandContext = ''
  try {
    const ctx = await buildBrandContext(brand.id)
    brandContext = formatBrandContextBlock(ctx)
  } catch {
    // Non-fatal
  }

  const stagesText = stages.map(s =>
    `${s.name}: score=${s.score ?? 'no data'}/100, drop-off=${s.dropOff != null ? s.dropOff + '%' : 'N/A'}`
  ).join('\n')

  const worstDrop = stages.reduce<typeof stages[number] | null>((worst, s) => {
    if (s.dropOff == null) return worst
    if (worst == null || s.dropOff > (worst.dropOff ?? 0)) return s
    return worst
  }, null)

  const userPrompt = `${brandContext ? `BRAND CONTEXT:\n${brandContext}\n\n` : ''}FUNNEL STAGE DATA:
${stagesText}

Biggest measured drop-off: ${worstDrop ? `${worstDrop.name} (${worstDrop.dropOff}% drop)` : 'insufficient data — diagnose lowest-scoring stage'}

MEASUREMENT METHODOLOGY (apply these frameworks in your diagnosis):
- AWARENESS = Share of Voice % — the Ehrenberg-Bass Mental Availability proxy. Low SOV means the brand is not being thought of in category buying situations. Fix = reach-based advertising across more category entry points, not narrow targeting.
- CONSIDERATION = social engagement rate — a brand salience signal. Low engagement = weak content distinctiveness or wrong channel for the target audience.
- PREFERENCE = sentiment score — brand association quality signal. Low sentiment = specific negative associations are undercutting consideration-to-preference conversion.
- ACTION = lead capture + OOH vanity visits — diagnose using 7Ps: Place (is the product easy to find/buy?), Promotion (does the CTA convert?), Process (is purchase friction too high?).
- LOYALTY = NPS — a People + Process + Physical Evidence signal. Low NPS = service experience gap, not a marketing problem.
- ADVOCACY = organic share rate — the Ehrenberg-Bass word-of-mouth signal. Low advocacy = the brand lacks distinctive assets or shareable moments.

Nigerian-specific drop-off patterns to consider:
- Awareness → Consideration drop: reach is broad but content is not culturally resonant
- Consideration → Preference drop: the brand is interesting but not yet trusted (trust takes longer to build in Nigerian FMCG)
- Preference → Action drop: buyer power and substitution threat (Porter) — alternatives are too easy to choose, or payment/distribution friction is too high
- Action → Loyalty drop: People and Process failure — one-time purchase but experience doesn't warrant return
- Loyalty → Advocacy drop: loyal but silent — the brand hasn't given customers language or moments worth sharing

Perform a deep root-cause funnel diagnostic. Be specific and actionable.

Return ONLY this JSON, no preamble, no markdown:
{
  "overallHealth": "Critical|At Risk|Building|Strong",
  "criticalLeak": "string — the worst drop-off stage, why it happens, and what it costs the brand in market share",
  "stageDiagnoses": [
    {
      "stage": "string",
      "score": number | null,
      "framework": "string — which framework applies to this stage (Ehrenberg-Bass / 7Ps / NPS / Porter)",
      "diagnosis": "string — specific root cause for this stage performance",
      "rootCauses": ["string", "string"],
      "actions": [
        { "action": "string", "timeline": "string", "effort": "Low|Medium|High" }
      ]
    }
  ],
  "priorityPlan": "string — what to fix first and exactly why that sequence matters",
  "expectedImpact": "string — if the top priority is addressed, what BHI or score improvement is realistic and over what timeframe"
}`

  try {
    const raw = await callAi({
      tier:        'structural',
      system:      'You are a brand growth diagnostician for Nigerian/West African markets. Apply Ehrenberg-Bass Mental Availability at Awareness, 7Ps Marketing Mix at Action and Loyalty, NPS loyalty frameworks at Loyalty, and Porter competitive forces at Preference-to-Action. Be specific and actionable. Return ONLY valid JSON.',
      messages:    [{ role: 'user', content: userPrompt }],
      maxTokens:   2500,
      temperature: 0.3,
    })

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const result  = JSON.parse(cleaned) as FunnelDiagnosticResult
    return NextResponse.json(result)
  } catch (err) {
    console.error('[funnel-diagnostic] AI error:', err)
    return NextResponse.json({ error: 'Diagnostic failed. Please try again.' }, { status: 500 })
  }
}
