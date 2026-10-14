/**
 * Labels the demand-gap screens share with the engine.
 *
 * market-demand.ts reaches the AI client and the SSRF-safe fetcher, so a
 * client component cannot import it. Same split as moves.ts.
 */

export type IntentStage = 'problem_aware' | 'solution_discovery' | 'brand_alternatives' | 'comparison' | 'purchase'

export const INTENT_LABEL: Record<IntentStage, string> = {
  problem_aware:       'Problem awareness',
  solution_discovery:  'Solution discovery',
  brand_alternatives:  'Brand alternatives',
  comparison:          'Product comparison',
  purchase:            'Purchase intent',
}

export type EvidenceKind = 'demand_evidence' | 'visibility_gap' | 'content_gap'

export const EVIDENCE_KIND_LABEL: Record<EvidenceKind, string> = {
  demand_evidence: 'Demand evidence',
  visibility_gap:  'Visibility gap',
  content_gap:     'Content gap',
}

/** What each kind of claim actually rests on, in the words the UI shows. The
 *  difference between these three is the whole credibility of the report. */
export const EVIDENCE_KIND_NOTE: Record<EvidenceKind, string> = {
  demand_evidence: 'Real competitors rank for a commercial search here, which makes buyer demand plausible. It is not a measurement of how many people search it.',
  visibility_gap:  'Someone else appears for a search you do not appear for. The result page is the evidence.',
  content_gap:     'Your own site does not address something your buyers plainly need to know. Read off your pages, with no search data involved.',
}

export const OPPORTUNITY_STATUS = ['identified', 'planned', 'in_progress', 'done', 'dismissed'] as const
export type OpportunityStatus = (typeof OPPORTUNITY_STATUS)[number]

export const STATUS_LABEL: Record<OpportunityStatus, string> = {
  identified:  'Identified',
  planned:     'Planned',
  in_progress: 'In progress',
  done:        'Done',
  dismissed:   'Dismissed',
}
