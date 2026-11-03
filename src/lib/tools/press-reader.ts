import {
  fetchGoogleNewsRss, fetchOutletSearch, isWithinDays, newestFirst, pressQuery, recentQuery, type RssItem,
} from '@/lib/press/nigerian-press'
import { fetchPublic } from './fetch-public'
import { readPage } from './html'

/**
 * Recent press about one name, with the article text wherever we can get it.
 *
 * Shared by every free tool that reads the press, so they all answer the same
 * way: narrowed to a window before Google ranks it (otherwise relevance
 * ranking returns last year's stories), newest first, undated stories dropped,
 * and the outlets' own feeds read for the article itself rather than a
 * headline. A tool that reasons from headlines alone gives shallow answers.
 */

export type PressItem = RssItem & { origin: 'google' | 'outlet' }

export interface PressRead {
  items:       PressItem[]
  googleOk:    boolean
  generalOk:   boolean
  outletsRead: number
}

/** Read the article behind a press link, when we can. Google News links are a
 *  script-driven redirect a server cannot follow, so a read that ends on
 *  news.google.com counts as no read. */
export async function readArticle(link: string): Promise<string | null> {
  const res = await fetchPublic(link, { timeoutMs: 6_000, maxBytes: 1_500_000 })
  if (!res.ok) return null
  try { if (new URL(res.url).hostname.endsWith('news.google.com')) return null } catch { return null }
  const facts = readPage(res.body, res.url)
  return facts.text.length > 200 ? facts.text.slice(0, 3000) : null
}

/** Merge, de-duplicate and keep only stories about them. Outlet items go
 *  first: they carry the article and a direct link, so when one story comes
 *  back from both feeds that is the copy worth keeping. */
export function mergePress(args: { name: string; days: number; outlet: RssItem[]; google: RssItem[]; limit: number }): PressItem[] {
  const first = args.name.toLowerCase().split(/\s+/)[0]
  const seenTitles = new Set<string>()
  const seenLinks = new Set<string>()
  const all: PressItem[] = [
    ...args.outlet.map(i => ({ ...i, origin: 'outlet' as const })),
    ...args.google.map(i => ({ ...i, origin: 'google' as const })),
  ].filter(item => {
    if (!isWithinDays(item.pubDate, args.days)) return false
    const link = item.link.split('?')[0]
    // Google appends " - Publication" to a headline; strip it to match.
    const title = item.title.replace(/\s+-\s+[^-]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (seenLinks.has(link) || seenTitles.has(title)) return false
    seenLinks.add(link); seenTitles.add(title)
    if (item.origin === 'outlet') return true
    // A Google story has to name them in the headline. Google News is
    // generous with adjacent coverage, and near-misses make a worse report.
    return item.title.toLowerCase().includes(first)
  })
  return newestFirst(all).slice(0, args.limit)
}

export async function readRecentPress(args: { name: string; market?: string | null; days: number; limit?: number }): Promise<PressRead> {
  const { name, days } = args
  const [nigerian, general, outlets] = await Promise.all([
    fetchGoogleNewsRss(recentQuery(pressQuery(name), days)),
    fetchGoogleNewsRss(recentQuery(`"${name}"${args.market ? ` ${args.market}` : ''}`, days)),
    fetchOutletSearch(name, { days }),
  ])
  const items = mergePress({ name, days, outlet: outlets.items, google: [...nigerian.items, ...general.items], limit: args.limit ?? 20 })

  // The newest few without text: one try each for the article itself.
  await Promise.all(items.filter(p => !p.body).slice(0, 6).map(async p => {
    const text = await readArticle(p.link)
    if (text) p.body = text
  }))

  return { items, googleOk: nigerian.ok, generalOk: general.ok, outletsRead: outlets.outletsRead }
}
