import { inngest }          from '@/lib/inngest/client'
import { createServiceClient } from '@/lib/supabase/server'
import { callAi }            from '@/lib/ai/client'

interface UpliftEvent {
  data: {
    siteId:  string
    brandId: string
    keyword: string
  }
}

export const oohSearchUplift = inngest.createFunction(
  {
    id:      'ooh-search-uplift',
    name:    'OOH: Compute search uplift correlation',
    triggers: [{ event: 'brandgauge/ooh.search-uplift-requested' }],
    retries: 2,
  },
  async ({ event, step }: { event: UpliftEvent; step: { run: <T>(name: string, fn: () => Promise<T>) => Promise<T> } }) => {
    const { siteId, brandId, keyword } = event.data

    // Step 1: Fetch OOH visit volume by week (last 12 weeks)
    const visitData = await step.run('fetch-visit-volumes', async () => {
      const supabase = await createServiceClient()
      const since    = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000).toISOString()

      const { data: visits } = await supabase
        .from('ooh_visits')
        .select('visited_at')
        .eq('site_id', siteId)
        .gte('visited_at', since)

      // Aggregate by week
      const weeks: Record<string, number> = {}
      ;(visits ?? []).forEach(v => {
        const d    = new Date(v.visited_at)
        const mon  = new Date(d)
        mon.setDate(d.getDate() - d.getDay() + 1) // Monday of that week
        const key  = mon.toISOString().slice(0, 10)
        weeks[key] = (weeks[key] ?? 0) + 1
      })

      return weeks
    })

    // Step 2: Fetch Google Trends data via SerpAPI (if key present)
    // Falls back to synthetic delta if no key
    const searchData = await step.run('fetch-search-trends', async () => {
      const apiKey = process.env.SERPAPI_KEY
      if (!apiKey) {
        // No SerpAPI — return null so we skip storage rather than corrupt data
        return null
      }

      const weeks = Object.keys(visitData).sort()
      if (weeks.length < 2) return null

      const startDate = weeks[0]
      const endDate   = weeks[weeks.length - 1]

      // SerpAPI Google Trends
      const url = new URL('https://serpapi.com/search')
      url.searchParams.set('engine',     'google_trends')
      url.searchParams.set('q',           keyword)
      url.searchParams.set('date',        `${startDate} ${endDate}`)
      url.searchParams.set('geo',         'NG')
      url.searchParams.set('api_key',     apiKey)

      const res = await fetch(url.toString())
      if (!res.ok) return null

      const json = await res.json()
      const timeline: { date: string; values: { value: string }[] }[] =
        json?.interest_over_time?.timeline_data ?? []

      const indexed: Record<string, number> = {}
      timeline.forEach(point => {
        const d   = new Date(point.date.split('–')[0].trim())
        const mon = new Date(d)
        mon.setDate(d.getDate() - d.getDay() + 1)
        const key = mon.toISOString().slice(0, 10)
        indexed[key] = parseInt(point.values?.[0]?.value ?? '0', 10)
      })

      return indexed
    })

    if (!searchData) {
      // No SerpAPI key — store visit volumes without search data for display
      await step.run('store-visits-only', async () => {
        const supabase = await createServiceClient()
        const entries  = Object.entries(visitData)

        if (!entries.length) return

        await supabase.from('ooh_search_uplift').upsert(
          entries.map(([week_start, ooh_visits]) => ({
            brand_id:    brandId,
            site_id:     siteId,
            keyword,
            week_start,
            ooh_visits,
            search_index:   null,
            correlation:    null,
            interpretation: 'Add SERPAPI_KEY to enable Google Trends correlation.',
          })),
          { onConflict: 'brand_id,keyword,week_start' },
        )
      })
      return { status: 'stored-visits-only' }
    }

    // Step 3: Compute Pearson correlation + AI interpretation
    const analysisResult = await step.run('compute-correlation', async () => {
      const allWeeks = [...new Set([...Object.keys(visitData), ...Object.keys(searchData)])].sort()

      const pairs = allWeeks.map(w => ({
        week:         w,
        ooh_visits:   visitData[w]  ?? 0,
        search_index: searchData[w] ?? 0,
      }))

      const correlation = pearsonR(
        pairs.map(p => p.ooh_visits),
        pairs.map(p => p.search_index),
      )

      const interpretation = await callAi({
        tier:   'structural',
        system: 'You are a marketing analyst. Respond in one sentence only.',
        messages: [{
          role:    'user',
          content: `OOH billboard visits vs branded search (keyword: "${keyword}") had a Pearson correlation of ${correlation?.toFixed(2) ?? 'null'} over ${pairs.length} weeks in Nigeria. In one sentence, what does this mean for the brand manager?`,
        }],
      })

      return { pairs, correlation, interpretation }
    })

    // Step 4: Persist rows
    await step.run('store-uplift', async () => {
      const supabase = await createServiceClient()

      await supabase.from('ooh_search_uplift').upsert(
        analysisResult.pairs.map(p => ({
          brand_id:       brandId,
          site_id:        siteId,
          keyword,
          week_start:     p.week,
          ooh_visits:     p.ooh_visits,
          search_index:   p.search_index,
          correlation:    analysisResult.correlation,
          interpretation: analysisResult.interpretation,
        })),
        { onConflict: 'brand_id,keyword,week_start' },
      )
    })

    return {
      correlation: analysisResult.correlation,
      weeks:       analysisResult.pairs.length,
    }
  },
)

function pearsonR(x: number[], y: number[]): number | null {
  const n = x.length
  if (n < 3) return null

  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n

  let num = 0, denX = 0, denY = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    num  += dx * dy
    denX += dx * dx
    denY += dy * dy
  }

  const denom = Math.sqrt(denX * denY)
  if (denom === 0) return null
  return Math.max(-1, Math.min(1, num / denom))
}
