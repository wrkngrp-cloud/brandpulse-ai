import type { SupabaseClient } from '@supabase/supabase-js'
import type { BrandType } from '@/lib/bhi'

// Commercial metrics derived from Tier-1 manual entries (metric_manual).
// This is the layer that turns raw entered numbers (spend, new customers,
// MQLs, churn, revenue) into the figures a CFO asks about: CAC, CPL, ROI,
// ROAS, LTV:CAC. Board Pack and Business Case both read from here so the
// two surfaces can never drift apart.

export interface MetricTrendPoint {
  date:  string   // period_start of the month
  value: number
}

export interface CommercialMetric {
  value: number | null
  trend: MetricTrendPoint[]
  unavailableReason?: string
}

export interface CommercialMetrics {
  cac:       CommercialMetric
  cpl:       CommercialMetric
  mql:       CommercialMetric
  churnRate: CommercialMetric
  revenue:   CommercialMetric
  spend:     CommercialMetric
  roiPct:    CommercialMetric
  roas:      CommercialMetric
  ltvToCac:  CommercialMetric
}

export type CommercialMetricId = keyof CommercialMetrics

const UNAVAILABLE_REASONS: Record<CommercialMetricId, string> = {
  cac:       'Track marketing spend and new customers to unlock CAC.',
  cpl:       'Track marketing spend and MQLs to unlock cost per lead.',
  mql:       'Track MQLs each month to see lead volume here.',
  churnRate: 'Track churn rate each month to see retention here.',
  revenue:   'Track monthly revenue to unlock revenue reporting.',
  spend:     'Track monthly marketing spend to unlock spend reporting.',
  roiPct:    'Track revenue and marketing spend to unlock marketing ROI.',
  roas:      'Track revenue and marketing spend to unlock ROAS.',
  ltvToCac:  'Track ARPU, churn rate and CAC to unlock LTV to CAC.',
}

// Which commercial metrics make sense per vertical. Mass-retail FMCG-style
// brands and distributors sell through trade channels, so a per-customer
// acquisition cost has no meaning for them — they get revenue, spend and
// return on that spend only. Agencies earn fees on client work; their own
// biz-dev funnel is out of scope, and their "total_spend" entry means client
// media spend managed, so spend-based ROI would be misleading for them too.
const METRICS_BY_BRAND_TYPE: Record<BrandType, CommercialMetricId[]> = {
  fmcg:              ['revenue', 'spend', 'roiPct', 'roas'],
  beverage_alcohol:  ['revenue', 'spend', 'roiPct', 'roas'],
  b2b_distribution:  ['revenue', 'spend', 'roiPct', 'roas'],
  venue:             ['revenue', 'spend', 'roiPct', 'roas'],
  agency:            ['revenue'],
  fintech:           ['revenue', 'spend', 'cac', 'cpl', 'mql', 'churnRate', 'roiPct', 'roas', 'ltvToCac'],
  b2b_saas:          ['revenue', 'spend', 'cac', 'cpl', 'mql', 'churnRate', 'roiPct', 'roas', 'ltvToCac'],
  marketplace:       ['revenue', 'spend', 'cac', 'cpl', 'mql', 'churnRate', 'roiPct', 'roas', 'ltvToCac'],
}

export function visibleCommercialMetrics(brandType: BrandType): CommercialMetricId[] {
  return METRICS_BY_BRAND_TYPE[brandType] ?? METRICS_BY_BRAND_TYPE.fmcg
}

// Per-period derivation: takes the raw entered values for one month and
// resolves each commercial metric, applying explicit overrides where the
// user entered the figure directly (cac, ltv_cac_ratio).
function derivePeriod(raw: Map<string, number>): Record<CommercialMetricId, number | null> {
  const get = (k: string) => raw.get(k) ?? null

  const totalSpend   = get('total_spend')
  const newCustomers = get('new_customers')
  const mqlCount     = get('mql_count')
  const churn        = get('churn_rate')
  const arpu         = get('arpu')

  const revenue = get('revenue_monthly') ?? get('mrr')

  const cac = get('cac') ?? (
    totalSpend != null && newCustomers != null && newCustomers > 0
      ? totalSpend / newCustomers
      : null
  )

  const cpl = totalSpend != null && mqlCount != null && mqlCount > 0
    ? totalSpend / mqlCount
    : null

  const roiPct = revenue != null && totalSpend != null && totalSpend > 0
    ? ((revenue - totalSpend) / totalSpend) * 100
    : null

  const roas = revenue != null && totalSpend != null && totalSpend > 0
    ? revenue / totalSpend
    : null

  const ltvToCac = get('ltv_cac_ratio') ?? (
    arpu != null && churn != null && churn > 0 && cac != null && cac > 0
      ? (arpu / churn) / cac
      : null
  )

  return {
    cac,
    cpl,
    mql:       mqlCount,
    churnRate: churn,
    revenue,
    spend:     totalSpend,
    roiPct,
    roas,
    ltvToCac,
  }
}

export async function computeCommercialMetrics(
  supabase: SupabaseClient,
  brandId: string,
  months = 6,
): Promise<CommercialMetrics> {
  const now    = new Date()
  const cutoff = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
    .toISOString()
    .split('T')[0]

  const { data: rows } = await supabase
    .from('metric_manual')
    .select('metric_key, value, period_start')
    .eq('brand_id', brandId)
    .gte('period_start', cutoff)
    .order('period_start', { ascending: true }) as {
      data: { metric_key: string; value: number; period_start: string }[] | null
    }

  // Group by period, keeping the full series so trends work, not just latest.
  const periods = new Map<string, Map<string, number>>()
  for (const r of rows ?? []) {
    if (r.value == null) continue
    let period = periods.get(r.period_start)
    if (!period) {
      period = new Map()
      periods.set(r.period_start, period)
    }
    period.set(r.metric_key, Number(r.value))
  }

  const sortedPeriods = [...periods.keys()].sort()

  const ids: CommercialMetricId[] = [
    'cac', 'cpl', 'mql', 'churnRate', 'revenue', 'spend', 'roiPct', 'roas', 'ltvToCac',
  ]
  const trends: Record<CommercialMetricId, MetricTrendPoint[]> = {
    cac: [], cpl: [], mql: [], churnRate: [], revenue: [], spend: [], roiPct: [], roas: [], ltvToCac: [],
  }

  for (const periodStart of sortedPeriods) {
    const derived = derivePeriod(periods.get(periodStart)!)
    for (const id of ids) {
      const v = derived[id]
      if (v != null && Number.isFinite(v)) {
        trends[id].push({ date: periodStart, value: v })
      }
    }
  }

  const result = {} as CommercialMetrics
  for (const id of ids) {
    const trend = trends[id]
    const value = trend.length > 0 ? trend[trend.length - 1].value : null
    result[id] = value != null
      ? { value, trend }
      : { value: null, trend, unavailableReason: UNAVAILABLE_REASONS[id] }
  }

  return result
}
