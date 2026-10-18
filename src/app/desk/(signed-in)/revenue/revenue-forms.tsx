'use client'

import { useActionState, useState } from 'react'
import { saveSubscription, saveInvoice, type RevenueActionState } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Working } from '@/components/brand/working'

interface Account { id: string; name: string; plan: string }

/**
 * Entering revenue by hand.
 *
 * The interim path until Paystack is connected. The plan picker fills in the
 * list price, because retyping a number that is already in plan_limits is how
 * a figure gets entered wrong.
 */
export function RevenueForms({
  accounts, prices,
}: { accounts: Account[]; prices: { plan: string; priceNgnMo: number }[] }) {
  const [subState, subAction, subPending] = useActionState<RevenueActionState, FormData>(saveSubscription, null)
  const [invState, invAction, invPending] = useActionState<RevenueActionState, FormData>(saveInvoice, null)
  const [plan, setPlan] = useState(prices[0]?.plan ?? 'growth')

  const listPrice = prices.find(p => p.plan === plan)?.priceNgnMo ?? 0

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section className="rounded-xl border border-line bg-card p-4">
        <h2 className="text-sm font-medium">Record a subscription</h2>
        <p className="mt-1 text-xs text-tx-3">
          One per account. Saving again updates the same row rather than adding a second,
          which would double the MRR.
        </p>

        <form action={subAction} className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sub_ws">Account</Label>
            <select id="sub_ws" name="workspace_id" required
                    className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm">
              <option value="">Pick an account</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sub_plan">Plan</Label>
              <select
                id="sub_plan" name="plan" value={plan}
                onChange={e => setPlan(e.target.value)}
                className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm"
              >
                {prices.map(p => <option key={p.plan} value={p.plan}>{p.plan}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub_amount">Amount in naira</Label>
              {/* Keyed on the plan so changing the plan refills the list price,
                  while still being editable for a negotiated rate. */}
              <Input
                key={plan} id="sub_amount" name="amount_ngn" type="number" min={0}
                defaultValue={listPrice} required
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="sub_interval">Billed</Label>
              <select id="sub_interval" name="interval" defaultValue="month"
                      className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm">
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub_status">Status</Label>
              <select id="sub_status" name="status" defaultValue="active"
                      className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm">
                <option value="active">Active</option>
                <option value="trialing">Trialing</option>
                <option value="past_due">Past due</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub_period">Renews</Label>
              <Input id="sub_period" name="period_end" type="date" />
            </div>
          </div>

          <Button type="submit" size="sm" disabled={subPending}>
            {subPending ? <><Working className="size-3.5" /> Saving</> : 'Save subscription'}
          </Button>

          {subState?.error && <p className="text-xs text-neg" role="alert">{subState.error}</p>}
          {subState?.ok && <p className="text-xs text-tx-2" role="status">{subState.ok}</p>}
        </form>
      </section>

      <section className="rounded-xl border border-line bg-card p-4">
        <h2 className="text-sm font-medium">Record an invoice</h2>
        <p className="mt-1 text-xs text-tx-3">
          A paid invoice with no date gets today, so every figure can be placed in a month.
        </p>

        <form action={invAction} className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="inv_ws">Account</Label>
            <select id="inv_ws" name="workspace_id" required
                    className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm">
              <option value="">Pick an account</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv_amount">Amount in naira</Label>
              <Input id="inv_amount" name="amount_ngn" type="number" min={1} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv_status">Status</Label>
              <select id="inv_status" name="status" defaultValue="paid"
                      className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm">
                <option value="paid">Paid</option>
                <option value="sent">Sent</option>
                <option value="draft">Draft</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv_paid">Paid on</Label>
              <Input id="inv_paid" name="paid_at" type="date" />
            </div>
          </div>

          <Button type="submit" size="sm" disabled={invPending}>
            {invPending ? <><Working className="size-3.5" /> Saving</> : 'Save invoice'}
          </Button>

          {invState?.error && <p className="text-xs text-neg" role="alert">{invState.error}</p>}
          {invState?.ok && <p className="text-xs text-tx-2" role="status">{invState.ok}</p>}
        </form>
      </section>
    </div>
  )
}
