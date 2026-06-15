import { callAi } from '@/lib/ai/client'
import { buildBrandContext } from '@/lib/ai/brand-context'
import { createServiceClient } from '@/lib/supabase/server'
import {
  buildSentimentSystemPrompt,
  buildSentimentUserMessage,
  type SentimentItem,
} from '@/lib/ai/prompts/sentiment'

export type SentimentLabel = 'positive' | 'neutral' | 'negative' | 'mixed'
export type PlutchikEmotion =
  | 'joy' | 'trust' | 'anger' | 'surprise'
  | 'disgust' | 'fear' | 'anticipation' | 'sadness' | 'neutral'

export interface SentimentResult {
  id: string
  sentiment: SentimentLabel
  emotion: PlutchikEmotion
  confidence: number
}

const VALID_SENTIMENTS = new Set(['positive', 'neutral', 'negative', 'mixed'])
const VALID_EMOTIONS = new Set([
  'joy', 'trust', 'anger', 'surprise',
  'disgust', 'fear', 'anticipation', 'sadness', 'neutral',
])

function parseResults(raw: string, items: SentimentItem[]): SentimentResult[] {
  // Strip any accidental markdown fences the model may have added
  const cleaned = raw.replace(/```json|```/g, '').trim()
  let parsed: unknown[]
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Sentiment model returned non-JSON: ${raw.slice(0, 200)}`)
  }

  if (!Array.isArray(parsed) || parsed.length !== items.length) {
    throw new Error(
      `Expected ${items.length} results, got ${Array.isArray(parsed) ? parsed.length : 'non-array'}`
    )
  }

  return parsed.map((r, i) => {
    const raw = r as Record<string, unknown>
    const sentiment = String(raw.sentiment ?? '')
    const emotion = String(raw.emotion ?? '')
    const confidence = Number(raw.confidence ?? 0)

    return {
      id: String(raw.id ?? items[i].id),
      sentiment: VALID_SENTIMENTS.has(sentiment) ? (sentiment as SentimentLabel) : 'neutral',
      emotion: VALID_EMOTIONS.has(emotion) ? (emotion as PlutchikEmotion) : 'neutral',
      confidence: Math.min(1, Math.max(0, confidence)),
    }
  })
}

// Batch size kept at 50 to stay within Haiku's context and match Phase-0 gate sample size
const BATCH_SIZE = 50

async function loadDisputeExamples(brandId: string): Promise<string> {
  try {
    const service = await createServiceClient()
    const { data } = await service
      .from('sentiment_disputes')
      .select('mention_id, original_label, corrected_label, reason, mentions(content)')
      .eq('brand_id', brandId)
      .eq('status', 'applied')
      .order('created_at', { ascending: false })
      .limit(15)

    if (!data || data.length === 0) return ''

    const lines = data
      .filter(d => {
        const m = d.mentions as unknown
        return m && typeof m === 'object' && !Array.isArray(m) && (m as { content?: string }).content
      })
      .map(d => {
        const content = ((d.mentions as unknown) as { content: string }).content.slice(0, 120)
        const reason  = d.reason ? ` (User note: ${d.reason})` : ''
        return `  • "${content}" — was "${d.original_label}", correct label is "${d.corrected_label}"${reason}`
      })
      .join('\n')

    if (!lines) return ''

    return `\n\n─── USER CORRECTIONS FOR THIS BRAND ────────────────────────────────────────────\nThese are past misclassifications corrected by the brand team. Apply the same logic to similar new items:\n${lines}`
  } catch {
    return ''
  }
}

export async function classifySentiment(
  brandId: string,
  items: SentimentItem[]
): Promise<SentimentResult[]> {
  if (items.length === 0) return []

  const [ctx, correctionBlock] = await Promise.all([
    buildBrandContext(brandId),
    loadDisputeExamples(brandId),
  ])
  const system = buildSentimentSystemPrompt(ctx, correctionBlock)

  const results: SentimentResult[] = []

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE)
    const raw = await callAi({
      tier: 'cultural',
      system,
      messages: [{ role: 'user', content: buildSentimentUserMessage(batch) }],
      maxTokens: 1024,
      temperature: 0,
    })
    results.push(...parseResults(raw, batch))
  }

  return results
}
