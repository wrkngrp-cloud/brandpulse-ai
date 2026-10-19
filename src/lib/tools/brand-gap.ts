import { callAi, extractJson } from '@/lib/ai/client'
import { fetchGoogleNewsRss, pressQuery, publicationFromUrl, parsePubDate, type RssItem } from '@/lib/press/nigerian-press'
import { configuredAssistants, queryAssistant } from '@/lib/ai/assistants'
import { fetchPublic, failureSentence, normaliseUrl, robotsDisallows, pathAllowed } from './fetch-public'
import { findSectionLinks, readPage, type PageFacts } from './html'
import type { CoverageNote, Evidence, Finding, ToolReport } from './report'

/**
 * The Brand Perception Gap.
 *
 * Two identities, held next to each other.
 *
 *   Stated     — who you say you are, read off your own website and nowhere
 *                else. Every line of it carries a verbatim quote from a page
 *                we fetched, and a quote that does not appear in the text we
 *                read is dropped before it reaches the report.
 *
 *   Described  — who the market says you are, read off the Nigerian press and
 *                off what an AI assistant answers when asked about you. Both
 *                are public descriptions of the brand that the brand did not
 *                write, which is the only half of this that counts as outside
 *                evidence.
 *
 * The product is neither profile. It is the distance between them: the values
 * you lead with that nobody repeats, the attribute you are known for that you
 * never claim, and the places the two actually agree. A marketer can take that
 * into a meeting; a profile of themselves they already know.
 *
 * Why an external assistant is queried at all, when CLAUDE.md says our own
 * generation is Anthropic-only: this is the AI Visibility exception used for
 * exactly what it is for. The assistant is the thing being measured. Its
 * answer is evidence about the brand's public description, not output we pass
 * off as ours, and its name never appears in the UI.
 *
 * What this never does: infer a market share, a customer count, a revenue
 * figure or a sentiment percentage. Nothing here is measured in numbers,
 * because nothing here can be.
 */

export type DivergenceKind = 'missing' | 'contradicted' | 'unclaimed' | 'aligned'

export const DIVERGENCE_LABEL: Record<DivergenceKind, string> = {
  missing:      'Said, not heard',
  contradicted: 'Contradicted',
  unclaimed:    'Heard, not said',
  aligned:      'Agreed',
}

export interface StatedTrait {
  /** The claim, in our words. */
  label: string
  /** Verbatim from one of their own pages. Verified to appear in the text. */
  quote: string
  sourceUrl: string
}

export interface StatedIdentity {
  audience:   string | null
  promise:    string | null
  category:   string | null
  values:     StatedTrait[]
  voice:      { adjectives: string[]; tone: string | null }
  segments:   Array<{ name: string; demographics: string; geography: string }>
  pagesRead:  string[]
}

export interface DescribedTrait {
  attribute:   string
  quote:       string
  kind:        'press' | 'assistant'
  sourceUrl:   string | null
  sourceName:  string
  publishedAt: string | null
}

export interface Divergence {
  kind:           DivergenceKind
  /** What they say about themselves. Empty for an unclaimed attribute. */
  stated:         string
  /** What the market says. Empty for a claim nobody repeats. */
  described:      string
  significance:   string
  recommendation: string
  confidence:     'high' | 'medium' | 'low'
  evidence:       Evidence[]
}

export interface BrandGapResult {
  brand:     { name: string; website: string; market: string }
  stated:    StatedIdentity
  described: { traits: DescribedTrait[]; pressCount: number; assistantsAsked: number }
  divergences: Divergence[]
  /** The draft profile a claim writes into the brand's empty fields. Never
   *  overwrites anything already configured; see importBrandGap. */
  profile:   {
    category:     string | null
    brandValues:  string[]
    brandVoice:   { adjectives: string[]; tone: string }
    targetSegments: Array<{ name: string; demographics: string; geography: string }>
  }
  report:    ToolReport
}

const ABOUT_PATTERNS = [/\/about/i, /who-we-are/i, /our-story/i, /\/company/i, /\/mission/i, /\/values/i]

export interface BrandGapInput {
  brandName: string
  website:   string
  market?:   string | null
}

export type BrandGapOutcome =
  | { ok: true; result: BrandGapResult }
  | {
      ok: false
      reason: 'bad_url' | 'site_unreadable' | 'nothing_stated' | 'no_description'
      note: string
      coverage: CoverageNote[]
    }

export async function runBrandGap(input: BrandGapInput): Promise<BrandGapOutcome> {
  const site = normaliseUrl(input.website)
  if (!site) {
    return { ok: false, reason: 'bad_url', note: 'That address did not parse as a website.', coverage: [] }
  }
  const name   = input.brandName.trim()
  const market = (input.market ?? '').trim() || 'Nigeria'
  const coverage: CoverageNote[] = []

  /* ── 1. What they say ──────────────────────────────────────────────────
     The homepage, plus the about and values pages when they link to them.
     Those are paths we guessed rather than ones the visitor handed us, so
     robots.txt decides whether we may read them. */
  const home = await fetchPublic(site)
  if (!home.ok) {
    coverage.push({ source: `${site.hostname} homepage`, read: false, note: failureSentence(home.failure) })
    return {
      ok: false,
      reason: 'site_unreadable',
      note: `We could not read ${site.hostname}. ${failureSentence(home.failure)} Without your own pages there is no stated identity to compare anything against, so there is nothing we could tell you honestly here.`,
      coverage,
    }
  }
  const homeFacts = readPage(home.body, home.url)
  coverage.push({ source: `${site.hostname} homepage`, read: true })

  const origin    = new URL(home.url).origin
  const disallows = await robotsDisallows(origin)
  const aboutLinks = findSectionLinks(homeFacts, ABOUT_PATTERNS, 2)
    .filter(u => { try { return pathAllowed(new URL(u).pathname, disallows) } catch { return false } })

  const pages: PageFacts[] = [homeFacts]
  for (const link of aboutLinks) {
    const res = await fetchPublic(link)
    const label = `${new URL(link).pathname} on ${site.hostname}`
    if (res.ok) {
      pages.push(readPage(res.body, res.url))
      coverage.push({ source: label, read: true })
    } else {
      coverage.push({ source: label, read: false, note: failureSentence(res.failure) })
    }
  }
  if (!aboutLinks.length) {
    coverage.push({
      source: `About and values pages on ${site.hostname}`,
      read: false,
      note: disallows.length ? 'Not linked from the homepage, or excluded by their robots.txt.' : 'Not linked from the homepage.',
    })
  }

  const stated = await readStated({ name, market, pages })
  if (!stated || (!stated.audience && !stated.promise && stated.values.length === 0)) {
    return {
      ok: false,
      reason: 'nothing_stated',
      note: `We read ${pages.length} ${pages.length === 1 ? 'page' : 'pages'} on ${site.hostname} and could not find a stated identity: no audience, no promise, no values in your own words. That is a finding on its own, and it is the one to fix first. The market cannot repeat a position you have not put anywhere it can read.`,
      coverage,
    }
  }

  /* ── 2. What the market says ───────────────────────────────────────────
     The press first, in two reads: the ten Nigerian outlets, and a wider
     query for a brand whose coverage never reaches a Nigerian masthead. */
  const [nigerian, general] = await Promise.all([
    fetchGoogleNewsRss(pressQuery(name)),
    fetchGoogleNewsRss(`"${name}" ${market}`),
  ])

  coverage.push({
    source: 'Nigerian business press',
    read: nigerian.ok,
    note: nigerian.ok ? undefined : 'The news feed did not answer, so press coverage is missing from this reading.',
  })
  coverage.push({
    source: 'Wider business news',
    read: general.ok,
    note: general.ok ? undefined : 'The news feed did not answer.',
  })

  const first = name.toLowerCase().split(/\s+/)[0]
  const seen = new Set<string>()
  const press: RssItem[] = [...nigerian.items, ...general.items].filter(item => {
    const key = item.link.split('?')[0]
    if (seen.has(key)) return false
    seen.add(key)
    // A story that does not name them describes somebody else.
    return item.title.toLowerCase().includes(first)
  }).slice(0, 20)

  // Then the assistants, asked the plainest version of the question a buyer
  // would ask. Each configured platform answers once; none of them is named.
  const platforms = configuredAssistants()
  const question = `What is ${name}? Who is it for, what is it known for, and how would you describe it to someone in ${market} who has not heard of it? If you do not know this brand, say exactly that and nothing else.`
  const answers = (await Promise.all(platforms.map(async p => {
    const text = await queryAssistant(p, question, { maxTokens: 500 })
    return text?.trim() ? text.trim() : null
  }))).filter((a): a is string => a !== null && !looksLikeNotKnown(a))

  coverage.push({
    source: platforms.length
      ? `What AI assistants answer when asked about ${name} (${platforms.length} asked)`
      : 'What AI assistants answer about this brand',
    read: answers.length > 0,
    note: platforms.length === 0
      ? 'No assistant is configured on this deployment, so this reading is press only.'
      : answers.length === 0
        ? 'Every assistant we asked said it does not know this brand. That is itself part of the finding below.'
        : undefined,
  })

  if (!press.length && !answers.length) {
    return {
      ok: false,
      reason: 'no_description',
      note: `We read your site and found what you say about yourselves. Then we looked for anyone else saying it, and found nothing: no press coverage naming ${name}, and no AI assistant that knows the brand. There is no perception gap here because there is no perception yet. Everything the market knows about you, it knows from pages you control, so the work is earned coverage and third-party mentions, not repositioning.`,
      coverage,
    }
  }

  /* ── 3. The gap ────────────────────────────────────────────────────────── */
  const { traits, divergences } = await readGap({ name, market, stated, press, answers })

  if (!divergences.length) {
    return {
      ok: false,
      reason: 'no_description',
      note: `We read your site, ${press.length} press ${press.length === 1 ? 'story' : 'stories'} and ${answers.length} assistant ${answers.length === 1 ? 'answer' : 'answers'}, and could not establish a gap we would stand behind. The outside coverage says too little about who you are for a comparison to mean anything. We would rather tell you that than name a divergence we cannot evidence.`,
      coverage,
    }
  }

  const report = buildReport({ name, host: site.hostname, stated, divergences, pressCount: press.length, assistants: answers.length, coverage })

  return {
    ok: true,
    result: {
      brand:     { name, website: home.url, market },
      stated,
      described: { traits, pressCount: press.length, assistantsAsked: platforms.length },
      divergences,
      profile: {
        category:       stated.category,
        brandValues:    stated.values.map(v => v.label).slice(0, 6),
        brandVoice:     { adjectives: stated.voice.adjectives.slice(0, 6), tone: stated.voice.tone ?? '' },
        targetSegments: stated.segments.slice(0, 3),
      },
      report,
    },
  }
}

/** An assistant that does not know the brand is a real reading, but it is not
 *  a description, so it must not be handed to the gap pass as one. */
export function looksLikeNotKnown(answer: string): boolean {
  const head = answer.toLowerCase().slice(0, 300)
  return /\b(i (do not|don't) (know|have)|no (information|record|knowledge)|not familiar|could not find|unable to find|does not appear to be a (well[- ]known|widely))\b/.test(head)
}

/* ── Pass one: their own words ──────────────────────────────────────────── */

const STATED_SYSTEM = `You are a brand strategist reading a company's own website to write down what that company says about itself. You are not evaluating it and not improving it. You are recording it.

Rules you must not break:

1. Every value you list must carry a quote copied word for word from the text you were given. If you cannot copy a sentence that supports it, leave the value out.
2. Never write down something the pages do not say. An empty field is correct when the pages are silent. Do not fill audience or promise with a plausible guess.
3. Quotes are verbatim and under 200 characters. Do not tidy them, translate them or join two sentences together.
4. The audience is who they say they serve, in their words. The promise is what they say they do for that audience.
5. Plain English. Active voice. No em dashes. Never use the words delve, underscore, pivotal, crucial, robust, vibrant, leverage, seamless or tapestry.

category must be exactly one of: Fintech, FMCG, Telco, Fashion & Apparel, Healthcare, Education, Entertainment & Media, Retail, Real Estate, Logistics, Food & Beverage, Automotive, Other.

Return ONLY valid JSON, no preamble and no markdown fence:
{"audience":"","promise":"","category":"Other","values":[{"label":"","quote":""}],"voiceAdjectives":[],"tone":"","segments":[{"name":"","demographics":"","geography":""}]}`

interface StatedModel {
  audience?: string
  promise?: string
  category?: string
  values?: Array<{ label?: string; quote?: string }>
  voiceAdjectives?: string[]
  tone?: string
  segments?: Array<{ name?: string; demographics?: string; geography?: string }>
}

const CATEGORIES = [
  'Fintech', 'FMCG', 'Telco', 'Fashion & Apparel', 'Healthcare', 'Education',
  'Entertainment & Media', 'Retail', 'Real Estate', 'Logistics', 'Food & Beverage',
  'Automotive', 'Other',
]

/** Loose containment: the model reflows whitespace and smart quotes even when
 *  told to copy, and rejecting a real quote over a curly apostrophe would cost
 *  more than it protects. Everything else must genuinely be on the page. */
function quotedInPages(quote: string, haystack: string): boolean {
  const flat = (s: string) => s
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const needle = flat(quote)
  if (needle.length < 12) return false
  return flat(haystack).includes(needle)
}

export async function readStated(args: { name: string; market: string; pages: PageFacts[] }): Promise<StatedIdentity | null> {
  const corpus = args.pages
    .map(p => `PAGE ${p.url}\nTitle: ${p.title ?? ''}\n${p.text.slice(0, 3000)}`)
    .join('\n\n')

  let parsed: StatedModel
  try {
    const raw = await callAi({
      tier: 'structural',
      system: STATED_SYSTEM,
      messages: [{ role: 'user', content: `Brand: ${args.name}\nMarket: ${args.market}\n\n${corpus}` }],
      maxTokens: 1800,
      temperature: 0.1,
    })
    parsed = extractJson<StatedModel>(raw)
  } catch (err) {
    console.error('[brand-gap] stated identity read failed:', err)
    return null
  }

  const haystack = args.pages.map(p => `${p.title ?? ''} ${p.text}`).join(' ')
  const sourceUrl = args.pages[0]?.url ?? ''

  const values: StatedTrait[] = (parsed.values ?? []).flatMap(v => {
    const label = v.label?.trim()
    const quote = v.quote?.trim().slice(0, 200)
    // A value whose supporting quote is not on the page is a value the model
    // wrote. Dropped, not softened.
    if (!label || !quote || !quotedInPages(quote, haystack)) return []
    return [{ label, quote, sourceUrl }]
  }).slice(0, 6)

  const category = CATEGORIES.includes(parsed.category ?? '') ? parsed.category! : null

  return {
    audience: parsed.audience?.trim() || null,
    promise:  parsed.promise?.trim() || null,
    category: category === 'Other' ? null : category,
    values,
    voice: {
      adjectives: (parsed.voiceAdjectives ?? []).map(a => String(a).trim()).filter(Boolean).slice(0, 6),
      tone:       parsed.tone?.trim() || null,
    },
    segments: (parsed.segments ?? []).flatMap(s => {
      const name = s.name?.trim()
      return name ? [{ name, demographics: s.demographics?.trim() ?? '', geography: s.geography?.trim() ?? '' }] : []
    }).slice(0, 3),
    pagesRead: args.pages.map(p => p.url),
  }
}

/* ── Pass two: the outside, and the distance ────────────────────────────── */

const GAP_SYSTEM = `You are a brand strategist in Lagos. You are given what a brand says about itself, and a numbered list of outside sources: press stories, and answers an AI assistant gave when asked about the brand. Your job is to say how the outside description differs from the stated one.

Rules you must not break:

1. Every attribute you record from the outside must cite exactly one numbered source, and you report that source's number. No number, no attribute.
2. "quote" must be copied word for word from that source, under 200 characters.
3. Never state a market share, a customer count, a revenue figure, a sentiment percentage or a growth rate. If a source states one, you may quote it as that source's claim and nothing more.
4. A divergence is one of four kinds:
   missing      - the brand says this about itself and no outside source repeats it.
   contradicted - an outside source describes the brand in a way that conflicts with what the brand says.
   unclaimed    - outside sources describe the brand as something the brand never says about itself.
   aligned      - the brand says it and outside sources say it too.
   For "missing" you may cite no sources, because absence is the evidence. Every other kind must cite at least one.
5. At most four divergences, and at most one of them "aligned". Fewer is correct when the sources say less. An empty list is a valid answer and better than a padded one.
6. Significance says why this costs the brand something, in one or two sentences. Recommendation is one action a marketing lead could take this quarter. Both are your reading, not a measurement.
7. Plain English. Active voice. No em dashes. Never use the words delve, underscore, pivotal, crucial, robust, vibrant, leverage, seamless or tapestry.

Confidence: high when several sources say the same thing, medium when one does, low when you are reading between the lines.

Return ONLY valid JSON, no preamble and no markdown fence:
{"described":[{"source":1,"attribute":"","quote":""}],"divergences":[{"kind":"unclaimed","stated":"","described":"","significance":"","recommendation":"","sources":[1],"confidence":"medium"}]}`

interface GapModel {
  described?: Array<{ source?: number; attribute?: string; quote?: string }>
  divergences?: Array<{
    kind?: string; stated?: string; described?: string
    significance?: string; recommendation?: string; sources?: number[]; confidence?: string
  }>
}

export async function readGap(args: {
  name: string
  market: string
  stated: StatedIdentity
  press: RssItem[]
  answers: string[]
}): Promise<{ traits: DescribedTrait[]; divergences: Divergence[] }> {
  type Source =
    | { kind: 'press'; item: RssItem }
    | { kind: 'assistant'; text: string }

  const sources: Source[] = [
    ...args.press.map(item => ({ kind: 'press' as const, item })),
    ...args.answers.map(text => ({ kind: 'assistant' as const, text })),
  ]

  const listed = sources.map((s, i) => {
    const n = i + 1
    if (s.kind === 'press') {
      return `[${n}] PRESS · ${publicationFromUrl(s.item.link)} · published ${parsePubDate(s.item.pubDate)}\nHeadline: ${s.item.title}\nExtract: ${s.item.snippet}`
    }
    return `[${n}] AI ASSISTANT ANSWER (asked today: what is this brand, who is it for, what is it known for)\n${s.text.slice(0, 1800)}`
  }).join('\n\n')

  const statedBlock = [
    args.stated.audience ? `Who they say they serve: ${args.stated.audience}` : 'They do not say who they serve.',
    args.stated.promise  ? `What they say they do: ${args.stated.promise}`    : 'They do not say what they do for that audience.',
    args.stated.values.length
      ? `Values they lead with, each with their own words:\n${args.stated.values.map(v => `- ${v.label}: "${v.quote}"`).join('\n')}`
      : 'They name no values.',
    args.stated.voice.tone ? `The tone they write in: ${args.stated.voice.tone}` : null,
  ].filter(Boolean).join('\n')

  const user = `Brand: ${args.name}\nMarket: ${args.market}\n\nWHAT THE BRAND SAYS ABOUT ITSELF (from its own website)\n\n${statedBlock}\n\nOUTSIDE SOURCES\n\n${listed}`

  let parsed: GapModel
  try {
    const raw = await callAi({
      tier: 'structural',
      system: GAP_SYSTEM,
      messages: [{ role: 'user', content: user }],
      maxTokens: 3000,
    })
    parsed = extractJson<GapModel>(raw)
  } catch (err) {
    console.error('[brand-gap] gap read failed:', err)
    return { traits: [], divergences: [] }
  }

  const evidenceFor = (index: number): Evidence | null => {
    const src = sources[index - 1]
    if (!src) return null
    if (src.kind === 'press') {
      return {
        quote: src.item.snippet.slice(0, 240) || undefined,
        sourceUrl: src.item.link,
        sourceName: publicationFromUrl(src.item.link),
        publishedAt: parsePubDate(src.item.pubDate),
      }
    }
    // No URL exists for an assistant answer, and inventing one would be the
    // worst kind of fake source. The card renders it as an unlinked quote.
    return { sourceName: 'An AI assistant, asked today', publishedAt: null }
  }

  const traits: DescribedTrait[] = (parsed.described ?? []).flatMap(d => {
    const src = sources[Number(d.source) - 1]
    const attribute = d.attribute?.trim()
    if (!src || !attribute) return []
    return [{
      attribute,
      quote:       (d.quote ?? '').trim().slice(0, 200),
      kind:        src.kind,
      sourceUrl:   src.kind === 'press' ? src.item.link : null,
      sourceName:  src.kind === 'press' ? publicationFromUrl(src.item.link) : 'An AI assistant, asked today',
      publishedAt: src.kind === 'press' ? parsePubDate(src.item.pubDate) : null,
    }]
  }).slice(0, 8)

  const kinds: DivergenceKind[] = ['missing', 'contradicted', 'unclaimed', 'aligned']

  const divergences = (parsed.divergences ?? []).flatMap<Divergence>(d => {
    const kind = kinds.includes(d.kind as DivergenceKind) ? d.kind as DivergenceKind : 'unclaimed'
    const stated = (d.stated ?? '').trim()
    const described = (d.described ?? '').trim()
    if (!stated && !described) return []

    const cited = (d.sources ?? []).map(n => evidenceFor(Number(n))).filter((e): e is Evidence => e !== null)

    /* The one asymmetry, and it is deliberate. A claim nobody repeats is
       evidenced by the brand's own words plus the absence of anything else,
       so its evidence is the site quote. Every other kind is a claim about
       what the outside says, and without an outside source it is just an
       opinion, so it is dropped. */
    if (kind === 'missing') {
      const own = args.stated.values.find(v => v.label.toLowerCase() === stated.toLowerCase())
        ?? args.stated.values[0]
      const evidence: Evidence[] = own
        ? [{ quote: own.quote, sourceUrl: own.sourceUrl, sourceName: 'Their own website' }]
        : []
      if (!evidence.length) return []
      return [{
        kind, stated, described: described || 'No outside source we read repeats this.',
        significance:   (d.significance ?? '').trim(),
        recommendation: (d.recommendation ?? '').trim(),
        confidence:     normaliseConfidence(d.confidence),
        evidence,
      }]
    }

    if (!cited.length) return []
    return [{
      kind, stated, described,
      significance:   (d.significance ?? '').trim(),
      recommendation: (d.recommendation ?? '').trim(),
      confidence:     normaliseConfidence(d.confidence),
      evidence:       cited.slice(0, 3),
    }]
  }).slice(0, 4)

  return { traits, divergences }
}

function normaliseConfidence(value: string | undefined): 'high' | 'medium' | 'low' {
  return value === 'high' || value === 'low' ? value : 'medium'
}

/* ── The report a marketer reads ────────────────────────────────────────── */

function buildReport(args: {
  name: string
  host: string
  stated: StatedIdentity
  divergences: Divergence[]
  pressCount: number
  assistants: number
  coverage: CoverageNote[]
}): ToolReport {
  const { name, stated, divergences, pressCount, assistants } = args

  const findings: Finding[] = divergences.map(d => ({
    title: d.kind === 'unclaimed'
      ? `The market calls you ${lower(d.described)}. You never say it.`
      : d.kind === 'missing'
        ? `You lead with ${lower(d.stated)}. Nothing outside repeats it.`
        : d.kind === 'contradicted'
          ? `You say ${lower(d.stated)}. The coverage says ${lower(d.described)}.`
          : `You say ${lower(d.stated)}, and the market agrees.`,
    detail: d.kind === 'aligned' || !d.described ? undefined : d.described,
    significance: [d.significance, d.recommendation].filter(Boolean).join(' '),
    // The quote is observed. The reading of what the distance costs is marked
    // separately on the card, which is why significance carries it.
    provenance: 'observed',
    confidence: d.confidence,
    tag: DIVERGENCE_LABEL[d.kind],
    evidence: d.evidence,
  }))

  const heard = divergences.filter(d => d.kind === 'unclaimed').length
  const unheard = divergences.filter(d => d.kind === 'missing').length

  const summary = [
    `We read what ${name} says about itself on ${args.host}, then read ${pressCount} press ${pressCount === 1 ? 'story' : 'stories'}${assistants ? ` and ${assistants} AI assistant ${assistants === 1 ? 'answer' : 'answers'}` : ''} to see how the market describes you back.`,
    unheard ? `${unheard === 1 ? 'One thing you lead with is' : `${unheard} things you lead with are`} not coming back to you from anywhere outside.` : null,
    heard ? `${heard === 1 ? 'One attribute' : `${heard} attributes`} the market gives you ${heard === 1 ? 'is' : 'are'} nowhere in your own words.` : null,
    'Each one below carries what the source actually said.',
  ].filter(Boolean).join(' ')

  const strongest = divergences.find(d => d.kind !== 'aligned') ?? divergences[0]

  return {
    title: 'Your Brand Perception Gap',
    summary,
    findings,
    nextAction: strongest?.recommendation
      || `Take the gap above to whoever owns your messaging. The fastest fix is usually to say the thing the market already believes about you, in your own words, where a buyer reads it first.`,
    coverage: args.coverage,
    limitations: [
      'This reads public sources only: your own website, the business press, and what an AI assistant answers. It is not research with your customers, and it cannot tell you what people think and never write down.',
      `Press coverage comes from a free public news feed across ten Nigerian outlets plus wider business news. It is a good read of what was written about ${name} and not a complete one.`,
      'An AI assistant describes a brand from what it was trained on and what it can retrieve. It is a useful proxy for the public description of you, and it is not a survey of your market.',
      'There are no numbers in this report because there are none to measure here. Nothing above is a share, a sentiment score or a reach figure, and none has been estimated.',
      stated.values.length
        ? 'What you say about yourself is taken from the pages we could read. A position that lives in a deck, a brief or an ad we cannot see is not in this comparison.'
        : 'We found no stated values on the pages we could read, so the comparison rests on your audience and promise alone.',
    ],
    generatedAt: new Date().toISOString(),
  }
}

function lower(s: string): string {
  const t = s.trim().replace(/\.$/, '')
  if (!t) return 'this'
  // Leave an acronym or a proper noun alone; only drop a sentence capital.
  return /^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t
}
