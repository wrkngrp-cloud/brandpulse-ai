import { createHash } from 'crypto'
import { callAi, extractJson } from '@/lib/ai/client'
import {
  fetchGoogleNewsRss, fetchOutletSearch, isWithinDays, newestFirst, pressQuery, publicationFromUrl,
  parsePubDate, recentQuery, type RssItem,
} from '@/lib/press/nigerian-press'
import { fetchPublic, failureSentence, normaliseUrl, rootHost, robotsDisallows, pathAllowed } from './fetch-public'
import { absolute, findSectionLinks, readPage, type PageFacts } from './html'
import { fetchAppStoreRelease, type AppRelease } from './app-store'
import { fetchXActivity, findXHandle, type XPost } from './x-activity'
import type { CoverageNote, Finding, ToolReport } from './report'
import { MOVE_LABEL, type MoveCategory } from './moves'

/**
 * The Competitor Move Tracker.
 *
 * The question it answers is "what has this competitor done that I should know
 * about". A marketer already knows what their competitor sells, so the answer
 * has to be what changed recently, and every source that can be cited is
 * dated: thirty days of Nigerian business press (Google News narrowed to the
 * window, plus the outlets' own feeds for the article text), the competitor's
 * latest App Store release notes, and their own posts on X this week. Their
 * website is read as context, so the model can tell new from known, and is
 * never cited as a move. Nothing scraped that asks not to be.
 *
 * Two rules shape the whole module, and they are the difference between this
 * and a plausible-sounding fabrication:
 *
 *   A development with no source URL is not stored and not shown.
 *
 *   A page that exists today is not evidence that something launched
 *   recently. So their site is context, not a source: it tells the model what
 *   is already known, and only dated sources can be cited.
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

/** Thirty days for press and app releases. X recent search only reaches back
 *  seven, which is the freshest slice we have. */
const WINDOW_DAYS = 30
const X_WINDOW_DAYS = 7

export interface TrackerInput {
  yourWebsite:       string
  competitorWebsite: string
  market?:           string | null
  /** Whether today's X allowance has room. The route holds the counter. */
  xBudgetOk?:        boolean
}

export type TrackerOutcome =
  | { ok: true; result: CompetitorTrackerResult }
  | { ok: false; reason: 'bad_competitor_url' | 'competitor_unreadable' | 'no_evidence'; note: string; coverage: CoverageNote[] }

/** A press story, from Google News or from the outlet's own feed. */
export type PressSource = RssItem & { origin: 'google' | 'outlet' }

/** Read the article behind a press link, when we can. Google News links are a
 *  script-driven redirect a server cannot follow, so a read that ends on
 *  news.google.com is treated as no read. */
async function readArticle(link: string): Promise<string | null> {
  const res = await fetchPublic(link, { timeoutMs: 6_000, maxBytes: 1_500_000 })
  if (!res.ok) return null
  try { if (new URL(res.url).hostname.endsWith('news.google.com')) return null } catch { return null }
  const facts = readPage(res.body, res.url)
  return facts.text.length > 200 ? facts.text.slice(0, 3000) : null
}

export async function runCompetitorTracker(input: TrackerInput): Promise<TrackerOutcome> {
  const compUrl = normaliseUrl(input.competitorWebsite)
  const yourUrl = normaliseUrl(input.yourWebsite)
  if (!compUrl) {
    return { ok: false, reason: 'bad_competitor_url', note: 'That competitor address did not parse as a website.', coverage: [] }
  }

  const coverage: CoverageNote[] = []

  // ── 1. Their site ─────────────────────────────────────────────────────────
  // Read for context, never cited as a move. A homepage says what they offer
  // today, which their market already knows. Handing it to the model as a
  // source is how the brief used to fill up with features everybody had seen.
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
  coverage.push({ source: `${compUrl.hostname} homepage, for what they already offer`, read: true })

  const competitorName = nameFrom(compFacts, compHome.url)
  const handle = findXHandle({ links: compFacts.links.map(l => ({ ...l, href: absolute(l.href, compHome.url) ?? l.href })) })

  // ── 2. Everything dated, at once ──────────────────────────────────────────
  // Press through Google (narrowed to the window before it ranks), press
  // straight from the outlets (with article text), their latest app release,
  // and this week on X. None of these depends on another.
  const origin = new URL(compHome.url).origin
  const [disallows, nigerian, general, outlets, app, x] = await Promise.all([
    robotsDisallows(origin),
    fetchGoogleNewsRss(recentQuery(pressQuery(competitorName), WINDOW_DAYS)),
    fetchGoogleNewsRss(recentQuery(`"${competitorName}"${input.market ? ` ${input.market}` : ''}`, WINDOW_DAYS)),
    fetchOutletSearch(competitorName, { days: WINDOW_DAYS }),
    fetchAppStoreRelease({ name: competitorName, host: compUrl.hostname, days: WINDOW_DAYS }),
    fetchXActivity({ name: competitorName, handle, budgetOk: input.xBudgetOk ?? true }),
  ])

  coverage.push({
    source: `Nigerian business press, last ${WINDOW_DAYS} days`,
    read: nigerian.ok || outlets.outletsRead > 0,
    note: nigerian.ok || outlets.outletsRead > 0 ? undefined : 'The news feeds did not answer, so press coverage is missing from this brief.',
  })
  coverage.push({
    source: 'Wider business news',
    read: general.ok,
    note: general.ok ? undefined : 'The news feed did not answer.',
  })
  coverage.push({
    source: 'App Store release notes',
    read: app.ok,
    note: app.note ? `${app.note} Google Play is not read yet.` : 'Google Play is not read yet.',
  })
  coverage.push({
    source: `X, last ${X_WINDOW_DAYS} days${handle ? ` (@${handle} and posts about them)` : ''}`,
    read: x.ok,
    note: x.note,
  })

  // Pricing and newsroom pages: context, plus the baseline hash the watch
  // diffs against later. Paths we guessed rather than were given, so
  // robots.txt is honoured.
  const candidates = [
    ...findSectionLinks(compFacts, PRICING_PATTERNS, 1),
    ...findSectionLinks(compFacts, NEWS_PATTERNS, 1),
  ].filter(u => {
    try { return pathAllowed(new URL(u).pathname, disallows) } catch { return false }
  })
  const sectionPages: { url: string; facts: PageFacts; kind: 'pricing' | 'news' }[] = []
  await Promise.all(candidates.map(async candidate => {
    const kind: 'pricing' | 'news' = PRICING_PATTERNS.some(p => p.test(candidate)) ? 'pricing' : 'news'
    const res = await fetchPublic(candidate, { timeoutMs: 6_000 })
    if (res.ok) sectionPages.push({ url: res.url, facts: readPage(res.body, res.url), kind })
  }))

  // Outlet items first: they carry the article and a direct link, so when the
  // same story comes back from both, that is the copy worth keeping.
  const first = competitorName.toLowerCase().split(/\s+/)[0]
  const seenTitles = new Set<string>()
  const seenLinks = new Set<string>()
  const pressAll: PressSource[] = [
    ...outlets.items.map(i => ({ ...i, origin: 'outlet' as const })),
    ...[...nigerian.items, ...general.items].map(i => ({ ...i, origin: 'google' as const })),
  ].filter(item => {
    if (!isWithinDays(item.pubDate, WINDOW_DAYS)) return false
    const link = item.link.split('?')[0]
    // Google appends " - Publication" to a headline; strip it to match.
    const title = item.title.replace(/\s+-\s+[^-]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (seenLinks.has(link) || seenTitles.has(title)) return false
    seenLinks.add(link); seenTitles.add(title)
    if (item.origin === 'outlet') return true
    // A Google story has to actually name them. Google News is generous with
    // adjacent coverage and a brief full of near-misses is worse than a short one.
    return item.title.toLowerCase().includes(first)
  })
  const press = newestFirst(pressAll).slice(0, 20)

  // The few newest stories without text: try for the article itself.
  await Promise.all(press.filter(p => !p.body).slice(0, 6).map(async p => {
    const text = await readArticle(p.link)
    if (text) p.body = text
  }))

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

  // Nothing dated to reason over. Say so rather than asking a model to dress
  // up a homepage as news.
  if (!press.length && !app.release && !x.own.length) {
    return {
      ok: false,
      reason: 'no_evidence',
      note: `We looked for anything ${competitorName} did recently: ${WINDOW_DAYS} days of press, their latest app release, and this week on X. None of it turned up a dated move. That is a finding in itself: whatever they are doing, they are not publicising it.`,
      coverage,
    }
  }

  // ── 4. Classify, with the evidence in front of the model ──────────────────
  const moves = await classifyMoves({
    competitorName, compFacts, sectionPages, press, yourFacts, market: input.market ?? null,
    appRelease: app.release, xOwn: x.own, xAbout: x.about,
  })

  const hashes = {
    home:    hash(compFacts.text),
    pricing: sectionPages.find(p => p.kind === 'pricing') ? hash(sectionPages.find(p => p.kind === 'pricing')!.facts.text) : null,
  }

  const report = buildReport({
    competitorName, host: compUrl.hostname, moves, coverage, market: input.market ?? null,
    counts: { press: press.length, app: app.release ? 1 : 0, xOwn: x.own.length, xAbout: x.about.length },
  })

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
   index outside the list is dropped on the way back. Only dated sources are
   numbered. Their own website goes in as unnumbered context, so the model can
   tell a new move from a feature they have had for years, and cannot cite it. */

export interface ClassifyArgs {
  competitorName: string
  compFacts:      PageFacts
  sectionPages:   { url: string; facts: PageFacts; kind: 'pricing' | 'news' }[]
  press:          (RssItem & { origin?: 'google' | 'outlet' })[]
  yourFacts:      PageFacts | null
  market:         string | null
  appRelease?:    AppRelease | null
  xOwn?:          XPost[]
  xAbout?:        XPost[]
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

const MAX_MOVES = 5

const SYSTEM = `You are a competitive intelligence analyst briefing a marketing director in Lagos. The director already knows this competitor well. They do not need to hear what the competitor sells. They need to hear what the competitor did in the last few weeks that they might have missed.

You are given:
- NUMBERED SOURCES. Every one is dated: press stories, the competitor's latest app release notes, and the competitor's own posts on X. These are the only things you may cite.
- WHAT THEY ALREADY OFFER: text from the competitor's own website. Context only. It has no number and you may never cite it.
- WHAT PEOPLE ARE SAYING ON X: recent posts by other people about the competitor. Context only. Use it to judge whether a move is landing. Never cite it.

Rules you must not break:

1. Every development must come from exactly one numbered source, and you report that source's number. If you cannot point at a numbered source, the development does not exist.
2. Recent and new only. If a source describes something the website context shows they have offered for a long time, and the source does not say it is new or changed, leave it out. A feature everyone already knows is not a move.
3. Prefer the newest sources. Open each headline with what they did, in the past tense, and be specific: name the product, the price, the partner, the city, the campaign line.
4. Campaigns count. A new campaign, ambassador, sponsorship, promo, giveaway or price offer visible in their own posts or the press is a move. Routine daily posting, customer-service replies and generic brand posts are not.
5. Release notes that only fix bugs are not a move.
6. Do not report a careers post, a story that mentions the competitor in passing, or an opinion piece with no news in it.
7. Significance and implication are your reading of the evidence, written plainly. Never state a number, a market share, a revenue figure or a customer count that is not in the source.
8. At most ${MAX_MOVES} developments, newest and most significant first. Fewer is correct when fewer are significant. An empty list is a valid answer.
9. Write in plain English. Active voice. No em dashes. Never use the words delve, underscore, pivotal, crucial, robust, vibrant, leverage, seamless or tapestry.

Categories, pick the closest: product_launch, product_change, pricing, campaign, partnership, expansion, positioning, company.

Confidence: high when a dated source states it outright; medium when the source implies it; low when you are reading between the lines.

Return ONLY valid JSON, no preamble and no markdown fence:
{"moves":[{"source":1,"category":"campaign","headline":"","significance":"","implication":"","quote":"","confidence":"high"}]}

"quote" must be a short verbatim extract from that source, under 240 characters.`

type Source =
  | { kind: 'press'; item: RssItem }
  | { kind: 'app'; release: AppRelease }
  | { kind: 'x'; post: XPost }

export function numberedSources(args: Pick<ClassifyArgs, 'press' | 'appRelease' | 'xOwn'>): Source[] {
  return [
    ...args.press.map(item => ({ kind: 'press' as const, item })),
    ...(args.appRelease ? [{ kind: 'app' as const, release: args.appRelease }] : []),
    ...(args.xOwn ?? []).slice(0, 10).map(post => ({ kind: 'x' as const, post })),
  ]
}

export async function classifyMoves(args: ClassifyArgs): Promise<CompetitorMove[]> {
  const sources = numberedSources(args)
  if (!sources.length) return []

  const listed = sources.map((s, i) => {
    const n = i + 1
    if (s.kind === 'press') {
      const text = s.item.body ? `Article: ${s.item.body.slice(0, 1800)}` : `Extract: ${s.item.snippet}`
      return `[${n}] PRESS · ${publicationFromUrl(s.item.link)} · published ${parsePubDate(s.item.pubDate)}\nHeadline: ${s.item.title}\n${text}`
    }
    if (s.kind === 'app') {
      return `[${n}] APP STORE RELEASE NOTES · ${s.release.appName} ${s.release.version} · released ${s.release.releasedAt}\nNotes: ${s.release.notes}`
    }
    return `[${n}] THEIR OWN POST ON X · @${s.post.username} · posted ${s.post.createdAt.slice(0, 10)} · ${s.post.likes} likes, ${s.post.reposts} reposts\nPost: ${s.post.text}`
  }).join('\n\n')

  const site = [
    `Homepage: ${args.compFacts.text.slice(0, 1500)}`,
    ...args.sectionPages.map(p => `${p.kind === 'pricing' ? 'Pricing page' : 'Newsroom page'}: ${p.facts.text.slice(0, 1200)}`),
  ].join('\n\n')

  const chatter = (args.xAbout ?? []).slice(0, 10)
    .map(p => `- @${p.username}, ${p.createdAt.slice(0, 10)}: ${p.text.replace(/\s+/g, ' ').slice(0, 280)}`)
    .join('\n')

  const you = args.yourFacts
    ? `The brand being briefed, from its own homepage:\n"""${args.yourFacts.text.slice(0, 1200)}"""`
    : 'We could not read the briefed brand\'s website, so keep the implication general.'

  const user = [
    `Competitor: ${args.competitorName}`,
    args.market ? `Market of interest: ${args.market}` : '',
    `Today: ${new Date().toISOString().slice(0, 10)}`,
    '',
    you,
    '',
    `WHAT THEY ALREADY OFFER (context only, never cite)\n"""${site}"""`,
    chatter ? `\nWHAT PEOPLE ARE SAYING ON X (context only, never cite)\n${chatter}` : '',
    `\nNUMBERED SOURCES\n\n${listed}`,
  ].filter(s => s !== '').join('\n')

  let parsed: { moves?: ModelMove[] }
  try {
    const raw = await callAi({
      tier: 'structural',
      system: SYSTEM,
      messages: [{ role: 'user', content: user }],
      maxTokens: 4000,
      meta: { feature: 'tool_competitor_tracker' },
    })
    parsed = extractJson<{ moves?: ModelMove[] }>(raw)
  } catch (err) {
    console.error('[competitor-tracker] classification failed:', err)
    return []
  }

  const valid: MoveCategory[] = ['product_launch', 'product_change', 'pricing', 'campaign', 'partnership', 'expansion', 'positioning', 'company']

  return (parsed.moves ?? []).flatMap<CompetitorMove>(m => {
    const src = sources[Number(m.source) - 1]
    // A source index the model made up. Dropped, not repaired.
    if (!src) return []
    if (!m.headline?.trim()) return []
    const category = valid.includes(m.category as MoveCategory) ? (m.category as MoveCategory) : 'company'
    const confidence = ['high', 'medium', 'low'].includes(m.confidence) ? m.confidence as 'high' | 'medium' | 'low' : 'medium'

    const sourceUrl = src.kind === 'press' ? src.item.link : src.kind === 'app' ? src.release.url : src.post.url
    const sourceName = src.kind === 'press' ? publicationFromUrl(src.item.link)
      : src.kind === 'app' ? `App Store release notes, ${src.release.appName}`
      : `X, @${src.post.username}`
    const publishedAt = src.kind === 'press' ? parsePubDate(src.item.pubDate)
      : src.kind === 'app' ? src.release.releasedAt
      : src.post.createdAt.slice(0, 10)

    return [{
      category,
      headline:     m.headline.trim().slice(0, 300),
      significance: (m.significance ?? '').trim(),
      implication:  (m.implication ?? '').trim(),
      sourceUrl,
      // A release note and their own post are them saying it.
      sourceKind:   src.kind === 'press' ? 'press' : 'announcement',
      sourceName,
      quote:        (m.quote ?? '').trim().slice(0, 240),
      publishedAt,
      confidence,
      fingerprint:  fingerprint(category, sourceUrl, m.headline),
    }]
  })
    // Newest first, whatever order the model answered in.
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    .slice(0, MAX_MOVES)
}

/* ── The brief a marketer reads ─────────────────────────────────────────── */

function buildReport(args: {
  competitorName: string
  host: string
  moves: CompetitorMove[]
  coverage: CoverageNote[]
  counts: { press: number; app: number; xOwn: number; xAbout: number }
  market: string | null
}): ToolReport {
  const { competitorName, moves, coverage, counts } = args

  const findings: Finding[] = moves.map(m => ({
    title: m.headline,
    detail: undefined,
    significance: [m.significance, m.implication].filter(Boolean).join(' '),
    // The development itself is observed: a dated source says it. The reading
    // of what it means is marked separately on the card.
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

  const read = [
    `${counts.press} press ${counts.press === 1 ? 'story' : 'stories'}`,
    counts.app ? 'their latest app release' : null,
    counts.xOwn || counts.xAbout ? `${counts.xOwn + counts.xAbout} posts on X` : null,
  ].filter(Boolean).join(', ')

  const summary = moves.length === 0
    ? `We read ${read} about ${competitorName} from the last ${WINDOW_DAYS} days, and found nothing new enough or big enough to call a move. Quiet is useful to know: it means you are not behind this month.`
    : `${competitorName} made ${moves.length} ${moves.length === 1 ? 'move' : 'moves'} recently that a marketing lead should know about${moves.some(m => m.category === 'pricing') ? ', including something on price' : ''}${moves.some(m => m.category === 'campaign') ? ', and a campaign' : ''}. Newest first, each with the dated source it came from. We read ${read}.`

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
      `This reads public sources only: the business press, ${competitorName}'s App Store listing and their posts on X. It cannot see their ad spend, their traffic, their revenue or anything they have not published.`,
      'Only dated sources can be cited. Their website is read to tell new from already known, never as evidence of a move.',
      `Press covers the last ${WINDOW_DAYS} days and X the last ${X_WINDOW_DAYS}. A move written up under a parent company name may be missing.`,
      'Nigerian press comes from ten national outlets. It is a good read of the national press and not a complete one. Google Play release notes are not read yet.',
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
    case 'campaign':
      return `Look at what this campaign is asking people to do, and who it is talking to. If it is your audience, decide this week whether you answer it, out-spend it or hold your line, before it sets the conversation.`
    case 'partnership':
      return `Work out what the partnership gives them that you lack: distribution, a payment rail, an audience. That is the gap to answer, not the announcement.`
    case 'expansion':
      return `Find out whether they are entering a market you already hold. If so, brief your field and trade teams there before their launch spend starts.`
    default:
      return `Share this with whoever owns your category plan, and set a watch so the follow-up reaches you as it happens.`
  }
}
