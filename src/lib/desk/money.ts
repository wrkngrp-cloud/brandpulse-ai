import { createServiceClient } from '@/lib/supabase/server'
import type { StaffSession } from './auth'

/**
 * Revenue, for the Desk.
 *
 * Two layers of gate, deliberately. `revenue.view` decides whether a person
 * can open any of this; `data.revenue_figures` decides whether they see the
 * amounts. So business development can see which accounts pay and on what
 * plan without the numbers, and finance sees both.
 *
 * Gross margin subtracts what the account costs us to run, which only exists
 * because callAi logs cost. It is per month and per account, which is the
 * figure that will shape pricing, and it is null rather than zero for anyone
 * without the cost key.
 */

export interface SubscriptionRow {
  id:           string
  workspaceId:  string
  workspaceName: string
  plan:         string
  status:       'trialing' | 'active' | 'past_due' | 'cancelled'
  /** Null without data.revenue_figures. */
  amountNgn:    number | null
  interval:     'month' | 'year'
  provider:     'manual' | 'paystack'
  periodEnd:    string | null
  createdAt:    string
}

export interface InvoiceRow {
  id:            string
  workspaceId:   string
  workspaceName: string
  amountNgn:     number | null
  status:        string
  provider:      string
  paidAt:        string | null
  createdAt:     string
}

export interface RevenueSummary {
  /** Monthly recurring, in naira. Null without the figures key. */
  mrrNgn:        number | null
  activeCount:   number
  trialingCount: number
  pastDueCount:  number
  cancelledCount:number
  planMix:       { plan: string; count: number; mrrNgn: number | null }[]
  /** AI cost for the current month across every account. */
  aiCostUsdMtd:  number | null
  paidThisMonthNgn: number | null
  /** Accounts with no subscription row at all. The beta, mostly. */
  unbilled:      number
  subscriptions: SubscriptionRow[]
  invoices:      InvoiceRow[]
}

const MTD_START = () => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

/** A yearly price spread over twelve months, so the mix is comparable. */
function monthly(amountNgn: number, interval: 'month' | 'year'): number {
  return interval === 'year' ? Math.round(amountNgn / 12) : amountNgn
}

export async function revenueSummary(session: StaffSession): Promise<RevenueSummary | null> {
  if (!session.can('revenue.view')) return null

  const service = await createServiceClient()
  const shows   = session.sees('data.revenue_figures')
  const mtd     = MTD_START()

  const [{ data: subs }, { data: invs }, { data: workspaces }, { data: calls }] =
    await Promise.all([
      service.from('subscriptions')
        .select('id, workspace_id, plan, status, amount_ngn, interval, provider, current_period_end, created_at')
        .order('created_at', { ascending: false }).limit(2000),
      service.from('invoices')
        .select('id, workspace_id, amount_ngn, status, provider, paid_at, created_at')
        .order('created_at', { ascending: false }).limit(500),
      service.from('workspaces').select('id, name').limit(2000),
      session.sees('data.ai_cost')
        ? service.from('ai_calls').select('cost_usd').gte('created_at', mtd).limit(50_000)
        : Promise.resolve({ data: null }),
    ])

  const nameOf = new Map((workspaces ?? []).map(w => [w.id, w.name]))

  const active = (subs ?? []).filter(s => s.status === 'active')
  const mrr = active.reduce((sum, s) => sum + monthly(s.amount_ngn ?? 0, s.interval), 0)

  const mixMap = new Map<string, { count: number; mrr: number }>()
  for (const s of active) {
    const entry = mixMap.get(s.plan) ?? { count: 0, mrr: 0 }
    entry.count += 1
    entry.mrr   += monthly(s.amount_ngn ?? 0, s.interval)
    mixMap.set(s.plan, entry)
  }

  const paidThisMonth = (invs ?? [])
    .filter(i => i.status === 'paid' && i.paid_at && i.paid_at >= mtd)
    .reduce((sum, i) => sum + (i.amount_ngn ?? 0), 0)

  const withSubscription = new Set((subs ?? []).map(s => s.workspace_id))

  return {
    mrrNgn:         shows ? mrr : null,
    activeCount:    active.length,
    trialingCount:  (subs ?? []).filter(s => s.status === 'trialing').length,
    pastDueCount:   (subs ?? []).filter(s => s.status === 'past_due').length,
    cancelledCount: (subs ?? []).filter(s => s.status === 'cancelled').length,
    planMix: [...mixMap.entries()]
      .map(([plan, v]) => ({ plan, count: v.count, mrrNgn: shows ? v.mrr : null }))
      .sort((a, b) => b.count - a.count),
    aiCostUsdMtd: calls
      ? (calls as { cost_usd: number | null }[]).reduce((s, c) => s + Number(c.cost_usd ?? 0), 0)
      : null,
    paidThisMonthNgn: shows ? paidThisMonth : null,
    unbilled: (workspaces ?? []).filter(w => !withSubscription.has(w.id)).length,
    subscriptions: (subs ?? []).map(s => ({
      id:            s.id,
      workspaceId:   s.workspace_id,
      workspaceName: nameOf.get(s.workspace_id) ?? 'a deleted workspace',
      plan:          s.plan,
      status:        s.status as SubscriptionRow['status'],
      amountNgn:     shows ? s.amount_ngn : null,
      interval:      s.interval as 'month' | 'year',
      provider:      s.provider as 'manual' | 'paystack',
      periodEnd:     s.current_period_end,
      createdAt:     s.created_at,
    })),
    invoices: (invs ?? []).map(i => ({
      id:            i.id,
      workspaceId:   i.workspace_id,
      workspaceName: nameOf.get(i.workspace_id) ?? 'a deleted workspace',
      amountNgn:     shows ? i.amount_ngn : null,
      status:        i.status,
      provider:      i.provider,
      paidAt:        i.paid_at,
      createdAt:     i.created_at,
    })),
  }
}

/** Plan prices, so the entry form can offer the list price as a default. */
export async function planPrices(): Promise<{ plan: string; priceNgnMo: number }[]> {
  const service = await createServiceClient()
  const { data } = await service
    .from('plan_limits').select('plan, price_ngn_mo').order('price_ngn_mo')
  return (data ?? []).map(p => ({ plan: p.plan, priceNgnMo: p.price_ngn_mo }))
}
