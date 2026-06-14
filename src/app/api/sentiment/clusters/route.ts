import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'
import { z } from 'zod'

const bodySchema = z.object({
  mentions: z.array(z.string()).min(1).max(100),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { mentions } = parsed.data

  const mentionText = mentions
    .slice(0, 60)
    .map((m, i) => `${i + 1}. "${m}"`)
    .join('\n')

  const systemPrompt = `You are a Nigerian brand strategist analysing social media mentions.
Your job is to identify the key themes people are talking about regarding a brand.
You understand Nigerian slang, Pidgin English, and the local consumer mindset.
Respond with valid JSON only. No markdown, no preamble.`

  const userPrompt = `Analyse these ${mentions.length} social media mentions and group them into 3 to 5 thematic clusters.

Mentions:
${mentionText}

For each cluster provide:
- label: short name (2-4 words, title case)
- description: one sentence explaining what people are saying
- count: estimated number of the above mentions that fit this cluster
- sentiment: the dominant sentiment ("positive", "neutral", or "negative")
- quotes: exactly 2 representative short quotes from the list above (keep them verbatim)

Return exactly this JSON shape:
{
  "clusters": [
    {
      "label": "string",
      "description": "string",
      "count": number,
      "sentiment": "positive" | "neutral" | "negative",
      "quotes": ["string", "string"]
    }
  ]
}`

  try {
    const text = await callAi({
      tier:        'cultural',
      system:      systemPrompt,
      messages:    [{ role: 'user', content: userPrompt }],
      maxTokens:   1200,
      temperature: 0.2,
    })
    const result = JSON.parse(text)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Clustering failed — please try again.' }, { status: 500 })
  }
}
