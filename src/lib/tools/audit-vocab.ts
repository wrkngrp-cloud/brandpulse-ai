/**
 * The audit's vocabulary, in a file a client component can import.
 */

export const AUDIT_AREAS = [
  'performance', 'accessibility', 'cta', 'clarity', 'friction', 'local_readiness', 'tracking',
] as const
export type AuditArea = (typeof AUDIT_AREAS)[number]

export const AREA_LABEL: Record<AuditArea, string> = {
  performance:     'Mobile performance',
  accessibility:   'Accessibility',
  cta:             'Call to action',
  clarity:         'Message clarity',
  friction:        'Conversion friction',
  local_readiness: 'Local market readiness',
  tracking:        'Tracking readiness',
}

export type Severity = 'high' | 'medium' | 'low'

export const SEVERITY_LABEL: Record<Severity, string> = {
  high:   'Fix before you spend more',
  medium: 'Worth fixing',
  low:    'Minor',
}

export const FINDING_STATUS = ['open', 'planned', 'fixed', 'wont_fix'] as const
export type FindingStatus = (typeof FINDING_STATUS)[number]

export const FINDING_STATUS_LABEL: Record<FindingStatus, string> = {
  open:     'Open',
  planned:  'Planned',
  fixed:    'Fixed',
  wont_fix: 'Not doing',
}

export const CAMPAIGN_OBJECTIVES = [
  'lead_generation', 'purchases', 'app_downloads', 'signups', 'whatsapp_enquiries', 'other',
] as const
export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number]

export const OBJECTIVE_LABEL: Record<CampaignObjective, string> = {
  lead_generation:    'Lead generation',
  purchases:          'Purchases',
  app_downloads:      'App downloads',
  signups:            'Signups',
  whatsapp_enquiries: 'WhatsApp enquiries',
  other:              'Something else',
}
