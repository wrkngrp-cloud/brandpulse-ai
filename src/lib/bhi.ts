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
  awareness:         number | null  // 20% — SOV %
  salience:          number | null  // 15% — aided awareness rate from surveys
  sentiment:         number | null  // 20% — sentiment_daily.social_score
  perception:        number | null  // 15% — avg perception audit ratings (0-100)
  culturalResonance: number | null  // 15% — Phase 3 only, null for now
  blendedSov:        number | null  // 10% — sov_snapshots.social_sov
  emv:               number | null  // 5%  — normalized EMV (0-100)
}

export interface FullBHIResult {
  score:      number | null
  coverage:   number
  zone:       BHIZone | null
  components: FullBHIComponents
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

export function computeFullBHI(components: FullBHIComponents): FullBHIResult {
  const keys = Object.keys(components) as (keyof FullBHIComponents)[]
  const available = keys.filter(k => components[k] !== null)

  if (available.length === 0) {
    return { score: null, coverage: 0, zone: null, components }
  }

  const totalBaseWeight = keys.reduce((s, k) => s + FULL_WEIGHTS[k], 0)
  const activeWeight    = available.reduce((s, k) => s + FULL_WEIGHTS[k], 0)
  const coverage        = Math.round((activeWeight / totalBaseWeight) * 100)

  // Renormalise weights to available components
  const score = Number((
    available.reduce((s, k) => s + ((components[k] as number) * FULL_WEIGHTS[k]), 0) / activeWeight
  ).toFixed(1))

  return { score, coverage, zone: getBHIZone(score), components }
}
