/**
 * The category press scoreboard.
 *
 * Give it a brand and up to three rivals and it returns thirty days of
 * Nigerian press for all of them, weighted by the readership of the outlet
 * that ran it, converted to earned media value in Naira, and split as a share
 * of the category's total earned reach.
 *
 * The share is the point. "You were mentioned four times" means nothing on
 * its own. "You hold 8% of the earned reach in your category this month, and
 * the brand you keep losing pitches to holds 47%" is a sentence a marketing
 * lead can take into a budget meeting, which is the job this product exists
 * to do.
 */
import {
  classifyRegulatory, emvFor, fetchGoogleNewsRss, parsePubDate,
  pressQuery, publicationFromUrl, reachFor, type RegulatoryKind,
} from './nigerian-press'

export interface Mention {
  headline:    string
  publication: string
  url:         string
  publishedAt: string
  reach:       number
  emv:         number
}

export interface BrandBoard {
  name:           string
  isSubject:      boolean
  mentions:       Mention[]
  mentionCount:   number
  totalReach:     number
  totalEmv:       number
  shareOfReach:   number
  topPublication: string | null
}

export interface RegulatoryFlag {
  brand:    string
  kind:     RegulatoryKind
  entity:   string
  headline: string
  url:      string
}

export interface Scoreboard {
  days:        number
  generatedAt: string
  brands:      BrandBoard[]
  totalReach:  number
  totalEmv:    number
  regulatory:  RegulatoryFlag[]
  /** True when nobody in the set was covered at all. The page says something
   *  different in that case, because silence across a whole category is a
   *  finding and an empty table is a bug. */
  empty:       boolean
  /** False when we could not read the feed. Silence we can report; a feed we
   *  could not reach is not silence, and must never be dressed as one. */
  feedOk:      boolean
}

const MAX_PER_BRAND = 25
/** A visitor waits for this. Google News is normally under a second; anything
 *  that has not answered in eight is not going to save the page, and a board
 *  that says it could not read the feed beats a spinner that never stops. */
const FEED_TIMEOUT_MS = 8_000

async function boardFor(name: string, isSubject: boolean, since: number): Promise<{
  board: Omit<BrandBoard, 'shareOfReach'>
  flags: RegulatoryFlag[]
  ok: boolean
}> {
  const read = await fetchGoogleNewsRss(pressQuery(name), AbortSignal.timeout(FEED_TIMEOUT_MS))
  const items = read.items
  if (!read.ok) console.error(`[scoreboard] feed read failed for "${name}": ${read.error}`)
  const seen = new Set<string>()
  const mentions: Mention[] = []
  const flags: RegulatoryFlag[] = []

  for (const item of items) {
    if (mentions.length >= MAX_PER_BRAND) break
    if (seen.has(item.link)) continue
    seen.add(item.link)

    const publishedAt = parsePubDate(item.pubDate)
    if (new Date(publishedAt).getTime() < since) continue

    const publication = publicationFromUrl(item.link)
    const reach = reachFor(publication)
    mentions.push({ headline: item.title, publication, url: item.link, publishedAt, reach, emv: emvFor(reach) })

    const reg = classifyRegulatory(`${item.title} ${item.snippet}`)
    if (reg) flags.push({ brand: name, kind: reg.kind, entity: reg.entity, headline: item.title, url: item.link })
  }

  const totalReach = mentions.reduce((s, m) => s + m.reach, 0)
  const byPub = new Map<string, number>()
  for (const m of mentions) byPub.set(m.publication, (byPub.get(m.publication) ?? 0) + 1)
  const topPublication = [...byPub.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    board: {
      name, isSubject, mentions, mentionCount: mentions.length,
      totalReach, totalEmv: emvFor(totalReach), topPublication,
    },
    flags,
    ok: read.ok,
  }
}

export async function runScoreboard(
  brand: string, competitors: string[], days = 30,
): Promise<Scoreboard> {
  const since = Date.now() - days * 86_400_000
  const names = [brand, ...competitors]

  // One request per brand, in parallel. Four RSS fetches, no API key, about a
  // second in total.
  const results = await Promise.all(
    names.map((n, i) => boardFor(n, i === 0, since)),
  )

  const totalReach = results.reduce((s, r) => s + r.board.totalReach, 0)
  const brands: BrandBoard[] = results.map(r => ({
    ...r.board,
    shareOfReach: totalReach > 0 ? Math.round((r.board.totalReach / totalReach) * 1000) / 10 : 0,
  }))

  return {
    days,
    generatedAt: new Date().toISOString(),
    brands,
    totalReach,
    totalEmv: emvFor(totalReach),
    regulatory: results.flatMap(r => r.flags).slice(0, 8),
    empty: totalReach === 0,
    feedOk: results.some(r => r.ok),
  }
}
