/**
 * The output guard. Runs on every assistant reply before it is saved.
 *
 * Two kinds of fault. Formatting faults (markdown, an em dash) are fixed in
 * place, because the widget renders plain text and a fix loses nothing.
 * Content faults (a machine-sounding phrase, a price, a model or vendor name,
 * a banned word) are reported, and the job regenerates once and then hands the
 * thread to a person rather than send something that breaks the rules.
 *
 * Owner decision, 9 Nov 2026: no AI model, company or vendor is ever named in
 * the support chat, by the assistant or by staff, under any condition, even
 * when the customer names one first. The AI is only ever "BrandGauge's AI
 * model". `findModelNames` is shared with the Desk reply action for that
 * reason.
 *
 * HUM-01 and HUM-02 are never blocked. Their wording ("a support assistant on
 * the BrandGauge support team", "an automated support assistant") trips none
 * of the rules below, and `checkReply` is tested
 * against it in the eval so a future rule cannot quietly start blocking it.
 */

export const BANNED_WORDS = [
  'delve', 'underscore', 'pivotal', 'crucial', 'robust', 'vibrant',
  'leverage', 'seamless', 'tapestry', 'landscape',
] as const

export const MACHINE_PHRASES = [
  'as an ai', 'language model', 'i am a bot', "i'm a bot", 'im a bot', 'i am an ai', "i'm an ai",
  'my training', 'knowledge base', "i'm programmed", 'i am programmed',
  "i don't have access to real-time", 'i do not have access to real-time', 'i cannot browse', "i can't browse",
  'as a chatbot', 'as a bot', 'large language', 'llm',
  // The assistant never describes itself as any of these (build pack 1.3).
  'virtual assistant', 'chatbot', "i'm an ai assistant", 'i am an ai assistant', "i'm a virtual", 'an ai assistant here',
] as const

/**
 * Model and vendor names. Word-bounded so "Gemini" the vendor is caught and
 * "geminid" is not. Kept broad on purpose: the cost of a false hit is one
 * regenerated reply.
 */
const MODEL_NAME_RE = new RegExp(
  '\\b(' + [
    'anthropic', 'claude', 'openai', 'open ai', 'chat\\s?gpt', 'gpt[\\s-]?\\d[\\w.-]*', 'gpt',
    'gemini', 'bard', 'perplexity', 'llama', 'meta ai', 'mistral', 'mixtral', 'cohere',
    'deepseek', 'grok', 'xai', 'copilot', 'sonnet', 'haiku', 'opus', 'qwen', 'nvidia nim', 'google ai',
  ].join('|') + ')\\b',
  'i',
)

export function findModelNames(text: string): string[] {
  const hits = new Set<string>()
  const re = new RegExp(MODEL_NAME_RE.source, 'gi')
  for (const m of text.matchAll(re)) hits.add(m[0].toLowerCase())
  return [...hits]
}

/** A price or currency amount. Plain counts ("8 characters", "4 working hours") pass. */
const PRICE_RES = [
  /[₦$£€]\s?\d/,
  /\b(ngn|usd|gbp|eur|kes|ghs)\s?\d/i,
  /\d[\d,.]*\s?(k|m)?\s?(naira|ngn|usd|dollars?|pounds?|euros?|cedis?)\b/i,
  /\d[\d,.]*\s?(\/|per)\s?(month|mo|year|yr|seat|user)\b/i,
]

export function hasPrice(text: string): boolean {
  return PRICE_RES.some(re => re.test(text))
}

/** Plain text for a widget that renders plain text. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, m => m.replace(/```\w*\n?/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) =>
      label.trim() === url.trim() ? url : `${label} ${url}`)
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1$2')
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?:;]|$)/g, '$1$2')
    .replace(/\*/g, '')
    .replace(/^\s*\|.*\|\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** The em dash is the one formatting fault worth a regenerate: it usually means the model drifted into its own voice. */
export function fixDashes(text: string): string {
  return text.replace(/\s*—\s*/g, ', ').replace(/,\s*,/g, ',')
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

/** Did the customer ask for the full picture? Then the 60-word cap does not apply. */
export function askedForDetail(customerText: string): boolean {
  return /\b(detail|details|detailed|full|everything|all (the )?steps|step by step|explain|walk me through|in depth|long version)\b/i
    .test(customerText)
}

/** Trim to whole sentences under the cap. Keeps at least the first sentence. */
export function capWords(text: string, max: number): string {
  if (wordCount(text) <= max) return text
  const sentences = text.match(/[^.!?\n]+[.!?]*\s*|\n+/g) ?? [text]
  let out = ''
  for (const s of sentences) {
    if (out && wordCount(out + s) > max) break
    out += s
  }
  return out.trim() || text
}

export interface GuardIssue {
  rule: 'machine_phrase' | 'model_name' | 'price' | 'banned_word' | 'em_dash' | 'markdown' | 'secret_echo' | 'empty'
  detail: string
}

export interface GuardResult {
  ok: boolean
  /** The reply after the in-place fixes. Only safe to send when ok is true. */
  text: string
  issues: GuardIssue[]
}

/**
 * Check a reply.
 *
 * `strict` is the first pass: an em dash counts as a content fault so the
 * model gets one chance to write it properly. On the second pass it is fixed
 * in place instead.
 */
export function checkReply(raw: string, opts: {
  customerText: string
  strict: boolean
  /** Secrets the customer pasted. The reply must never contain one. */
  forbiddenFragments?: string[]
}): GuardResult {
  const issues: GuardIssue[] = []
  let text = raw ?? ''

  const hadMarkdown = /(\*\*|__|^#{1,6}\s|\]\(|^\s*[-*]\s|`)/m.test(text)
  text = stripMarkdown(text)
  if (hadMarkdown) issues.push({ rule: 'markdown', detail: 'stripped' })

  if (text.includes('—')) {
    if (opts.strict) issues.push({ rule: 'em_dash', detail: 'em dash' })
    else text = fixDashes(text)
  }

  const lower = text.toLowerCase()
  for (const phrase of MACHINE_PHRASES) {
    const re = new RegExp(`(^|[^a-z])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i')
    if (re.test(lower)) issues.push({ rule: 'machine_phrase', detail: phrase })
  }
  for (const name of findModelNames(text)) issues.push({ rule: 'model_name', detail: name })
  if (hasPrice(text)) issues.push({ rule: 'price', detail: 'currency amount' })
  for (const word of BANNED_WORDS) {
    if (new RegExp(`\\b${word}(s|d|ed|ing)?\\b`, 'i').test(text)) issues.push({ rule: 'banned_word', detail: word })
  }
  for (const fragment of opts.forbiddenFragments ?? []) {
    if (fragment.length >= 6 && text.includes(fragment)) issues.push({ rule: 'secret_echo', detail: 'quoted a secret' })
  }
  if (!text.trim()) issues.push({ rule: 'empty', detail: 'empty reply' })

  if (!askedForDetail(opts.customerText)) text = capWords(text, 60)

  // Markdown is fixed in place, so it never fails a reply on its own.
  const blocking = issues.filter(i => i.rule !== 'markdown')
  return { ok: blocking.length === 0, text, issues }
}
