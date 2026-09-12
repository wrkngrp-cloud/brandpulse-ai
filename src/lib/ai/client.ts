import Anthropic from '@anthropic-ai/sdk'

// Three-tier routing (Anthropic-only):
// cultural  (sentiment, Pidgin/Yoruba/Igbo/Hausa)    → Claude Haiku 4.5
// structural (reports, briefings, funnel diagnosis)   → Claude Sonnet 4.6
// chat       (AI Command Layer)                       → Claude Sonnet 4.6
// boardGrade (executive business cases)               → Claude Sonnet 4.6 (Opus when confirmed available)

export const MODELS = {
  cultural:   'claude-haiku-4-5-20251001',
  structural: 'claude-sonnet-4-6',
  chat:       'claude-sonnet-4-6',
  boardGrade: 'claude-sonnet-4-6',
} as const

export type ModelTier = keyof typeof MODELS

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiCallOptions {
  tier: ModelTier
  system: string
  messages: AiMessage[]
  maxTokens?: number
  temperature?: number
}

export async function callAi(opts: AiCallOptions): Promise<string> {
  const { tier, system, messages, maxTokens = 2048, temperature = 0 } = opts

  const resp = await anthropic.messages.create({
    model: MODELS[tier],
    max_tokens: maxTokens,
    temperature,
    system,
    messages,
  })

  const block = resp.content[0]
  if (block.type !== 'text') throw new Error('Unexpected content type from Claude')
  return block.text
}

/**
 * The `{...}` block out of a model response, parsed.
 *
 * A model asked for JSON will sometimes wrap it in a fence, and occasionally
 * prefix it with a sentence however firmly the prompt forbids that. Stripping
 * a fence and calling `JSON.parse` on the rest throws on the second case, and
 * the throw usually lands in a bare catch that reports nothing, so the feature
 * looks broken with no way to find out why.
 *
 * This takes the outermost brace pair instead, which survives both.
 */
export function extractJson<T>(raw: string): T {
  const start = raw.indexOf('{')
  const end   = raw.lastIndexOf('}')
  if (start === -1 || end <= start) {
    throw new Error(`No JSON object in model response: ${raw.slice(0, 200)}`)
  }
  return JSON.parse(raw.slice(start, end + 1)) as T
}
