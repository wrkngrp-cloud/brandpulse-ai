import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { callAi } from '@/lib/ai/client'
import { buildPrePostSystemPrompt, buildPrePostUserMessage } from '@/lib/ai/pre-post-context'

export const runtime    = 'nodejs'
export const maxDuration = 60

type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

interface PrePostRequestBody {
  content: string
  platform: string
  funnelStage: string
  targetSegment?: string
  imageBase64?: string
  imageMediaType?: SupportedMediaType
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

const ALLOWED_MEDIA_TYPES: SupportedMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string; target_segments: unknown[] }>(supabase, 'id, target_segments')
  if (!brand) return NextResponse.json({ error: 'No active brand' }, { status: 404 })

  const body = await req.json() as PrePostRequestBody
  if (!body.content?.trim() && !body.imageBase64) {
    return NextResponse.json({ error: 'Content or image is required' }, { status: 400 })
  }
  if (body.imageMediaType && !ALLOWED_MEDIA_TYPES.includes(body.imageMediaType)) {
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 })
  }

  const systemPrompt = await buildPrePostSystemPrompt(brand.id)
  const hasVisual = Boolean(body.imageBase64 && body.imageMediaType)

  const userMessage = buildPrePostUserMessage(
    { content: body.content, platform: body.platform, funnelStage: body.funnelStage, targetSegment: body.targetSegment },
    brand.target_segments ?? [],
    hasVisual
  )

  let raw: string
  if (hasVisual) {
    // Vision call — Anthropic SDK directly (callAi wrapper is text-only)
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      temperature: 0.1,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: body.imageMediaType!,
              data: body.imageBase64!,
            },
          },
          { type: 'text', text: userMessage },
        ],
      }],
    })
    const block = resp.content[0]
    if (block.type !== 'text') throw new Error('Unexpected response type from Claude Vision')
    raw = block.text
  } else {
    raw = await callAi({
      tier: 'chat',
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 2000,
      temperature: 0.1,
    })
  }

  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const parsed = JSON.parse(cleaned) as PrePostAiResponse

  const service = await createServiceClient()
  const { data: saved } = await service.from('pre_post_analyses').insert({
    brand_id:         brand.id,
    created_by:       user.id,
    content_text:     body.content ?? '',
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
    raw_response:     { ...parsed, has_visual: hasVisual },
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
    hasVisual,
  })
}
