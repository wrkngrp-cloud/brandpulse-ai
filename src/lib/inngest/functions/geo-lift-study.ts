import { inngest }              from '@/lib/inngest/client'
import { createServiceClient }  from '@/lib/supabase/server'
import { callAi }               from '@/lib/ai/client'

interface GeoLiftRequestedEvent {
  data: {
    studyId:       string
    brandId:       string
    campaignId:    string | null
    treatmentCity: string
    controlCity:   string
    keyword:       string
    studyStart:    string   // ISO date
    studyEnd:      string   // ISO date
  }
}

interface WeeklyPoint {
  week:             string
  treatment_index:  number
  control_index:    number
}

interface TrendsTimeline {
  date:   string
  values: { query: string; value: string }[]
}

interface TrendsApiResponse {
  interest_over_time?: {
    timeline_data?: TrendsTimeline[]
  }
}

// Simple pearson correlation
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

// Bootstrap approximation of confidence (simple variance-based estimate)
function bootstrapConfidence(treatment: number[], control: number[]): number {
  if (treatment.length < 3 || control.length < 3) return 0

  const meanT = treatment.reduce((a, b) => a + b, 0) / treatment.length
  const meanC = control.reduce((a, b)   => a + b, 0) / control.length

  const varT = treatment.reduce((s, v) => s + (v - meanT) ** 2, 0) / treatment.length
  const varC = control.reduce((s, v)   => s + (v - meanC) ** 2, 0) / control.length

  const sePooled = Math.sqrt((varT / treatment.length) + (varC / control.length))
  if (sePooled === 0) return 95

  const tStat  = Math.abs((meanT - meanC) / sePooled)
  // Rough approximation: map t-stat to confidence
  const conf   = Math.min(99, Math.max(0, 50 + (tStat * 25)))
  return Math.round(conf * 100) / 100
}

async function fetchCityTrends(
  keyword: string,
  geo: string,
  dateRange: string,
  apiKey: string,
): Promise<Record<string, number>> {
  const url = new URL('https://serpapi.com/search')
  url.searchParams.set('engine',  'google_trends')
  url.searchParams.set('q',        keyword)
  url.searchParams.set('date',     dateRange)
  url.searchParams.set('geo',      geo)
  url.searchParams.set('api_key',  apiKey)

  const res = await fetch(url.toString())
  if (!res.ok) return {}

  const json: TrendsApiResponse = await res.json()
  const timeline = json?.interest_over_time?.timeline_data ?? []

  const indexed: Record<string, number> = {}
  for (const point of timeline) {
    const d   = new Date(point.date.split('–')[0].trim())   // '–' separator
    const mon = new Date(d)
    mon.setDate(d.getDate() - d.getDay() + 1) // Monday of that week
    const key = mon.toISOString().slice(0, 10)
    const val = parseInt(point.values?.[0]?.value ?? '0', 10)
    indexed[key] = val
  }

  return indexed
}

// City-to-Google Trends geo code mapping for Nigeria
const CITY_GEO: Record<string, string> = {
  'Lagos':         'NG-LA',
  'Abuja':         'NG-FC',
  'Port Harcourt': 'NG-RI',
  'Kano':          'NG-KN',
  'Ibadan':        'NG-OY',
}

export const geoLiftStudy = inngest.createFunction(
  {
    id:       'geo-lift-study',
    name:     'Geo-Lift: Run city-level search trend study',
    triggers: [{ event: 'brandgauge/geo-lift.study-requested' }],
    retries:  2,
  },
  async ({
    event,
    step,
  }: {
    event: GeoLiftRequestedEvent
    step:  { run: <T>(name: string, fn: () => Promise<T>) => Promise<T> }
  }) => {
    const {
      studyId,
      brandId,
      treatmentCity,
      controlCity,
      keyword,
      studyStart,
      studyEnd,
    } = event.data

    const supabase = await createServiceClient()

    // Mark study as running
    await step.run('mark-running', async () => {
      await supabase
        .from('geo_lift_studies')
        .update({ status: 'running', updated_at: new Date().toISOString() })
        .eq('id', studyId)
    })

    // Fetch trends for both cities
    const trendsData = await step.run('fetch-trends', async () => {
      const apiKey = process.env.SERPAPI_KEY
      if (!apiKey) return null

      const dateRange = `${studyStart} ${studyEnd}`

      const treatmentGeo = CITY_GEO[treatmentCity] ?? 'NG'
      const controlGeo   = CITY_GEO[controlCity]   ?? 'NG'

      const [treatmentTrends, controlTrends] = await Promise.all([
        fetchCityTrends(keyword, treatmentGeo, dateRange, apiKey),
        fetchCityTrends(keyword, controlGeo,   dateRange, apiKey),
      ])

      return { treatmentTrends, controlTrends }
    })

    if (!trendsData) {
      await supabase
        .from('geo_lift_studies')
        .update({
          status:             'insufficient_data',
          ai_interpretation:  'Add SERPAPI_KEY to enable Google Trends analysis.',
          updated_at:         new Date().toISOString(),
        })
        .eq('id', studyId)

      return { status: 'no-serpapi-key' }
    }

    const { treatmentTrends, controlTrends } = trendsData

    // Build weekly data — union all weeks
    const analysis = await step.run('compute-lift', async () => {
      const allWeeks = [...new Set([
        ...Object.keys(treatmentTrends),
        ...Object.keys(controlTrends),
      ])].sort()

      if (allWeeks.length < 3) {
        return {
          weeklyData:      [] as WeeklyPoint[],
          liftPct:         null as number | null,
          correlation:     null as number | null,
          confidence:      null as number | null,
          status:          'insufficient_data' as const,
        }
      }

      const weeklyData: WeeklyPoint[] = allWeeks.map(week => ({
        week,
        treatment_index: treatmentTrends[week] ?? 0,
        control_index:   controlTrends[week]   ?? 0,
      }))

      const treatmentVals = weeklyData.map(w => w.treatment_index)
      const controlVals   = weeklyData.map(w => w.control_index)

      const meanT = treatmentVals.reduce((a, b) => a + b, 0) / treatmentVals.length
      const meanC = controlVals.reduce((a, b)   => a + b, 0) / controlVals.length

      const liftPct    = meanC > 0 ? ((meanT - meanC) / meanC) * 100 : null
      const correlation = pearsonR(treatmentVals, controlVals)
      const confidence  = bootstrapConfidence(treatmentVals, controlVals)

      return {
        weeklyData,
        liftPct:     liftPct !== null ? Math.round(liftPct * 100) / 100 : null,
        correlation: correlation !== null ? Math.round(correlation * 10000) / 10000 : null,
        confidence:  Math.round(confidence * 100) / 100,
        status:      'complete' as const,
      }
    })

    // AI interpretation
    const interpretation = await step.run('ai-interpretation', async () => {
      if (analysis.status !== 'complete' || analysis.weeklyData.length === 0) {
        return 'Not enough data points to generate an interpretation.'
      }

      return callAi({
        tier:   'structural',
        system: `You are a Nigerian brand marketing analyst specialising in geo-lift studies.
Respond in 2–3 clear sentences. Be specific and actionable.
Do not use em dashes, jargon, or banned words (robust, vibrant, leverage, seamless).`,
        messages: [{
          role:    'user',
          content: `Geo-lift study results for "${keyword}" in Nigeria:
- Treatment city: ${treatmentCity}
- Control city: ${controlCity}
- Study period: ${studyStart} to ${studyEnd}
- Lift: ${analysis.liftPct !== null ? `${analysis.liftPct.toFixed(1)}%` : 'insufficient data'}
- Correlation (treatment vs control): ${analysis.correlation !== null ? analysis.correlation.toFixed(2) : 'n/a'}
- Statistical confidence: ${analysis.confidence !== null ? `${analysis.confidence.toFixed(0)}%` : 'n/a'}
- Weeks of data: ${analysis.weeklyData.length}

What does this mean for the brand manager and what should they do next?`,
        }],
      })
    })

    // Persist results
    await step.run('persist-results', async () => {
      const svc = await createServiceClient()
      await svc
        .from('geo_lift_studies')
        .update({
          status:             analysis.status,
          lift_pct:           analysis.liftPct,
          correlation:        analysis.correlation,
          confidence:         analysis.confidence,
          ai_interpretation:  interpretation,
          weekly_data:        analysis.weeklyData,
          updated_at:         new Date().toISOString(),
        })
        .eq('id', studyId)

      return { studyId, status: analysis.status, brandId }
    })

    return {
      studyId,
      status:      analysis.status,
      liftPct:     analysis.liftPct,
      correlation: analysis.correlation,
      confidence:  analysis.confidence,
      weeks:       analysis.weeklyData.length,
    }
  },
)
