import { createHash } from 'crypto'
import { callAi, extractJson } from '@/lib/ai/client'
import { fetchGoogleNewsRss, pressQuery, publicationFromUrl, parsePubDate, type RssItem } from '@/lib/press/nigerian-press'
import { fetchPublic, failureSentence, normaliseUrl, rootHost, robotsDisallows, pathAllowed } from './fetch-public'
import { findSectionLinks, readPage, type PageFacts } from './html'
import type { CoverageNote, Finding, ToolReport } from './report'
import { MOVE_LABEL, type MoveCategory } from './moves'

/**
 * The Competitor Move Tracker.
 *
 * The question it answers is "what has this competitor done that I should know
 * about", and the only honest way to answer it for free is to read what the
 * competitor published and what the press wrote. So that is what this does:
 * their own site, their own pricing and newsroom pages, and thirty days of
 * Nigerian business press through the same Google News feed the PR Scoreboard
 * already runs on. No credentials, nothing scraped that asks not to be.
 *
 * Two rules shape the whole module, and they are the difference between this
 * and a plausible-sounding fabrication:
 *
 *   A development with no source URL is not stored and not shown.
 *
 *   A page that exists today is not evidence that something launched
 *   recently. Without a historical snapshot we cannot know when a product
 *   page appeared, so a site page can only support a claim about what is true
 *   now ("they list a free tier at ₦0") and never about what changed. Dated
 *   press and dated announcements are what carry a change claim.
 *
 * The first run also records hashes of the home and pricing pages. That is
 * the baseline the monitoring job diffs against later, which is how a change
 * claim becomes available at all — and it is still labelled as a detected
 * website change rather than as an announcement.
 */

export { MOVE_LABEL, type MoveCategory } from './moves'

export interface CompetitorMove {
  category:     MoveCategory
  headline:     string
  significance: string
  implication:  string
  sourceUrl:    string
  sourceKind:   'press' | 'announcement' | 'site_page' | 'site_change'
  sourceName:   string
  quote:        string
  publishedAt:  string | null
  confidence:   'high' | 'medium' | 'low'
  fingerprint:  string
}

export interface CompetitorTrackerResult {
  competitor: { name: string; website: string; market: string | null }
  you:        { name: string | null; website: string }
  moves:      CompetitorMove[]
  /** Page hashes, so a later run can tell a changed page from an unchanged one. */
  hashes:     { home: string | null; pricing: string | null }
  report:     ToolReport
}

const hash = (s: string) => createHash('sha256').update(s).digest('hex')

/** One development, identified stably enough that a second crawl of the same
 *  story updates the row instead of adding a near-duplicate. */
function fingerprint(category: string, sourceUrl: string, headline: string): string {
  let key = sourceUrl
  try {
    const u = new URL(sourceUrl)
    // Drop the query: news URLs carry utm and session junk that would make the
    // same article look new every week.
    key = `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}`
  } catch { /* keep the raw string */ }
  return hash(`${category}|${key}|${headline.toLowerCase().slice(0, 80)}`).slice(0, 40)
}

/** The competitor's own name for itself, which is what the press will use.
 *  og:site_name, then the title before its separator, then the domain. */
function nameFrom(facts: PageFacts | null, website: string): string {
  const title = facts?.title ?? ''
  const fromTitle = title.split(/[|–—\-–—·:]/)[0].trim()
  if (fromTitle && fromTitle.length >= 2 && fromTitle.length <= 40) return fromTitle
  const host = rootHost(new URL(website).hostname)
  const bare = host.split('.')[0]
  return bare.charAt(0).toUpperCase() + bare.slice(1)
}

const PRICING_PATTERNS = [/pricing/i, /\/plans?/i, /\/price/i, /tariff/i, /fees/i]
const NEWS_PATTERNS    = [/\/news/i, /\/press/i, /newsroom/i, /\/blog/i, /announcement/i, /media-cent/i, /\/updates?/i]

/** Thirty days. Older than that is not a move anybody needs to react to. */
const WINDOW_DAYS = 30

function withinWindow(pubDate: string): boolean {
  const d = new Date(pubDate)
  if (Number.isNaN(d.getTime())) return true     // undated: let the model judge
  return Date.now() - d.getTime() <= WINDOW_DAYS * 24 * 60 * 60 * 1000
}

export interface TrackerInput {
  yourWebsite:       string
  competitorWebsite: string
  market?:           string | null
}

export type TrackerOutcome =
  | { ok: true; result: CompetitorTrackerResult }
  | { ok: false; reason: 'bad_competitor_url' | 'competitor_unreadable' | 'no_evidence'; note: string; coverage: CoverageNote[] }

export async function runCompetitorTracker(input: TrackerInput): Promise<TrackerOutcome> {
  const compUrl = normaliseUrl(input.competitorWebsite)
  const yourUrl = normaliseUrl(input.yourWebsite)
  if (!compUrl) {
    return { ok: false, reason: 'bad_competitor_url', note: 'That competitor address did not parse as a website.', coverage: [] }
  }

  const coverage: CoverageNote[] = []

  // ── 1. Their site ─────────────────────────────────────────────────────────
  const compHome = await fetchPublic(compUrl)
  if (!compHome.ok) {
    coverage.push({ source: `${compUrl.hostname} homepage`, read: false, note: failureSentence(compHome.failure) })
    return {
      ok: false,
      reason: 'competitor_unreadable',
      note: `We could not read ${compUrl.hostname}. ${failureSentence(compHome.failure)} Some sites refuse requests from servers; the press search below is unaffected, so try again or check the address.`,
      coverage,
    }
  }
  const compFacts = readPage(compHome.body, compHome.url)
  coverage.push({ source: `${compUrl.hostname} homepage`, read: true })

  const competitorName = nameFrom(compFacts, compHome.url)

  // Their own pricing and newsroom pages, if they publish them. These are
  // paths we guessed at rather than ones the visitor handed us, so robots.txt
  // is honoured for them.
  const origin = new URL(compHome.url).origin
  const disallows = await robotsDisallows(origin)
  const candidates = [
    ...findSectionLinks(compFacts, PRICING_PATTERNS, 1),
    ...findSectionLinks(compFacts, NEWS_PATTERNS, 2),
  ].filter(u => {
    try { return pathAllowed(new URL(u).pathname, disallows) } catch { return false }
  })

  const sectionPages: { url: string; facts: PageFacts; kind: 'pricing' | 'news' }[] = []
  for (const candidate of candidates) {
    const kind: 'pricing' | 'news' = PRICING_PATTERNS.some(p => p.test(candidate)) ? 'pricing' : 'news'
    const res = await fetchPublic(candidate)
    if (res.ok) {
      sectionPages.push({ url: res.url, facts: readPage(res.body, res.url), kind })
      coverage.push({ source: `${new URL(candidate).pathname} on ${compUrl.hostname}`, read: true })
    } else {
      coverage.push({ source: `${new URL(candidate).pathname} on ${compUrl.hostname}`, read: false, note: failureSentence(res.failure) })
    }
  }
  if (!candidates.length) {
    coverage.push({
      source: `Pricing and newsroom pages on ${compUrl.hostname}`,
      read: false,
      note: disallows.length ? 'Not linked from the homepage, or excluded by their robots.txt.' : 'Not linked from the homepage.',
    })
  }

  // ── 2. The press ──────────────────────────────────────────────────────────
  // Two reads. The ten Nigerian outlets are where a move in this market gets
  // written up; the unrestricted query catches a global competitor whose news
  // never reaches a Nigerian masthead.
  const [nigerian, general] = await Promise.all([
    fetchGoogleNewsRss(pressQuery(competitorName)),
    fetchGoogleNewsRss(`"${competitorName}"${input.market ? ` ${input.market}` : ''}`),
  ])

  coverage.push({
    source: 'Nigerian business press, last 30 days',
    read: nigerian.ok,
    note: nigerian.ok ? undefined : 'The news feed did not answer, so press coverage is missing from this brief.',
  })
  coverage.push({
    source: 'Wider business news',
    read: general.ok,
    note: general.ok ? undefined : 'The news feed did not answer.',
  })

  const seen = new Set<string>()
  const press: RssItem[] = [...nigerian.items, ...general.items].filter(item => {
    if (!withinWindow(item.pubDate)) return false
    const key = item.link.split('?')[0]
    if (seen.has(key)) return false
    seen.add(key)
    // A story has to actually name them. Google News is generous with
    // adjacent coverage and a brief full of near-misses is worse than a short
    // one.
    return item.title.toLowerCase().includes(competitorName.toLowerCase().split(/\s+/)[0])
  }).slice(0, 25)

  // ── 3. Your site, for the "what this means for you" half ──────────────────
  let yourFacts: PageFacts | null = null
  if (yourUrl) {
    const yours = await fetchPublic(yourUrl)
    if (yours.ok) {
      yourFacts = readPage(yours.body, yours.url)
      coverage.push({ source: `${yourUrl.hostname} homepage, for context`, read: true })
    } else {
      coverage.push({ source: `${yourUrl.hostname} homepage, for context`, read: false, note: failureSentence(yours.failure) })
    }
  }

  // Nothing to reason over. Say so rather than asking a model to invent three
  // developments from a homepage.
  if (!press.length && !sectionPages.length) {
    return {
      ok: false,
      reason: 'no_evidence',
      note: `We read ${compUrl.hostname} but found no dated announcements and no press coverage of ${competitorName} in the last ${WINDOW_DAYS} days. That is a finding in itself: whatever they are doing, they are not publicising it. Nothing here is worth inventing to fill the gap.`,
      coverage,
    }
  }

  // ── 4. Classify, with the evidence in front of the model ──────────────────
  const moves = await classifyMoves({ competitorName, compFacts, sectionPages, press, yourFacts, market: input.market ?? null })

  const hashes = {
    home:    hash(compFacts.text),
    pricing: sectionPages.find(p => p.kind === 'pricing') ? hash(sectionPages.find(p => p.kind === 'pricing')!.facts.text) : null,
  }

  const report = buildReport({ competitorName, host: compUrl.hostname, moves, coverage, pressCount: press.length, market: input.market ?? null })

  return {
    ok: true,
    result: {
      competitor: { name: competitorName, website: compHome.url, market: input.market ?? null },
      you:        { name: yourFacts ? nameFrom(yourFacts, yourUrl!.toString()) : null, website: yourUrl?.toString() ?? input.yourWebsite },
      moves,
      hashes,
      report,
    },
  }
}

/* ── The model's part ───────────────────────────────────────────────────────
   Everything it may cite is numbered and handed to it, and it answers with
   the number rather than a URL, so a hallucinated source cannot survive: an
   index outside the list is dropped on the way back. That is a cheaper and
   stricter guard than asking it nicely not to invent links. */

export interface ClassifyArgs {
  competitorName: string
  compFacts:      PageFacts
  sectionPages:   { url: string; facts: PageFacts; kind: 'pricing' | 'news' }[]
  press:          RssItem[]
  yourFacts:      PageFacts | null
  market:         string | null
}

interface ModelMove {
  source:       number
  category:     string
  headline:     string
  significance: string
  implication:  string
  quote:        string
  confidence:   string
}

const SYSTEM = `You are a competitive intelligence analyst briefing a marketing director in Lagos. You are given a numbered list of sources about one competitor: dated press stories, and pages from the competitor's own website. Your job is to pick the developments that a marketing director would genuinely need to know about, and to say what each one means for the brand you are briefing.

Rules you must not break:

1. Every development must come from exactly one numbered source, and you report that source's number. If you cannot point at a source, the development does not exist.
2. A website page proves what is true now. It never proves when something changed. So a page from the competitor's own site may support "they now offer X" or "they price X at Y", and may never support "they recently launched X" or "they have changed their pricing" unless that page itself carries a date or says so.
3. Dated press stories can support a change claim. Use the date.
4. Do not report routine marketing, a careers page, a blog post with no news in it, or a story that merely mentions the competitor in passing.
5. Significance and implication are your reading of the evidence, written plainly. Never state a number, a market share, a revenue figure or a customer count that is not in the source.
6. At most three developments. Fewer is correct when fewer are significant. An empty list is a valid answer.
7. Write in plain English. Active voice. No em dashes. Never use the words delve, underscore, pivotal, crucial, robust, vibrant, leverage, seamless or tapestry.

Categories, pick the closest: product_launch, product_change, pricing, partnership, expansion, positioning, company.

Confidence: high when a dated source states it outright; medium when the source implies it; low when you are reading between the lines.

Return ONLY valid JSON, no preamble and no markdown fence:
{"moves":[{"source":1,"category":"pricing","headline":"","significance":"","implication":"","quote":"","confidence":"high"}]}

"quote" must be a short verbatim extract from that source, under 240 characters.`

export async function classifyMoves(args: ClassifyArgs): Promise<CompetitorMove[]> {
  // The numbered source list. Index is 1-based for the model's benefit.
  type Source =
    | { kind: 'press'; item: RssItem }
    | { kind: 'site'; url: string; label: string; text: string; dated: boolean }

  const sources: Source[] = [
    ...args.press.map(item => ({ kind: 'press' as const, item })),
    ...args.sectionPages.map(p => ({
      kind: 'site' as const,
      url: p.url,
      label: p.kind === 'pricing' ? 'their pricing page' : 'their newsroom or blog',
      text: p.facts.text.slice(0, 2500),
      dated: false,
    })),
    {
      kind: 'site' as const,
      url: args.compFacts.url,
      label: 'their homepage',
      text: args.compFacts.text.slice(0, 2000),
      dated: false,
    },
  ]

  const listed = sources.map((s, i) => {
    const n = i + 1
    if (s.kind === 'press') {
      return `[${n}] PRESS · ${publicationFromUrl(s.item.link)} · published ${parsePubDate(s.item.pubDate)}\nHeadline: ${s.item.title}\nExtract: ${s.item.snippet}`
    }
    return `[${n}] WEBSITE PAGE (undated — proves what is true now, not what changed) · ${s.label} · ${s.url}\nExtract: ${s.text}`
  }).join('\n\n')

  const you = args.yourFacts
    ? `The brand being briefed, from its own homepage:\n"""${args.yourFacts.text.slice(0, 1200)}"""`
    : 'We could not read the briefed brand\'s website, so keep the implication general.'

  const user = `Competitor: ${args.competitorName}\n${args.market ? `Market of interest: ${args.market}\n` : ''}\n${you}\n\nSOURCES\n\n${listed}`

  let parsed: { moves?: ModelMove[] }
  try {
    const raw = await callAi({
      tier: 'structural',
      system: SYSTEM,
      messages: [{ role: 'user', content: user }],
      maxTokens: 3000,
    })
    parsed = extractJson<{ moves?: ModelMove[] }>(raw)
  } catch (err) {
    console.error('[competitor-tracker] classification failed:', err)
    return []
  }

  const valid: MoveCategory[] = ['product_launch', 'product_change', 'pricing', 'partnership', 'expansion', 'positioning', 'company']

  return (parsed.moves ?? []).flatMap<CompetitorMove>(m => {
    const src = sources[Number(m.source) - 1]
    // A source index the model made up. Dropped, not repaired.
    if (!src) return []
    if (!m.headline?.trim()) return []
    const category = valid.includes(m.category as MoveCategory) ? (m.category as MoveCategory) : 'company'
    const confidence = ['high', 'medium', 'low'].includes(m.confidence) ? m.confidence as 'high' | 'medium' | 'low' : 'medium'

    const sourceUrl  = src.kind === 'press' ? src.item.link : src.url
    const sourceName = src.kind === 'press' ? publicationFromUrl(src.item.link) : `${args.competitorName} website`
    const publishedAt = src.kind === 'press' ? parsePubDate(src.item.pubDate) : null

    /* An undated website page cannot carry a claim about change, whatever the
       model decided. Rather than drop a genuine observation, the category is
       demoted to the thing the source actually supports. */
    const demoted: MoveCategory = src.kind === 'site' && (category === 'product_launch' || category === 'product_change')
      ? 'positioning'
      : category

    return [{
      category:     demoted,
      headline:     m.headline.trim().slice(0, 300),
      significance: (m.significance ?? '').trim(),
      implication:  (m.implication ?? '').trim(),
      sourceUrl,
      sourceKind:   src.kind === 'press' ? 'press' : 'site_page',
      sourceName,
      quote:        (m.quote ?? '').trim().slice(0, 240),
      publishedAt,
      // A site page is never high confidence about a development, because its
      // date is unknown.
      confidence:   src.kind === 'site' && confidence === 'high' ? 'medium' : confidence,
      fingerprint:  fingerprint(demoted, sourceUrl, m.headline),
    }]
  }).slice(0, 3)
}

/* ── The brief a marketer reads ─────────────────────────────────────────── */

function buildReport(args: {
  competitorName: string
  host: string
  moves: CompetitorMove[]
  coverage: CoverageNote[]
  pressCount: number
  market: string | null
}): ToolReport {
  const { competitorName, moves, coverage, pressCount } = args

  const findings: Finding[] = moves.map(m => ({
    title: m.headline,
    detail: undefined,
    significance: [m.significance, m.implication].filter(Boolean).join(' '),
    // The development itself is observed: a source says it. The reading of
    // what it means is marked separately on the card.
    provenance: 'observed',
    confidence: m.confidence,
    tag: MOVE_LABEL[m.category],
    evidence: [{
      quote: m.quote || undefined,
      sourceUrl: m.sourceUrl,
      sourceName: m.sourceName,
      publishedAt: m.publishedAt,
    }],
  }))

  const summary = moves.length === 0
    ? `We read ${args.host} and ${pressCount} press ${pressCount === 1 ? 'story' : 'stories'} about ${competitorName} from the last ${WINDOW_DAYS} days, and found nothing we would call a significant move. Quiet is useful to know: it means you are not behind this month.`
    : `${competitorName} made ${moves.length} ${moves.length === 1 ? 'move' : 'moves'} in the last ${WINDOW_DAYS} days that a marketing lead should know about${moves.some(m => m.category === 'pricing') ? ', including something on price' : ''}. Each one below carries the source it came from, so you can take it into a meeting and defend it.`

  const nextAction = moves.length
    ? firstAction(moves[0], competitorName)
    : `Set a watch on ${competitorName} so the next move reaches you the week it happens rather than the month after.`

  return {
    title: 'Your Competitive Intelligence Brief',
    summary,
    findings,
    nextAction,
    coverage,
    limitations: [
      `This reads public sources only: ${competitorName}'s own website and the business press. It cannot see their ad spend, their traffic, their revenue or anything they have not published.`,
      'A page on their site proves what is true today. It cannot prove when it changed, because we have no earlier snapshot of it. Only dated press carries a change claim here.',
      `Thirty days, and only coverage that names ${competitorName} in the headline. A move written up under a parent company name may be missing.`,
      'Nigerian press coverage comes from a free public news feed across ten outlets. It is a good read of the national press and not a complete one.',
    ],
    generatedAt: new Date().toISOString(),
  }
}

function firstAction(move: CompetitorMove, name: string): string {
  switch (move.category) {
    case 'pricing':
      return `Put this price change next to yours this week, before your next campaign brief goes out. If ${name} has moved the reference price in your category, your creative is arguing against a number that has changed.`
    case 'product_launch':
    case 'product_change':
      return `Check whether this launch overlaps the segment your current campaign is targeting. If it does, your messaging needs a line on what you do that this does not.`
    case 'partnership':
      return `Work out what the partnership gives them that you lack: distribution, a payment rail, an audience. That is the gap to answer, not the announcement.`
    case 'expansion':
      return `Find out whether they are entering a market you already hold. If so, brief your field and trade teams there before their launch spend starts.`
    default:
      return `Share this with whoever owns your category plan, and set a watch so the follow-up reaches you as it happens.`
  }
}
