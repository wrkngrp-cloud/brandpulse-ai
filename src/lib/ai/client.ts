import Anthropic from '@anthropic-ai/sdk'
import { recordAiCall } from '@/lib/usage/record'

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

/**
 * USD per million tokens, per model, for the cost figure on the Desk.
 *
 * This is the one place in the codebase that holds a price, and it is here
 * rather than in a document because prices drift and documents go stale
 * silently. Cache reads are the standard 0.1x of the input rate. Add a row
 * whenever MODELS gains one: an unpriced model logs its tokens with a null
 * cost, which reads as "we do not know" instead of as free.
 */
const PRICES_USD_PER_MTOK: Record<string, { input: number; output: number; cacheRead: number }> = {
  'claude-haiku-4-5-20251001': { input: 1,  output: 5,  cacheRead: 0.10 },
  'claude-sonnet-4-6':         { input: 3,  output: 15, cacheRead: 0.30 },
}

function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
): number | null {
  const price = PRICES_USD_PER_MTOK[model]
  if (!price) return null
  return (
    (inputTokens     * price.input     +
     outputTokens    * price.output    +
     cacheReadTokens * price.cacheRead) / 1_000_000
  )
}

/**
 * Who this call was for, so the Desk can total it per account and per feature.
 *
 * Optional on purpose. A call site that has not been wired yet still works and
 * still logs; it lands under the feature key 'unattributed', which is visible
 * and fixable, rather than being attributed to the wrong feature or silently
 * dropped.
 */
export interface AiCallMeta {
  workspaceId?: string | null
  brandId?:     string | null
  userId?:      string | null
  /** Dotted key, e.g. 'funnel.diagnose' or 'report.monthly'. */
  feature?:     string
}

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
  meta?: AiCallMeta
}

export async function callAi(opts: AiCallOptions): Promise<string> {
  const { tier, system, messages, maxTokens = 2048, temperature = 0, meta } = opts
  const model = MODELS[tier]
  const startedAt = Date.now()

  // Every AI call the product makes comes through here, which is what makes one
  // write enough to instrument all of them. The log is awaited rather than
  // floated: a serverless function can be frozen the moment the response is
  // returned, and a floated insert would be lost for exactly the long calls we
  // most want to cost.
  const log = (
    ok: boolean,
    usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number | null },
    error?: string,
  ) => recordAiCall({
    workspaceId:  meta?.workspaceId ?? null,
    brandId:      meta?.brandId ?? null,
    userId:       meta?.userId ?? null,
    tier,
    model,
    feature:      meta?.feature ?? 'unattributed',
    inputTokens:  usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
    costUsd: estimateCostUsd(
      model,
      usage?.input_tokens ?? 0,
      usage?.output_tokens ?? 0,
      usage?.cache_read_input_tokens ?? 0,
    ),
    latencyMs: Date.now() - startedAt,
    ok,
    error: error ?? null,
  })

  let resp
  try {
    resp = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages,
    })
  } catch (err) {
    await log(false, undefined, err instanceof Error ? err.message : String(err))
    throw err
  }

  await log(true, resp.usage)

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
