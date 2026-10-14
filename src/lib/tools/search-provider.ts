/**
 * Search evidence, behind one interface, because the honest answer changes
 * with what we are licensed to read.
 *
 * SerpAPI is already in this codebase — the OOH search-uplift and geo-lift
 * Inngest jobs both read `SERPAPI_KEY` — so it is the provider implemented
 * here rather than a new vendor. What matters more than which provider is
 * what each one can and cannot support:
 *
 *   A results page proves who is visible for a query. That is an observed
 *   fact with a URL attached.
 *
 *   It does not prove how many people search that query. SerpAPI's search
 *   endpoint returns no volume, and no free source does either, so this
 *   module never returns a volume, a CPC, a keyword difficulty or a traffic
 *   estimate — not even an approximate one. A number nobody licensed us to
 *   know is the exact thing that would make these reports untrustworthy.
 *
 * With no key the provider is null and the caller must fall back to evidence
 * it can establish itself, which is what market-demand.ts does: a content gap
 * read off the company's own site. The report then says, in those words, that
 * no search data was measured.
 */

export interface SearchResult {
  title:    string
  url:      string
  snippet:  string
  position: number
}

export interface SearchAnswer {
  query:    string
  results:  SearchResult[]
  /** Named in the report, so a reader knows where the evidence came from. */
  provider: string
}

export interface SearchProvider {
  name: string
  /** Top organic results for a query, localised to a market. Never volume. */
  search(query: string, market: string): Promise<SearchAnswer | null>
}

/** Country code for SerpAPI's `gl`. Nigeria first, the rest of the West
 *  African markets the product is heading into next, then a sensible default. */
const MARKET_CODES: Record<string, string> = {
  nigeria: 'ng', ghana: 'gh', kenya: 'ke', 'south africa': 'za',
  'cote d\'ivoire': 'ci', 'ivory coast': 'ci', senegal: 'sn', benin: 'bj',
  togo: 'tg', cameroon: 'cm', rwanda: 'rw', tanzania: 'tz', uganda: 'ug',
  egypt: 'eg', morocco: 'ma', 'united kingdom': 'uk', uk: 'uk',
  'united states': 'us', usa: 'us',
}

export function marketCode(market: string): string {
  return MARKET_CODES[market.trim().toLowerCase()] ?? 'ng'
}

class SerpApiProvider implements SearchProvider {
  name = 'Google Search via SerpAPI'
  constructor(private key: string) {}

  async search(query: string, market: string): Promise<SearchAnswer | null> {
    const url = new URL('https://serpapi.com/search')
    url.searchParams.set('engine', 'google')
    url.searchParams.set('q', query)
    url.searchParams.set('gl', marketCode(market))
    url.searchParams.set('hl', 'en')
    url.searchParams.set('num', '10')
    url.searchParams.set('api_key', this.key)

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 12_000)
      const res = await fetch(url.toString(), { signal: controller.signal, cache: 'no-store' })
      clearTimeout(timer)
      if (!res.ok) {
        console.warn(`[search-provider] SerpAPI returned ${res.status} for "${query}"`)
        return null
      }
      const body = await res.json() as {
        organic_results?: Array<{ title?: string; link?: string; snippet?: string; position?: number }>
      }
      const results = (body.organic_results ?? [])
        .filter(r => r.link && r.title)
        .slice(0, 10)
        .map((r, i) => ({
          title:    (r.title ?? '').slice(0, 200),
          url:      r.link as string,
          snippet:  (r.snippet ?? '').slice(0, 300),
          position: r.position ?? i + 1,
        }))
      return { query, results, provider: this.name }
    } catch (err) {
      console.warn(`[search-provider] SerpAPI failed for "${query}":`, err instanceof Error ? err.message : err)
      return null
    }
  }
}

export function getSearchProvider(): SearchProvider | null {
  const key = process.env.SERPAPI_KEY
  return key ? new SerpApiProvider(key) : null
}

/** How many queries one free analysis may spend. Each is a billed SerpAPI
 *  call, so the ceiling is the cost control, and the report says how many
 *  were sampled rather than implying the whole market was read. */
export const QUERY_BUDGET = 4
