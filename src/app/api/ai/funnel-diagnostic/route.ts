import { NextRequest, NextResponse } from 'next/server'
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

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

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

Perform a deep root-cause funnel diagnostic for this Nigerian/West African brand. Go beyond the surface — explain why each stage is performing as it is, with specific reference to Nigerian consumer behaviour, media landscape, and trust-building patterns.

Return ONLY this JSON, no preamble, no markdown:
{
  "overallHealth": "Critical|At Risk|Building|Strong",
  "criticalLeak": "string — the worst drop-off stage, why it happens, and what it is costing the brand",
  "stageDiagnoses": [
    {
      "stage": "string",
      "score": number | null,
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
      system:      'You are a brand growth diagnostician for Nigerian markets. Analyse funnel data and provide deep, specific root cause analysis and action plans. Return ONLY valid JSON.',
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
