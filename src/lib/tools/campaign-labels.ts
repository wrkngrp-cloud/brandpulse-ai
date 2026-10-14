/**
 * Campaign vocabulary the public page, the dashboard and the engine share.
 *
 * offline-tracker.ts reaches the service client, so a client component cannot
 * import it. Same split as moves.ts and demand-labels.ts.
 */

export const CAMPAIGN_TYPES = [
  'outdoor', 'event', 'activation', 'radio', 'flyer', 'in_store', 'sponsorship', 'other',
] as const
export type CampaignType = (typeof CAMPAIGN_TYPES)[number]

export const CAMPAIGN_TYPE_LABEL: Record<CampaignType, string> = {
  outdoor:     'Outdoor advertising',
  event:       'Event',
  activation:  'Field activation',
  radio:       'Radio',
  flyer:       'Flyers',
  in_store:    'In-store promotion',
  sponsorship: 'Sponsorship',
  other:       'Other',
}

/** What a placement is usually called, per campaign type, so the field has a
 *  useful placeholder instead of "Placement 1". */
export const PLACEMENT_HINT: Record<CampaignType, string> = {
  outdoor:     'Ikeja along, by the bridge',
  event:       'Main stage banner',
  activation:  'Computer Village team',
  radio:       'Cool FM, drive time',
  flyer:       'Yaba market handout',
  in_store:    'Shoprite Lekki, end cap',
  sponsorship: 'Match day boards',
  other:       'Where this one lives',
}

/** What the free tool allows before someone continues in BrandGauge. Not a
 *  paywall: the links already made keep working for ever. */
export const FREE_PLACEMENT_LIMIT = 3
