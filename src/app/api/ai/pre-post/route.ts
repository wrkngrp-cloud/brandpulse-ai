import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'
import { buildPrePostSystemPrompt, buildPrePostUserMessage } from '@/lib/ai/pre-post-context'

export const runtime    = 'nodejs'
export const maxDuration = 60

interface PrePostRequestBody {
  content: string
  platform: string
  funnelStage: string
  targetSegment?: string
}

interface RiskFlag {
  title: string
  offending_text: string
  reason: string
  replacement: string
}

interface PrePostAiResponse {
  engagement: { score: number; reasoning: string }
  cultural:   { score: number; reasoning: string }
  tone:       { score: number; reasoning: string }
  clarity:    { score: number; reasoning: string }
  risk:       { score: number; flags: RiskFlag[] }
  verdict: string
  improvements: string[]
  suggested_rewrite: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: brand } = await supabase.from('brands').select('id, target_segments').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const body = await req.json() as PrePostRequestBody
  if (!body.content?.trim()) return NextResponse.json({ error: 'Content is required' }, { status: 400 })

  const [systemPrompt] = await Promise.all([buildPrePostSystemPrompt(brand.id)])

  const userMessage = buildPrePostUserMessage(
    { content: body.content, platform: body.platform, funnelStage: body.funnelStage, targetSegment: body.targetSegment },
    brand.target_segments ?? []
  )

  const raw = await callAi({
    tier: 'chat',
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    maxTokens: 2000,
    temperature: 0.1,
  })

  // Strip possible markdown fences
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const parsed = JSON.parse(cleaned) as PrePostAiResponse

  // Persist
  const service = await createServiceClient()
  const { data: saved } = await service.from('pre_post_analyses').insert({
    brand_id:         brand.id,
    created_by:       user.id,
    content_text:     body.content,
    platform:         body.platform,
    target_segment:   body.targetSegment ?? null,
    funnel_goal:      body.funnelStage,
    engagement_score: parsed.engagement.score,
    cultural_score:   parsed.cultural.score,
    tone_score:       parsed.tone.score,
    clarity_score:    parsed.clarity.score,
    risk_score:       parsed.risk.score,
    risk_flags:       parsed.risk.flags ?? [],
    verdict:          parsed.verdict,
    improvements:     parsed.improvements ?? [],
    suggested_rewrite: parsed.suggested_rewrite,
    raw_response:     parsed,
  }).select('id').single()

  return NextResponse.json({
    id: saved?.id,
    engagement: parsed.engagement,
    cultural:   parsed.cultural,
    tone:       parsed.tone,
    clarity:    parsed.clarity,
    risk:       parsed.risk,
    verdict:    parsed.verdict,
    improvements: parsed.improvements,
    suggested_rewrite: parsed.suggested_rewrite,
  })
}
