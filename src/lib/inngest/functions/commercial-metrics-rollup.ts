import { inngest } from '@/lib/inngest/client'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Commercial metrics rollup (6 AM Lagos, after the 5 AM Meta Ads sync).
 *
 * Rolls real connected-source data up into metric_manual for the current
 * calendar month so computeCommercialMetrics() picks it up with zero changes:
 *   - total_spend      ← digital_performance_daily (only if an ad account is connected)
 *   - revenue_monthly  ← purchase_events + ecommerce_sales (only if rows exist)
 *   - new_customers    ← first-ever identity this period, preferring app
 *                        signups (sdk_events, event_type 'signup') when the
 *                        brand has any this period, falling back to
 *                        first-ever purchase identities in purchase_events.
 *                        Signups are the right signal for apps whose growth
 *                        event is "created an account," not a payment — a
 *                        payments app's own users, a SaaS trial, etc.
 *   - mql_count        ← sdk_events with event_type 'lead'
 *
 * Every upsert is independent and strictly conditional: if a brand has no
 * real data source for a metric, that metric is skipped entirely and any
 * manually entered metric_manual row is left untouched. We never write a
 * zero just because a connector is missing.
 */

const PAGE_SIZE = 1000

interface PurchaseRow {
  customer_email: string | null
  customer_phone: string | null
  amount:         number | string | null
  occurred_at:    string
}

export const commercialMetricsRollup = inngest.createFunction(
  {
    id:   'commercial-metrics-rollup',
    name: 'Commercial metrics rollup (6 AM Lagos)',
    triggers: [{ cron: 'TZ=Africa/Lagos 0 6 * * *' }],
  },
  async ({ step, logger }) => {
    const supabase = await createServiceClient()

    const { data: brands } = await supabase.from('brands').select('id, name')

    if (!brands?.length) {
      logger.info('No brands to roll up')
      return { processed: 0 }
    }

    // Current calendar month bounds (same convention as the seed scripts' monthBounds)
    const today       = new Date()
    const periodStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    const periodEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
    // Exclusive upper bound for timestamptz comparisons (first day of next month)
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString().split('T')[0]

    let processed = 0

    for (const brand of brands) {
      await step.run(`rollup-${brand.id}`, async () => {
        try {
          const upsertMetric = async (metricKey: string, value: number, notes: string) => {
            const { error } = await supabase.from('metric_manual').upsert(
              {
                brand_id:     brand.id,
                metric_key:   metricKey,
                value,
                currency:     'NGN',
                period_start: periodStart,
                period_end:   periodEnd,
                notes,
                entered_by:   null,
                updated_at:   new Date().toISOString(),
              },
              { onConflict: 'brand_id,metric_key,period_start' }
            )
            if (error) {
              logger.error(`Failed to upsert ${metricKey} for brand ${brand.id}: ${error.message}`)
            }
          }

          // ── 1. total_spend — only when a real ad account is connected ──────
          const { count: adAccountCount } = await supabase
            .from('digital_ad_accounts')
            .select('id', { count: 'exact', head: true })
            .eq('brand_id', brand.id)

          if ((adAccountCount ?? 0) > 0) {
            let totalSpend = 0
            for (let from = 0; ; from += PAGE_SIZE) {
              const { data: rows, error } = await supabase
                .from('digital_performance_daily')
                .select('spend')
                .eq('brand_id', brand.id)
                .gte('date', periodStart)
                .lte('date', periodEnd)
                .range(from, from + PAGE_SIZE - 1)
              if (error) throw new Error(`digital_performance_daily fetch failed: ${error.message}`)
              if (!rows?.length) break
              for (const r of rows) totalSpend += Number(r.spend ?? 0)
              if (rows.length < PAGE_SIZE) break
            }
            await upsertMetric('total_spend', totalSpend, 'Auto-synced from connected ad accounts')
          }

          // ── 2. Successful purchases (all time, used by revenue + new customers)
          const purchases: PurchaseRow[] = []
          for (let from = 0; ; from += PAGE_SIZE) {
            const { data: rows, error } = await supabase
              .from('purchase_events')
              .select('customer_email, customer_phone, amount, occurred_at')
              .eq('brand_id', brand.id)
              .eq('status', 'success')
              .order('occurred_at', { ascending: true })
              .range(from, from + PAGE_SIZE - 1)
            if (error) throw new Error(`purchase_events fetch failed: ${error.message}`)
            if (!rows?.length) break
            purchases.push(...(rows as PurchaseRow[]))
            if (rows.length < PAGE_SIZE) break
          }

          const inPeriod = (ts: string) => ts >= periodStart && ts < nextMonthStart
          const periodPurchases = purchases.filter(p => inPeriod(p.occurred_at))

          // ── 3. revenue_monthly — purchase_events + ecommerce_sales ─────────
          let ecommerceTotal = 0
          let ecommerceRowCount = 0
          for (let from = 0; ; from += PAGE_SIZE) {
            const { data: rows, error } = await supabase
              .from('ecommerce_sales')
              .select('amount')
              .eq('brand_id', brand.id)
              .gte('sold_at', periodStart)
              .lt('sold_at', nextMonthStart)
              .range(from, from + PAGE_SIZE - 1)
            if (error) throw new Error(`ecommerce_sales fetch failed: ${error.message}`)
            if (!rows?.length) break
            ecommerceRowCount += rows.length
            for (const r of rows) ecommerceTotal += Number(r.amount ?? 0)
            if (rows.length < PAGE_SIZE) break
          }

          if (periodPurchases.length > 0 || ecommerceRowCount > 0) {
            const purchaseTotal = periodPurchases.reduce((sum, p) => sum + Number(p.amount ?? 0), 0)
            await upsertMetric(
              'revenue_monthly',
              purchaseTotal + ecommerceTotal,
              'Auto-synced from connected payment/e-commerce sources'
            )
          }

          // ── 4. new_customers — prefer app signups, fall back to purchases ──
          // Identity = metadata.email (lowercased), falling back to
          // metadata.phone then metadata.user_id. A customer is "new" only
          // if their earliest signup event for this brand, across all time,
          // falls inside the current period.
          const signupRows: { metadata: Record<string, unknown> | null; occurred_at: string }[] = []
          for (let from = 0; ; from += PAGE_SIZE) {
            const { data: rows, error } = await supabase
              .from('sdk_events')
              .select('metadata, occurred_at')
              .eq('brand_id', brand.id)
              .eq('event_type', 'signup')
              .range(from, from + PAGE_SIZE - 1)
            if (error) throw new Error(`sdk_events (signup) fetch failed: ${error.message}`)
            if (!rows?.length) break
            signupRows.push(...(rows as typeof signupRows))
            if (rows.length < PAGE_SIZE) break
          }

          const periodSignups = signupRows.filter(r => inPeriod(r.occurred_at))

          if (periodSignups.length > 0) {
            // Real signup activity this period — this is the authoritative
            // signal for apps whose growth event is a signup, not a payment.
            const firstSignupAt = new Map<string, string>()
            for (const r of signupRows) {
              const meta  = (r.metadata ?? {}) as Record<string, unknown>
              const email = typeof meta.email === 'string' ? meta.email.toLowerCase().trim() : undefined
              const phone = typeof meta.phone === 'string' ? meta.phone.trim() : undefined
              const userId = typeof meta.user_id === 'string' ? meta.user_id.trim() : undefined
              const key = email || phone || userId
              if (!key) continue
              const existing = firstSignupAt.get(key)
              if (!existing || r.occurred_at < existing) firstSignupAt.set(key, r.occurred_at)
            }

            let newCustomersFromSignups = 0
            for (const [, firstAt] of firstSignupAt) {
              if (inPeriod(firstAt)) newCustomersFromSignups++
            }

            if (newCustomersFromSignups > 0) {
              await upsertMetric('new_customers', newCustomersFromSignups, 'Auto-synced from app signup events')
            }
          } else if (periodPurchases.length > 0) {
            // No signup tracking this period — fall back to first-ever
            // purchase identities, the right signal for businesses whose
            // "new customer" is whoever made their first payment.
            const firstPurchaseAt = new Map<string, string>()
            for (const p of purchases) {
              const email = p.customer_email?.toLowerCase().trim()
              const phone = p.customer_phone?.trim()
              const key = email || phone
              if (!key) continue
              const existing = firstPurchaseAt.get(key)
              if (!existing || p.occurred_at < existing) firstPurchaseAt.set(key, p.occurred_at)
            }

            let newCustomers = 0
            for (const [, firstAt] of firstPurchaseAt) {
              if (inPeriod(firstAt)) newCustomers++
            }

            if (newCustomers > 0) {
              await upsertMetric('new_customers', newCustomers, 'Auto-synced from purchase-based customer identity')
            }
          }

          // ── 5. mql_count — tracking-pixel lead events ──────────────────────
          const { count: leadCount } = await supabase
            .from('sdk_events')
            .select('id', { count: 'exact', head: true })
            .eq('brand_id', brand.id)
            .eq('event_type', 'lead')
            .gte('occurred_at', periodStart)
            .lt('occurred_at', nextMonthStart)

          if ((leadCount ?? 0) > 0) {
            await upsertMetric('mql_count', leadCount as number, 'Auto-synced from tracking-pixel lead events')
          }

          processed++
        } catch (err) {
          logger.error(`Commercial metrics rollup failed for brand ${brand.id} (${brand.name}): ${String(err)}`)
        }
      })
    }

    return { processed }
  }
)
