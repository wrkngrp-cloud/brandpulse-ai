import { inngest }             from '@/lib/inngest/client'
import { createServiceClient } from '@/lib/supabase/server'
import { callAi }              from '@/lib/ai/client'

// ── Hardcoded publication reach table (NGN-relevant outlets) ──────────────────
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

const MONITORED_DOMAINS = [
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

function getPublicationReach(publication: string): number {
  const key = publication.toLowerCase().replace(/\s+/g, '')
  for (const [name, reach] of Object.entries(PUBLICATION_REACH)) {
    if (key.includes(name.replace(/\s+/g, ''))) return reach
  }
  return 50000 // default for unknown publications
}

function extractPublicationFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace('www.', '')
    // Map hostnames to friendly names
    const map: Record<string, string> = {
      'punch.ng':          'The Punch',
      'vanguardngr.com':   'Vanguard',
      'guardian.ng':       'The Guardian',
      'businessday.ng':    'BusinessDay',
      'thecable.ng':       'The Cable',
      'premiumtimesng.com':'Premium Times',
      'nairametrics.com':  'Nairametrics',
      'techcabal.com':     'TechCabal',
      'techpoint.africa':  'Techpoint',
      'dailytrust.com':    'Daily Trust',
    }
    return map[host] ?? host
  } catch {
    return 'Unknown'
  }
}

// Simple RSS parser using regex (no external XML library required)
interface RssItem {
  title:   string
  link:    string
  pubDate: string
  snippet: string
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let m: RegExpExecArray | null

  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1]

    const title   = decodeEntities((/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(block)?.[1] ?? '').trim())
    const link    = decodeEntities((/<link>([\s\S]*?)<\/link>/.exec(block)?.[1] ?? '').trim())
    const pubDate = (/<pubDate>([\s\S]*?)<\/pubDate>/.exec(block)?.[1] ?? '').trim()
    const desc    = decodeEntities((/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/.exec(block)?.[1] ?? '').trim())

    if (title && link) {
      items.push({ title, link, pubDate, snippet: desc.slice(0, 400) })
    }
  }

  return items
}

function decodeEntities(html: string): string {
  return html
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, '') // strip any inline HTML tags
    .trim()
}

function parsePubDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10)
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

async function scoreSentiment(
  headline: string,
  snippet:  string,
  brandName: string,
): Promise<{ score: number; label: 'positive' | 'neutral' | 'negative' }> {
  try {
    const raw = await callAi({
      tier:   'cultural',
      system: `You are a Nigerian media analyst. Score the sentiment of this press mention toward the brand.
Return ONLY valid JSON: {"score": <number -1.0 to 1.0>, "label": "positive"|"neutral"|"negative"}`,
      messages: [{
        role:    'user',
        content: `Brand: ${brandName}
Headline: ${headline}
Snippet: ${snippet.slice(0, 200)}`,
      }],
    })

    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const parsed  = JSON.parse(cleaned)
    return {
      score: Math.max(-1, Math.min(1, Number(parsed.score ?? 0))),
      label: (['positive', 'neutral', 'negative'] as const).includes(parsed.label)
        ? parsed.label as 'positive' | 'neutral' | 'negative'
        : 'neutral',
    }
  } catch {
    return { score: 0, label: 'neutral' }
  }
}

async function fetchGoogleNewsRss(query: string): Promise<RssItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-NG&gl=NG&ceid=NG:en`
  try {
    const res  = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) return []
    const xml  = await res.text()
    return parseRssItems(xml)
  } catch {
    return []
  }
}

export const prCrawl = inngest.createFunction(
  {
    id:       'pr-crawl',
    name:     'PR: Crawl press mentions from Nigerian outlets (nightly)',
    triggers: [
      { cron: 'TZ=Africa/Lagos 0 7 * * *' },
      { event: 'brandgauge/pr.crawl-requested' },
    ],
    retries: 2,
  },
  async ({
    step,
    logger,
  }: {
    step:   { run: <T>(name: string, fn: () => Promise<T>) => Promise<T> }
    logger: { info: (msg: string, ...args: unknown[]) => void }
  }) => {
    const supabase = await createServiceClient()

    const { data: brands } = await supabase
      .from('brands')
      .select('id, name')

    if (!brands?.length) return { processed: 0 }

    let totalInserted = 0

    for (const brand of brands) {
      const brandResult = await step.run(`pr-crawl-brand-${brand.id}`, async () => {
        const svc = await createServiceClient()

        // Fetch competitors for this brand
        const { data: competitors } = await svc
          .from('competitors')
          .select('id, name')
          .eq('brand_id', brand.id)

        // Build domain filter for the search query
        const domainFilter = MONITORED_DOMAINS.map(d => `site:${d}`).join(' OR ')
        const brandQuery   = `"${brand.name}" (${domainFilter})`

        // Fetch brand mentions
        const brandItems = await fetchGoogleNewsRss(brandQuery)

        let inserted = 0

        // Process brand mentions
        for (const item of brandItems.slice(0, 20)) {
          // Check for duplicate by URL
          const { data: existing } = await svc
            .from('press_mentions')
            .select('id')
            .eq('brand_id', brand.id)
            .eq('url', item.link)
            .maybeSingle()

          if (existing) continue

          const { score, label } = await scoreSentiment(item.title, item.snippet, brand.name)
          const publication      = extractPublicationFromUrl(item.link)
          const reach            = getPublicationReach(publication)
          const publishedAt      = parsePubDate(item.pubDate)
          // EMV: reach × CPM_benchmark / 1000 (no engagement data for press)
          const emv              = (reach * 500) / 1000

          const { error } = await svc
            .from('press_mentions')
            .insert({
              brand_id:        brand.id,
              headline:        item.title,
              publication,
              url:             item.link,
              published_at:    publishedAt,
              sentiment_score: score,
              sentiment_label: label,
              estimated_reach: reach,
              emv,
              mention_type:    'press',
              is_competitor:   false,
              raw_snippet:     item.snippet,
              crawl_source:    'google_news_rss',
            })
            .select()
            .maybeSingle()

          if (!error) inserted++
        }

        // Process competitor mentions
        for (const competitor of (competitors ?? []).slice(0, 5)) {
          const compQuery = `"${competitor.name}" (${domainFilter})`
          const compItems = await fetchGoogleNewsRss(compQuery)

          for (const item of compItems.slice(0, 10)) {
            const { data: existing } = await svc
              .from('press_mentions')
              .select('id')
              .eq('brand_id', brand.id)
              .eq('url', item.link)
              .maybeSingle()

            if (existing) continue

            const { score, label } = await scoreSentiment(item.title, item.snippet, competitor.name)
            const publication      = extractPublicationFromUrl(item.link)
            const reach            = getPublicationReach(publication)
            const publishedAt      = parsePubDate(item.pubDate)
            const emv              = (reach * 500) / 1000

            await svc
              .from('press_mentions')
              .insert({
                brand_id:        brand.id,
                headline:        item.title,
                publication,
                url:             item.link,
                published_at:    publishedAt,
                sentiment_score: score,
                sentiment_label: label,
                estimated_reach: reach,
                emv,
                mention_type:    'press',
                is_competitor:   true,
                competitor_name: competitor.name,
                raw_snippet:     item.snippet,
                crawl_source:    'google_news_rss',
              })
              .select()
              .maybeSingle()
          }
        }

        return { inserted }
      })

      totalInserted += brandResult.inserted

      // Recalculate press_sov and upsert into sov_snapshots
      await step.run(`pr-sov-snapshot-${brand.id}`, async () => {
        const svc   = await createServiceClient()
        const today = new Date().toISOString().slice(0, 10)
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

        // Brand's press mentions in last 24h (weighted by reach)
        const { data: brandMentions } = await svc
          .from('press_mentions')
          .select('estimated_reach')
          .eq('brand_id', brand.id)
          .eq('is_competitor', false)
          .gte('published_at', since)

        // Competitor press mentions in last 24h
        const { data: compMentions } = await svc
          .from('press_mentions')
          .select('estimated_reach')
          .eq('brand_id', brand.id)
          .eq('is_competitor', true)
          .gte('published_at', since)

        const brandReach = (brandMentions ?? []).reduce((s, m) => s + (m.estimated_reach ?? 0), 0)
        const compReach  = (compMentions ?? []).reduce((s, m) => s + (m.estimated_reach ?? 0), 0)
        const total      = brandReach + compReach

        const pressSov = total > 0 ? Number(((brandReach / total) * 100).toFixed(2)) : null

        if (pressSov !== null) {
          await svc
            .from('sov_snapshots')
            .upsert({
              brand_id:      brand.id,
              snapshot_date: today,
              press_sov:     pressSov,
            }, { onConflict: 'brand_id,snapshot_date' })
        }

        logger.info(`Brand ${brand.name}: press_sov=${pressSov ?? 'n/a'}% (brand_reach=${brandReach}, comp_reach=${compReach})`)

        return { pressSov }
      })
    }

    return { processed: brands.length, inserted: totalInserted }
  },
)
