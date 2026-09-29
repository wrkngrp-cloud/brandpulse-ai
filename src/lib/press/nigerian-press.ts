/**
 * The Nigerian press feed, and what a mention there is worth.
 *
 * This is the engine behind both the nightly `pr-crawl` Inngest job and the
 * public scoreboard at /scoreboard. It lived inside the job; the public tool
 * needed the same reach table, the same outlet list and the same EMV maths,
 * and a second copy of a hardcoded table is how the icon set broke twice this
 * month. One file, both callers.
 *
 * It needs no credentials. Google News exposes an RSS endpoint, and asking it
 * for `hl=en-NG&gl=NG&ceid=NG:en` narrowed to ten named Nigerian domains gives
 * a usable national press feed for free. That is the whole reason the
 * scoreboard can run for a stranger who has connected nothing.
 */

/** Estimated monthly readership. Directional, not audited: no public
 *  Nigerian circulation dataset exists, so these are practitioner estimates
 *  and the UI says so. They rank outlets correctly, which is what a share
 *  calculation needs. */
const PUBLICATION_REACH: Record<string, number> = {
  'punch':          750000,
  'the punch':      750000,
  'punchng':        750000,
  'vanguard':       600000,
  'vanguardngr':    600000,
  'guardian':       400000,
  'businessday':    200000,
  'business day':   200000,
  'thisday':        300000,
  'this day':       300000,
  'premium times':  500000,
  'premiumtimes':   500000,
  'techcabal':      180000,
  'nairametrics':   600000,
  'techpoint':      150000,
  'the cable':      350000,
  'thecable':       350000,
  'daily trust':    350000,
  'dailytrust':     350000,
}

export const MONITORED_DOMAINS = [
  'punch.ng',
  'vanguardngr.com',
  'guardian.ng',
  'businessday.ng',
  'thecable.ng',
  'premiumtimesng.com',
  'nairametrics.com',
  'techcabal.com',
  'techpoint.africa',
  'dailytrust.com',
]

const DOMAIN_NAMES: Record<string, string> = {
  'punch.ng':           'The Punch',
  'vanguardngr.com':    'Vanguard',
  'guardian.ng':        'The Guardian',
  'businessday.ng':     'BusinessDay',
  'thecable.ng':        'The Cable',
  'premiumtimesng.com': 'Premium Times',
  'nairametrics.com':   'Nairametrics',
  'techcabal.com':      'TechCabal',
  'techpoint.africa':   'Techpoint',
  'dailytrust.com':     'Daily Trust',
}

/** Naira CPM applied to readership. The same 500 the nightly job uses, so a
 *  figure on the public board and a figure in the product agree. */
export const EMV_CPM = 500

export function reachFor(publication: string): number {
  const key = publication.toLowerCase().replace(/\s+/g, '')
  for (const [name, reach] of Object.entries(PUBLICATION_REACH)) {
    if (key.includes(name.replace(/\s+/g, ''))) return reach
  }
  return 50_000
}

export function emvFor(reach: number): number {
  return (reach * EMV_CPM) / 1000
}

export function publicationFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace('www.', '')
    return DOMAIN_NAMES[host] ?? host
  } catch {
    return 'Unknown'
  }
}

export interface RssItem {
  title:   string
  link:    string
  pubDate: string
  snippet: string
}

function decodeEntities(html: string): string {
  return html
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim()
}

/** Regex rather than an XML library: the feed is a flat <item> list and
 *  pulling in a parser for it was never worth the dependency. */
export function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let m: RegExpExecArray | null
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1]
    const title   = decodeEntities((/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(block)?.[1] ?? '').trim())
    const link    = decodeEntities((/<link>([\s\S]*?)<\/link>/.exec(block)?.[1] ?? '').trim())
    const pubDate = (/<pubDate>([\s\S]*?)<\/pubDate>/.exec(block)?.[1] ?? '').trim()
    const desc    = decodeEntities((/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/.exec(block)?.[1] ?? '').trim())
    if (title && link) items.push({ title, link, pubDate, snippet: desc.slice(0, 400) })
  }
  return items
}

/**
 * A feed read either worked or it did not, and the difference matters.
 *
 * An unreachable feed and a brand nobody wrote about both produce zero items.
 * Collapsing them means a network fault gets presented to a visitor as a
 * finding about their brand, which is worse than an error: it is a confident
 * wrong answer. So failure is carried, not swallowed.
 */
export interface FeedRead {
  items: RssItem[]
  ok:    boolean
  /** Set when ok is false, for the log. Never shown to a visitor verbatim. */
  error?: string
}

export async function fetchGoogleNewsRss(query: string, signal?: AbortSignal): Promise<FeedRead> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-NG&gl=NG&ceid=NG:en`
  try {
    const res = await fetch(url, {
      signal,
      // Google serves the RSS endpoint to anything with a plain agent, and
      // refuses some datacentre requests that send none at all.
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrandGauge/1.0; +https://brandgauge.app)' },
      next: { revalidate: 0 },
    })
    if (!res.ok) return { items: [], ok: false, error: `HTTP ${res.status}` }
    return { items: parseRssItems(await res.text()), ok: true }
  } catch (err) {
    return { items: [], ok: false, error: err instanceof Error ? err.message : 'fetch failed' }
  }
}

/** The query the nightly job and the public board both send: the name in
 *  quotes, narrowed to the ten outlets, so a brand whose name is a common
 *  word does not return the whole internet. */
export function pressQuery(name: string): string {
  return `"${name}" (${MONITORED_DOMAINS.map(d => `site:${d}`).join(' OR ')})`
}

export function parsePubDate(s: string): string {
  const d = new Date(s)
  return Number.isNaN(d.getTime())
    ? new Date().toISOString().slice(0, 10)
    : d.toISOString().slice(0, 10)
}

/* ── Regulators ──────────────────────────────────────────────────────────────
   A CBN licence or a NAFDAC sanction moves a Nigerian brand's standing more
   than any campaign, and it is the one thing on this board a marketer cannot
   afford to learn late. Same vocabulary the regulatory-mention Inngest job
   classifies with. */
const REGULATORY_ENTITIES = [
  'CBN', 'Central Bank of Nigeria', 'SEC', 'Securities and Exchange Commission',
  'NDIC', 'Nigerian Deposit Insurance', 'EFCC', 'Economic and Financial Crimes',
  'NAICOM', 'National Insurance Commission', 'NAFDAC', 'National Agency for Food',
  'APCON', 'Advertising Practitioners Council', 'NCC', 'Nigerian Communications Commission',
  'FIRS', 'Federal Inland Revenue', 'CAC', 'Corporate Affairs Commission',
]
const SANCTION_TERMS      = ['sanction', 'fine', 'penali', 'revok', 'suspend', 'bar', 'prohibit', 'cease', 'delist', 'shutdown']
const INVESTIGATION_TERMS = ['investigat', 'probe', 'scrutin', 'allegat', 'charg']
const POSITIVE_TERMS      = ['licen', 'approv', 'grant', 'certif', 'recogni', 'award', 'compli', 'accredit']

export type RegulatoryKind = 'sanction' | 'investigation' | 'positive' | 'notice'

export function classifyRegulatory(text: string): { kind: RegulatoryKind; entity: string } | null {
  const lower = text.toLowerCase()
  const entity = REGULATORY_ENTITIES.find(e => lower.includes(e.toLowerCase()))
  if (!entity) return null
  if (SANCTION_TERMS.some(t => lower.includes(t)))      return { kind: 'sanction', entity }
  if (INVESTIGATION_TERMS.some(t => lower.includes(t))) return { kind: 'investigation', entity }
  if (POSITIVE_TERMS.some(t => lower.includes(t)))      return { kind: 'positive', entity }
  return { kind: 'notice', entity }
}
