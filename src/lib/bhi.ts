// Phase 1 basic BHI — three inputs only.
// Full 7-component weighted BHI comes in Phase 2 Brand Equity Tracker.

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
