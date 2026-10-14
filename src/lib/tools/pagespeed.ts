/**
 * Mobile performance, measured rather than guessed.
 *
 * PageSpeed Insights answers without a key at a low quota, and with
 * `PAGESPEED_API_KEY` at a usable one, so the audit degrades rather than
 * breaking: with no answer at all the report says the performance check did
 * not run instead of substituting an opinion about speed.
 *
 * Two kinds of number come back and the difference matters enough that the UI
 * keeps them apart. Lab data is one run on Google's emulated mid-range phone.
 * Field data is the Chrome User Experience Report: what real people on real
 * Nigerian networks actually got, over 28 days. Field data is the better
 * evidence by a distance, and it only exists for pages with enough traffic, so
 * it is reported when present and its absence is stated rather than filled in.
 */

export interface PageSpeedMetric {
  label:    string
  /** Human string as Google formats it, e.g. "4.2 s". */
  display:  string
  /** Raw milliseconds or unitless score, for comparison across audits. */
  value:    number
  /** Google's own verdict. */
  rating:   'good' | 'needs-improvement' | 'poor'
}

export interface PageSpeedResult {
  /** 0-100, Lighthouse mobile performance. Null when the category was absent. */
  performanceScore:  number | null
  accessibilityScore: number | null
  /** Lab metrics from the single emulated run. */
  lab:               PageSpeedMetric[]
  /** Chrome User Experience Report, when the page has enough real traffic. */
  field:             PageSpeedMetric[]
  fieldAvailable:    boolean
  /** Accessibility audits that actually failed, titled as Google titles them. */
  failedAccessibility: { title: string; description: string; items: number }[]
  /** Opportunities worth more than 150ms, so the list stays actionable. */
  opportunities:     { title: string; savingsMs: number }[]
  /** Which emulated device and connection, for the report's footnote. */
  strategy:          'mobile'
  fetchedAt:         string
}

const RATINGS: Record<string, [number, number]> = {
  // metric id → [good threshold, poor threshold] in the metric's own unit
  'largest-contentful-paint': [2500, 4000],
  'first-contentful-paint':   [1800, 3000],
  'total-blocking-time':      [200, 600],
  'cumulative-layout-shift':  [0.1, 0.25],
  'speed-index':              [3400, 5800],
  'interaction-to-next-paint':[200, 500],
}

function rate(id: string, value: number): PageSpeedMetric['rating'] {
  const thresholds = RATINGS[id]
  if (!thresholds) return 'needs-improvement'
  const [good, poor] = thresholds
  if (value <= good) return 'good'
  return value <= poor ? 'needs-improvement' : 'poor'
}

const FIELD_LABEL: Record<string, string> = {
  LARGEST_CONTENTFUL_PAINT_MS:        'Largest contentful paint',
  FIRST_CONTENTFUL_PAINT_MS:          'First contentful paint',
  CUMULATIVE_LAYOUT_SHIFT_SCORE:      'Layout shift',
  INTERACTION_TO_NEXT_PAINT:          'Interaction to next paint',
  EXPERIMENTAL_TIME_TO_FIRST_BYTE:    'Time to first byte',
}

interface PsiAudit {
  id?: string
  title?: string
  description?: string
  displayValue?: string
  numericValue?: number
  score?: number | null
  details?: { items?: unknown[]; overallSavingsMs?: number }
}

interface PsiResponse {
  lighthouseResult?: {
    categories?: Record<string, { score?: number | null }>
    audits?: Record<string, PsiAudit>
  }
  loadingExperience?: {
    metrics?: Record<string, { percentile?: number; category?: string }>
  }
}

const LAB_METRICS = [
  'largest-contentful-paint', 'first-contentful-paint',
  'total-blocking-time', 'cumulative-layout-shift', 'speed-index',
]

export async function runPageSpeed(url: string): Promise<PageSpeedResult | null> {
  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed')
  endpoint.searchParams.set('url', url)
  endpoint.searchParams.set('strategy', 'mobile')
  endpoint.searchParams.append('category', 'performance')
  endpoint.searchParams.append('category', 'accessibility')
  const key = process.env.PAGESPEED_API_KEY
  if (key) endpoint.searchParams.set('key', key)

  let body: PsiResponse
  try {
    const controller = new AbortController()
    // PSI genuinely takes this long on a slow page; a shorter timeout here
    // just means the performance check never runs for the pages that need it
    // most.
    const timer = setTimeout(() => controller.abort(), 55_000)
    const res = await fetch(endpoint.toString(), { signal: controller.signal, cache: 'no-store' })
    clearTimeout(timer)
    if (!res.ok) {
      console.warn(`[pagespeed] ${res.status} for ${url}${key ? '' : ' (no PAGESPEED_API_KEY, quota is low)'}`)
      return null
    }
    body = await res.json() as PsiResponse
  } catch (err) {
    console.warn('[pagespeed] failed:', err instanceof Error ? err.message : err)
    return null
  }

  const audits = body.lighthouseResult?.audits ?? {}
  const categories = body.lighthouseResult?.categories ?? {}

  const lab: PageSpeedMetric[] = LAB_METRICS.flatMap(id => {
    const audit = audits[id]
    if (!audit || typeof audit.numericValue !== 'number') return []
    return [{
      label:   audit.title ?? id,
      display: audit.displayValue ?? String(audit.numericValue),
      value:   audit.numericValue,
      rating:  rate(id, audit.numericValue),
    }]
  })

  const fieldMetrics = body.loadingExperience?.metrics ?? {}
  const field: PageSpeedMetric[] = Object.entries(fieldMetrics).flatMap(([id, m]) => {
    if (typeof m.percentile !== 'number') return []
    const isShift = id === 'CUMULATIVE_LAYOUT_SHIFT_SCORE'
    return [{
      label:   FIELD_LABEL[id] ?? id,
      display: isShift ? (m.percentile / 100).toFixed(2) : `${(m.percentile / 1000).toFixed(1)} s`,
      value:   m.percentile,
      rating:  m.category === 'FAST' ? 'good' : m.category === 'AVERAGE' ? 'needs-improvement' : 'poor',
    }]
  })

  const failedAccessibility = Object.values(audits)
    .filter(a => a.score !== null && a.score !== undefined && a.score < 1 && a.details?.items?.length)
    .filter(a => ACCESSIBILITY_IDS.has(a.id ?? ''))
    .slice(0, 8)
    .map(a => ({
      title:       a.title ?? 'Accessibility issue',
      description: (a.description ?? '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').slice(0, 300),
      items:       a.details?.items?.length ?? 0,
    }))

  const opportunities = Object.values(audits)
    .filter(a => typeof a.details?.overallSavingsMs === 'number' && (a.details.overallSavingsMs ?? 0) >= 150)
    .sort((a, b) => (b.details?.overallSavingsMs ?? 0) - (a.details?.overallSavingsMs ?? 0))
    .slice(0, 5)
    .map(a => ({ title: a.title ?? 'Opportunity', savingsMs: Math.round(a.details?.overallSavingsMs ?? 0) }))

  return {
    performanceScore:   score(categories.performance?.score),
    accessibilityScore: score(categories.accessibility?.score),
    lab,
    field,
    fieldAvailable:     field.length > 0,
    failedAccessibility,
    opportunities,
    strategy:           'mobile',
    fetchedAt:          new Date().toISOString(),
  }
}

function score(raw: number | null | undefined): number | null {
  return typeof raw === 'number' ? Math.round(raw * 100) : null
}

/** The accessibility audits worth reporting to a marketer. The full Lighthouse
 *  set runs to dozens and most of them need a developer's context; these are
 *  the ones that lose a customer on a phone. */
const ACCESSIBILITY_IDS = new Set([
  'color-contrast', 'image-alt', 'label', 'link-name', 'button-name',
  'html-has-lang', 'meta-viewport', 'target-size', 'tap-targets',
  'document-title', 'input-image-alt', 'aria-allowed-attr',
  'aria-required-attr', 'form-field-multiple-labels', 'heading-order',
])
