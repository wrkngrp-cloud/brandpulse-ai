export interface EventMetrics {
  total_engaged:            number
  total_leads:              number
  total_new_customers:      number
  total_existing_customers: number
  total_merch:              number
  total_samples:            number
  total_prizes:             number
  total_photo:              number
  total_interactions:       number

  cost_per_engaged:         number | null
  cost_per_lead:            number | null
  cost_per_account:         number | null
  event_emv:                number
  event_roi:                number | null
  new_customer_ratio:       number | null
  advocacy_trigger_rate:    number | null

  leads_vs_target:          number | null
  customers_vs_target:      number | null
}

interface Interaction {
  interaction_type: string
}

interface KpiTargets {
  expected_leads?:          number
  expected_new_customers?:  number
  expected_engaged?:        number
}

const EMV_PER_INTERACTION = 500 // NGN 500 average media value per branded interaction

export function computeEventMetrics(
  interactions: Interaction[],
  budget:       number | null | undefined,
  kpiTargets:   KpiTargets,
): EventMetrics {
  const c = {
    engaged: 0, new_lead: 0, new_customer: 0, existing_customer: 0,
    merch: 0, sample: 0, prize: 0, photo: 0,
  }

  for (const i of interactions) {
    const k = i.interaction_type as keyof typeof c
    if (k in c) c[k]++
  }

  const total = Object.values(c).reduce((s, n) => s + n, 0)
  const emv   = total * EMV_PER_INTERACTION

  return {
    total_engaged:            c.engaged,
    total_leads:              c.new_lead,
    total_new_customers:      c.new_customer,
    total_existing_customers: c.existing_customer,
    total_merch:              c.merch,
    total_samples:            c.sample,
    total_prizes:             c.prize,
    total_photo:              c.photo,
    total_interactions:       total,

    cost_per_engaged:      budget && c.engaged       > 0 ? budget / c.engaged       : null,
    cost_per_lead:         budget && c.new_lead       > 0 ? budget / c.new_lead       : null,
    cost_per_account:      budget && c.new_customer   > 0 ? budget / c.new_customer   : null,
    event_emv:             emv,
    event_roi:             budget && budget > 0 ? ((emv - budget) / budget) * 100 : null,
    new_customer_ratio:    c.new_lead       > 0 ? c.new_customer / c.new_lead : null,
    advocacy_trigger_rate: total            > 0 ? c.photo         / total     : null,

    leads_vs_target:      kpiTargets.expected_leads         ? (c.new_lead     / kpiTargets.expected_leads)         * 100 : null,
    customers_vs_target:  kpiTargets.expected_new_customers ? (c.new_customer / kpiTargets.expected_new_customers) * 100 : null,
  }
}

export function fmtNGN(value: number | null | undefined): string {
  if (value == null) return 'N/A'
  return '₦' + value.toLocaleString('en-NG', { maximumFractionDigits: 0 })
}

export function fmtPct(value: number | null | undefined, decimals = 1): string {
  if (value == null) return 'N/A'
  return value.toFixed(decimals) + '%'
}
