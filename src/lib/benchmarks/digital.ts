/**
 * Digital ad benchmarks for the Nigerian market.
 *
 * IMPORTANT — data sourcing note:
 * These are directional estimates based on West African market norms and
 * practitioner experience. No single authoritative Nigerian-specific benchmark
 * dataset exists publicly (Meta/Google publish global or US benchmarks only;
 * IAB Nigeria publishes market-level spend reports, not per-metric CPM/CTR tables).
 *
 * All values are labeled "Estimated" in the UI. They refine automatically once
 * a brand's own 90-day history is available (self-benchmarking takes precedence).
 *
 * Industry segments: fintech, fashion, fmcg, telecom, ecommerce, default.
 * Collapse unknown industries to "default" — never invent per-sector numbers.
 */

export type BenchLabel = {
  label: string
  cls:   string
}

export type MetricBenchmarks = {
  /** CTR as a decimal — 0.018 = 1.8% */
  ctr:  { good: number; strong: number }
  /** CPC in NGN */
  cpc:  { great: number; good: number; avg: number }
  /** CPM in NGN */
  cpm:  { great: number; good: number; avg: number }
  /** ROAS multiplier */
  roas: { excellent: number; good: number; marginal: number }
  /** Frequency (average ad exposures per person) */
  freq: { healthy: number; watch: number }
  /** CVR as percentage — 2.5 = 2.5% */
  cvr:  { strong: number; good: number; avg: number }
  /** Cost per lead in NGN */
  cpl:  { great: number; good: number; avg: number }
  /** Cost per install in NGN */
  cpi:  { great: number; good: number; avg: number }
}

const DEFAULT: MetricBenchmarks = {
  ctr:  { good: 0.018, strong: 0.025 },
  cpc:  { great: 80, good: 150, avg: 300 },
  cpm:  { great: 500, good: 1000, avg: 2000 },
  roas: { excellent: 4, good: 2, marginal: 1.5 },
  freq: { healthy: 3, watch: 6 },
  cvr:  { strong: 3, good: 1.5, avg: 1 },
  cpl:  { great: 300, good: 600, avg: 1200 },
  cpi:  { great: 200, good: 500, avg: 1000 },
}

const INDUSTRY_BENCHMARKS: Record<string, MetricBenchmarks> = {
  default:   DEFAULT,
  fintech: {
    ...DEFAULT,
    ctr:  { good: 0.015, strong: 0.022 },   // fintech CTR runs slightly lower
    cpc:  { great: 100, good: 200, avg: 400 },
    cpl:  { great: 500, good: 1000, avg: 2000 },
  },
  fashion: {
    ...DEFAULT,
    ctr:  { good: 0.022, strong: 0.035 },   // fashion CTR runs higher (visual appeal)
    cpc:  { great: 60, good: 120, avg: 250 },
    roas: { excellent: 5, good: 2.5, marginal: 1.5 },
  },
  fmcg: {
    ...DEFAULT,
    ctr:  { good: 0.020, strong: 0.030 },
    cpm:  { great: 400, good: 800, avg: 1600 },
    roas: { excellent: 3.5, good: 1.8, marginal: 1.2 },
  },
  ecommerce: {
    ...DEFAULT,
    ctr:  { good: 0.020, strong: 0.030 },
    roas: { excellent: 5, good: 3, marginal: 2 },
    cvr:  { strong: 4, good: 2, avg: 1 },
  },
  telecom: {
    ...DEFAULT,
    ctr:  { good: 0.014, strong: 0.020 },
    cpc:  { great: 120, good: 250, avg: 500 },
    cpl:  { great: 400, good: 800, avg: 1500 },
  },
}

export function getBenchmarks(industry?: string | null): MetricBenchmarks {
  const key = industry?.toLowerCase().replace(/\s+/g, '_') ?? 'default'
  return INDUSTRY_BENCHMARKS[key] ?? INDUSTRY_BENCHMARKS.default
}

export function benchCTR(v: number, b: MetricBenchmarks): BenchLabel {
  if (v >= b.ctr.strong) return { label: 'Strong',  cls: 'text-emerald-600 dark:text-emerald-400' }
  if (v >= b.ctr.good)   return { label: 'Good',    cls: 'text-emerald-500' }
  if (v >= b.ctr.good / 2) return { label: 'Average', cls: 'text-amber-500' }
  return                        { label: 'Low',     cls: 'text-rose-500' }
}

export function benchCPC(v: number, b: MetricBenchmarks): BenchLabel {
  if (v > 0 && v <= b.cpc.great) return { label: 'Great',   cls: 'text-emerald-600 dark:text-emerald-400' }
  if (v <= b.cpc.good)           return { label: 'Good',    cls: 'text-emerald-500' }
  if (v <= b.cpc.avg)            return { label: 'Average', cls: 'text-amber-500' }
  return                               { label: 'High',     cls: 'text-rose-500' }
}

export function benchCPM(v: number, b: MetricBenchmarks): BenchLabel {
  if (v > 0 && v <= b.cpm.great) return { label: 'Great',   cls: 'text-emerald-600 dark:text-emerald-400' }
  if (v <= b.cpm.good)           return { label: 'Good',    cls: 'text-emerald-500' }
  if (v <= b.cpm.avg)            return { label: 'Average', cls: 'text-amber-500' }
  return                               { label: 'High',     cls: 'text-rose-500' }
}

export function benchROAS(v: number, b: MetricBenchmarks): BenchLabel {
  if (v >= b.roas.excellent) return { label: 'Excellent',   cls: 'text-emerald-600 dark:text-emerald-400' }
  if (v >= b.roas.good)      return { label: 'Good',        cls: 'text-emerald-500' }
  if (v >= b.roas.marginal)  return { label: 'Marginal',    cls: 'text-amber-500' }
  return                            { label: 'Below target', cls: 'text-rose-500' }
}

export function benchFreq(v: number, b: MetricBenchmarks): BenchLabel {
  if (v <= b.freq.healthy) return { label: 'Healthy',     cls: 'text-emerald-500' }
  if (v <= b.freq.watch)   return { label: 'Watch',       cls: 'text-amber-500' }
  return                          { label: 'Fatigue risk', cls: 'text-rose-500' }
}

export function benchCVR(v: number, b: MetricBenchmarks): BenchLabel {
  if (v >= b.cvr.strong) return { label: 'Strong',  cls: 'text-emerald-600 dark:text-emerald-400' }
  if (v >= b.cvr.good)   return { label: 'Good',    cls: 'text-emerald-500' }
  if (v >= b.cvr.avg)    return { label: 'Average', cls: 'text-amber-500' }
  return                        { label: 'Low',      cls: 'text-rose-500' }
}

export function benchCPL(v: number, b: MetricBenchmarks): BenchLabel {
  if (v > 0 && v <= b.cpl.great) return { label: 'Great',   cls: 'text-emerald-600 dark:text-emerald-400' }
  if (v <= b.cpl.good)           return { label: 'Good',    cls: 'text-emerald-500' }
  if (v <= b.cpl.avg)            return { label: 'Average', cls: 'text-amber-500' }
  return                               { label: 'High',     cls: 'text-rose-500' }
}

export function benchCPI(v: number, b: MetricBenchmarks): BenchLabel {
  if (v > 0 && v <= b.cpi.great) return { label: 'Great',   cls: 'text-emerald-600 dark:text-emerald-400' }
  if (v <= b.cpi.good)           return { label: 'Good',    cls: 'text-emerald-500' }
  if (v <= b.cpi.avg)            return { label: 'Average', cls: 'text-amber-500' }
  return                               { label: 'High',     cls: 'text-rose-500' }
}

/** Metric display config per campaign objective */
export const OBJECTIVE_METRIC_LABELS: Record<string, { label: string; metrics: string[] }> = {
  awareness:  { label: 'Awareness',    metrics: ['reach', 'impressions', 'cpm', 'frequency'] },
  traffic:    { label: 'Traffic',      metrics: ['clicks', 'ctr', 'cpc', 'landing_page_views'] },
  engagement: { label: 'Engagement',  metrics: ['clicks', 'ctr', 'cpc', 'conversions'] },
  leads:      { label: 'Lead Gen',     metrics: ['leads', 'cpl', 'lead_rate', 'spend'] },
  app:        { label: 'App Installs', metrics: ['installs', 'cpi', 'install_rate', 'spend'] },
  sales:      { label: 'Sales',        metrics: ['conversions', 'cpa', 'roas', 'revenue'] },
}

export const METRIC_FRIENDLY: Record<string, string> = {
  reach:              'Reach',
  impressions:        'Impressions',
  cpm:                'CPM',
  frequency:          'Frequency',
  clicks:             'Clicks',
  ctr:                'CTR',
  cpc:                'CPC',
  landing_page_views: 'Landing Page Views',
  leads:              'Leads',
  cpl:                'Cost per Lead',
  lead_rate:          'Lead Rate',
  installs:           'Installs',
  cpi:                'Cost per Install',
  install_rate:       'Install Rate',
  conversions:        'Conversions',
  cpa:                'CPA',
  roas:               'ROAS',
  revenue:            'Revenue',
  spend:              'Spend',
}

export const METRIC_COMPARATOR_DEFAULT: Record<string, 'lte' | 'gte'> = {
  cpm: 'lte', cpc: 'lte', cpa: 'lte', cpl: 'lte', cpi: 'lte', frequency: 'lte',
  roas: 'gte', ctr: 'gte', reach: 'gte', impressions: 'gte', clicks: 'gte',
  conversions: 'gte', leads: 'gte', installs: 'gte', revenue: 'gte',
}
