// BHI computation — two modes:
// 1. computeBHI()      — 3-component dashboard widget (Sentiment, SOV, Survey)
// 2. computeFullBHI()  — 7-component Brand Equity Tracker (Phase 2+)

export type BHIZone = 'at_risk' | 'building' | 'healthy' | 'leading'

export const ZONE_META: Record<BHIZone, { label: string; color: string; textClass: string }> = {
  at_risk:  { label: 'At Risk',  color: '#ef4444', textClass: 'text-red-500' },
  building: { label: 'Building', color: '#f59e0b', textClass: 'text-amber-500' },
  healthy:  { label: 'Healthy',  color: '#22c55e', textClass: 'text-green-600' },
  leading:  { label: 'Leading',  color: '#14b8a6', textClass: 'text-teal-500' },
}

export function getBHIZone(score: number): BHIZone {
  if (score < 40) return 'at_risk'
  if (score < 65) return 'building'
  if (score < 80) return 'healthy'
  return 'leading'
}

export interface BHIResult {
  score: number | null
  coverage: number        // 0–100 — share of components on real data
  zone: BHIZone | null
  components: {
    sentiment: number | null   // 0–100 from sentiment_daily.social_score
    sov:       number | null   // 0–100 from sov_snapshots.social_sov
    survey:    number | null   // 0–100 (avg NPS × 10) from survey_responses
  }
}

export function computeBHI({
  sentimentScore,
  sovScore,
  surveyScore,
}: {
  sentimentScore: number | null
  sovScore:       number | null
  surveyScore:    number | null
}): BHIResult {
  const available = [sentimentScore, sovScore, surveyScore].filter(v => v !== null).length
  const coverage  = Math.round((available / 3) * 100)

  if (available === 0) {
    return { score: null, coverage: 0, zone: null, components: { sentiment: null, sov: null, survey: null } }
  }

  // Base weights when all three available: sentiment 40 %, SOV 30 %, survey 30 %.
  // Weights are renormalised to whatever is actually present so a missing source
  // doesn't drag the score to zero — it just reduces coverage.
  const w = {
    sentiment: sentimentScore !== null ? 40 : 0,
    sov:       sovScore       !== null ? 30 : 0,
    survey:    surveyScore    !== null ? 30 : 0,
  }
  const total = w.sentiment + w.sov + w.survey

  const score = Number((
    ((sentimentScore ?? 0) * w.sentiment +
     (sovScore       ?? 0) * w.sov +
     (surveyScore    ?? 0) * w.survey) / total
  ).toFixed(1))

  return {
    score,
    coverage,
    zone: getBHIZone(score),
    components: { sentiment: sentimentScore, sov: sovScore, survey: surveyScore },
  }
}

// ── Full 7-component BHI ────────────────────────────────────────────────────

export interface FullBHIComponents {
  awareness:         number | null  // 20% — composite (SOV + OOH + events + digital + influencer)
  salience:          number | null  // 15% — aided awareness rate from surveys
  sentiment:         number | null  // 20% — sentiment_daily.social_score
  perception:        number | null  // 15% — avg perception audit ratings (0-100)
  culturalResonance: number | null  // 15% — Phase 3 only, null for now
  blendedSov:        number | null  // 10% — sov_snapshots.social_sov
  emv:               number | null  // 5%  — normalized EMV (0-100)
}

// ── Breakdown types (per-component data source detail) ─────────────────────

export interface BreakdownSource {
  label:      string
  rawDisplay: string | null   // formatted value, e.g. "22.4%", "3.2M", "1,124"
  weight:     number          // redistributed weight within this component (0–100)
  score:      number | null   // 0–100 sub-score for this source
}

export interface ComponentBreakdown {
  sources:   BreakdownSource[]
  composite: number | null
}

export interface BHIBreakdowns {
  awareness?:         ComponentBreakdown
  sentiment?:         ComponentBreakdown
  salience?:          ComponentBreakdown
  perception?:        ComponentBreakdown
  culturalResonance?: ComponentBreakdown
  blendedSov?:        ComponentBreakdown
  emv?:               ComponentBreakdown
}

export interface FullBHIResult {
  score:      number | null
  coverage:   number
  zone:       BHIZone | null
  components: FullBHIComponents
  breakdowns?: BHIBreakdowns
}

const FULL_WEIGHTS: Record<keyof FullBHIComponents, number> = {
  awareness:         20,
  salience:          15,
  sentiment:         20,
  perception:        15,
  culturalResonance: 15,
  blendedSov:        10,
  emv:                5,
}

export function computeFullBHI(
  components: FullBHIComponents,
  breakdowns?: BHIBreakdowns,
): FullBHIResult {
  const keys = Object.keys(components) as (keyof FullBHIComponents)[]
  const available = keys.filter(k => components[k] !== null)

  if (available.length === 0) {
    return { score: null, coverage: 0, zone: null, components, breakdowns }
  }

  const totalBaseWeight = keys.reduce((s, k) => s + FULL_WEIGHTS[k], 0)
  const activeWeight    = available.reduce((s, k) => s + FULL_WEIGHTS[k], 0)
  const coverage        = Math.round((activeWeight / totalBaseWeight) * 100)

  // Renormalise weights to available components
  const score = Number((
    available.reduce((s, k) => s + ((components[k] as number) * FULL_WEIGHTS[k]), 0) / activeWeight
  ).toFixed(1))

  return { score, coverage, zone: getBHIZone(score), components, breakdowns }
}

// ── Awareness composite (multi-source) ────────────────────────────────────────

export interface AwarenessInputs {
  socialSov:          number | null  // SOV percentage, used as 0–100 score directly
  oohMonthlyReach:    number | null  // raw total reach (daily_traffic × active_days)
  eventAttendance:    number | null  // total attendee count across events
  digitalImpressions: number | null  // total digital ad impressions
  influencerReach:    number | null  // sum of latest_post_reach for brand influencers
}

// Scale denominators: value that maps to a score of 100
const AWARENESS_SCALE: Record<keyof AwarenessInputs, number> = {
  socialSov:          100,        // already a 0–100 percentage
  oohMonthlyReach:    5_000_000,  // 5M monthly reach = 100
  eventAttendance:    10_000,     // 10K total attendance = 100
  digitalImpressions: 5_000_000,  // 5M impressions = 100
  influencerReach:    2_000_000,  // 2M reach = 100
}

const AWARENESS_BASE_WEIGHTS: Record<keyof AwarenessInputs, number> = {
  socialSov:          30,
  oohMonthlyReach:    25,
  eventAttendance:    20,
  digitalImpressions: 15,
  influencerReach:    10,
}

const AWARENESS_SOURCE_LABELS: Record<keyof AwarenessInputs, string> = {
  socialSov:          'Social SOV',
  oohMonthlyReach:    'OOH Reach',
  eventAttendance:    'Event Attendance',
  digitalImpressions: 'Digital Impressions',
  influencerReach:    'Influencer Reach',
}

function formatAwarenessRaw(key: keyof AwarenessInputs, v: number): string {
  switch (key) {
    case 'socialSov':
      return `${v.toFixed(1)}%`
    case 'eventAttendance':
      return v.toLocaleString('en-NG')
    default:
      return v >= 1_000_000
        ? `${(v / 1_000_000).toFixed(1)}M`
        : v >= 1_000
        ? `${Math.round(v / 1_000)}K`
        : String(Math.round(v))
  }
}

export function computeAwarenessComposite(inputs: AwarenessInputs): {
  score:     number | null
  breakdown: ComponentBreakdown
} {
  const inputKeys = Object.keys(inputs) as (keyof AwarenessInputs)[]
  const active    = inputKeys.filter(k => inputs[k] !== null && inputs[k] !== undefined)

  if (active.length === 0) {
    return {
      score: null,
      breakdown: {
        composite: null,
        sources: inputKeys.map(k => ({
          label:      AWARENESS_SOURCE_LABELS[k],
          rawDisplay: null,
          weight:     AWARENESS_BASE_WEIGHTS[k],
          score:      null,
        })),
      },
    }
  }

  const totalActiveWeight = active.reduce((sum, k) => sum + AWARENESS_BASE_WEIGHTS[k], 0)

  const sources: BreakdownSource[] = inputKeys.map(k => {
    const val = inputs[k]
    if (val === null || val === undefined) {
      return { label: AWARENESS_SOURCE_LABELS[k], rawDisplay: null, weight: 0, score: null }
    }
    const subScore          = Math.min(100, Math.round((val / AWARENESS_SCALE[k]) * 100))
    const redistributedWt   = Math.round((AWARENESS_BASE_WEIGHTS[k] / totalActiveWeight) * 100)
    return {
      label:      AWARENESS_SOURCE_LABELS[k],
      rawDisplay: formatAwarenessRaw(k, val),
      weight:     redistributedWt,
      score:      subScore,
    }
  })

  const composite = Math.round(
    active.reduce((sum, k) => {
      const val      = inputs[k] as number
      const subScore = Math.min(100, (val / AWARENESS_SCALE[k]) * 100)
      return sum + subScore * (AWARENESS_BASE_WEIGHTS[k] / totalActiveWeight)
    }, 0),
  )

  return { score: composite, breakdown: { sources, composite } }
}

// ── Trust pillar (fintech / venue brand types) ─────────────────────────────────

export interface TrustInputs {
  appStoreRating:     number | null   // 0–5 stars
  regulatoryStatus:   'clean' | 'under_review' | 'sanctioned' | null
  complaintSurges30d: number          // count of volume_surge alerts in last 30d
  negSentimentTrend:  number | null   // avg negative_pct from sentiment_daily 14d
}

export interface TrustScore {
  score:    number | null
  grade:    'excellent' | 'good' | 'fair' | 'poor' | null
  breakdown: {
    appStoreRating:     { score: number | null; weight: number; display: string | null }
    regulatoryStanding: { score: number | null; weight: number; display: string | null }
    reliabilitySignal:  { score: number | null; weight: number; display: string | null }
    complaintHealth:    { score: number | null; weight: number; display: string | null }
  }
}

export function computeTrustScore(inputs: TrustInputs): TrustScore {
  const appScore = inputs.appStoreRating != null
    ? Math.min(100, Math.round((inputs.appStoreRating / 5) * 100))
    : null

  const regScore = inputs.regulatoryStatus === 'clean'        ? 100
                 : inputs.regulatoryStatus === 'under_review' ? 50
                 : inputs.regulatoryStatus === 'sanctioned'   ? 0
                 : null

  const relScore = inputs.negSentimentTrend != null
    ? Math.max(0, Math.round(100 - inputs.negSentimentTrend * 2))
    : null

  const compScore = Math.max(0, 100 - inputs.complaintSurges30d * 25)

  const signals = [
    { score: appScore,  weight: 35 },
    { score: regScore,  weight: 30 },
    { score: relScore,  weight: 20 },
    { score: compScore, weight: 15 },
  ]

  const active = signals.filter(s => s.score !== null)
  const breakdown: TrustScore['breakdown'] = {
    appStoreRating:     { score: appScore,  weight: 35, display: inputs.appStoreRating != null ? `${inputs.appStoreRating.toFixed(1)}/5.0` : null },
    regulatoryStanding: { score: regScore,  weight: 30, display: inputs.regulatoryStatus ?? null },
    reliabilitySignal:  { score: relScore,  weight: 20, display: inputs.negSentimentTrend != null ? `${inputs.negSentimentTrend.toFixed(0)}% neg` : null },
    complaintHealth:    { score: compScore, weight: 15, display: `${inputs.complaintSurges30d} surge${inputs.complaintSurges30d === 1 ? '' : 's'} in 30d` },
  }

  if (active.length === 0) return { score: null, grade: null, breakdown }

  const totalW    = active.reduce((s, x) => s + x.weight, 0)
  const composite = Math.round(
    active.reduce((s, x) => s + (x.score as number) * (x.weight / totalW), 0)
  )

  const grade: TrustScore['grade'] =
    composite >= 80 ? 'excellent' :
    composite >= 60 ? 'good' :
    composite >= 40 ? 'fair' : 'poor'

  return { score: composite, grade, breakdown }
}

// ── Generic stage composite (multi-signal, weight-redistributing) ──────────────

export interface StageSignal {
  label:      string
  value:      number | null   // null = no data; any number (even 0) = measured
  weight:     number          // base weight in points (all signals sum to 100)
  scale:      number          // value that maps to score 100
  rawDisplay: string | null
}

export function computeStageComposite(signals: StageSignal[]): {
  score:     number | null
  breakdown: ComponentBreakdown
} {
  const active = signals.filter(s => s.value !== null && s.value !== undefined)

  if (active.length === 0) {
    return {
      score: null,
      breakdown: {
        composite: null,
        sources: signals.map(s => ({
          label: s.label, rawDisplay: s.rawDisplay, weight: s.weight, score: null,
        })),
      },
    }
  }

  const totalActiveWeight = active.reduce((sum, s) => sum + s.weight, 0)

  const sources: BreakdownSource[] = signals.map(s => {
    if (s.value === null || s.value === undefined) {
      return { label: s.label, rawDisplay: s.rawDisplay, weight: 0, score: null }
    }
    const subScore        = Math.min(100, Math.round((s.value / s.scale) * 100))
    const redistributedWt = Math.round((s.weight / totalActiveWeight) * 100)
    return { label: s.label, rawDisplay: s.rawDisplay, weight: redistributedWt, score: subScore }
  })

  const composite = Math.round(
    active.reduce((sum, s) => {
      const subScore = Math.min(100, (s.value as number) / s.scale * 100)
      return sum + subScore * (s.weight / totalActiveWeight)
    }, 0),
  )

  return { score: composite, breakdown: { sources, composite } }
}
