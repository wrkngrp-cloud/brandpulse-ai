import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime    = 'nodejs'
export const maxDuration = 60

const schema = z.object({
  brandId:       z.string().uuid(),
  frameBase64:   z.string().min(1),
  script:        z.string().default(''),
  platform:      z.string().default('Instagram'),
  videoType:     z.enum(['story', 'reel', 'bumper', 'pre_roll', 'in_feed', 'other']).default('reel'),
  durationSec:   z.number().optional(),
})

export interface VideoAnalysisResult {
  hook_score:       number
  visual_score:     number
  cta_visibility:   number
  sound_off_score:  number
  overall:          number
  hook_assessment:  string
  visual_notes:     string
  sound_off_notes:  string
  cta_notes:        string
  top_recommendation: string
  improvements:     string[]
}

const VIDEO_TYPE_LABELS: Record<string, string> = {
  story:     'Story (15–60s, vertical)',
  reel:      'Reel/Short (up to 90s, vertical)',
  bumper:    'Bumper ad (6s, non-skippable)',
  pre_roll:  'Pre-roll (15–30s, skippable)',
  in_feed:   'In-feed video (square or landscape)',
  other:     'Video',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { brandId, frameBase64, script, platform, videoType, durationSec } = parsed.data

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, category, brand_values, target_segments')
    .eq('id', brandId)
    .single()
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

  const brandValues = Array.isArray(brand.brand_values) ? (brand.brand_values as string[]).join(', ') : ''
  const segments = Array.isArray(brand.target_segments) ? (brand.target_segments as string[]).join(', ') : ''
  const durationNote = durationSec ? `Video duration: ${durationSec}s.` : ''

  const systemPrompt = `You are a video creative strategist specialising in Nigerian and West African digital advertising.
You analyse video frames and scripts to assess video ad performance before launch.
Return only valid JSON with no markdown, no explanation outside the JSON.`

  const userPrompt = `Analyse this ${VIDEO_TYPE_LABELS[videoType]} for ${brand.name} on ${platform}.
Brand: ${brand.name} (${brand.category ?? 'brand'})
Brand values: ${brandValues || 'not specified'}
Target segments: ${segments || 'not specified'}
${durationNote}

Script/caption:
${script || '(no script provided — analyse the frame only)'}

Score the video creative on these dimensions (0–100):
- hook_score: How strong is the first-frame hook? Does it stop the scroll?
- visual_score: Overall visual quality, composition, branding clarity
- cta_visibility: How clear and prominent is the call to action?
- sound_off_score: How well does this work with sound off (text overlays, visual storytelling)?

Return JSON in this exact shape:
{
  "hook_score": <number>,
  "visual_score": <number>,
  "cta_visibility": <number>,
  "sound_off_score": <number>,
  "overall": <number>,
  "hook_assessment": "<1-2 sentences about the hook effectiveness>",
  "visual_notes": "<1-2 sentences about visual quality and branding>",
  "sound_off_notes": "<1-2 sentences about sound-off viewability>",
  "cta_notes": "<1-2 sentences about CTA clarity>",
  "top_recommendation": "<single most important change to make>",
  "improvements": ["<actionable improvement 1>", "<actionable improvement 2>", "<actionable improvement 3>"]
}`

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const resp = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    temperature: 0.1,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: frameBase64,
          },
        },
        { type: 'text', text: userPrompt },
      ],
    }],
  })

  const rawText = resp.content.find(c => c.type === 'text')?.text ?? ''
  let result: VideoAnalysisResult

  try {
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    result = JSON.parse(cleaned) as VideoAnalysisResult
  } catch {
    return NextResponse.json({ error: 'AI returned an unparseable response. Try again.' }, { status: 500 })
  }

  // Store result in creative_analyses
  await supabase
    .from('creative_analyses')
    .insert({
      brand_id:      brandId,
      analysis_type: 'video',
      result,
    })

  return NextResponse.json(result)
}
