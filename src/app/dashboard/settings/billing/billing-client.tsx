'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Check, ExternalLink, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface PlanLimits {
  brand_count:  number
  user_count:   number
  survey_mo:    number
  ai_calls_mo:  number
  portal_links: number
  white_label:  boolean
  price_ngn_mo: number
}

interface Props {
  currentPlan:       string
  subscriptionStatus: string
  trialEndsAt:        string | null
  currentPeriodEnd:   string | null
  planLimits:         PlanLimits
  usage:              { brands: number; portalLinks: number; aiCalls: number; surveyResponses: number }
  planDisplay:        Record<string, { name: string; priceNGN: number; highlight: string }>
}

function fmtNGN(n: number) {
  if (n === 0) return 'Free'
  return `₦${(n / 1000).toFixed(0)}k/mo`
}

function fmtLimit(n: number) {
  return n === -1 ? 'Unlimited' : n.toLocaleString()
}

function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = limit === -1 ? 0 : Math.min(100, (used / limit) * 100)
  const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-green-500'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[12px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{used.toLocaleString()} / {fmtLimit(limit)}</span>
      </div>
      {limit !== -1 && (
        <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

const PLAN_ORDER = ['starter', 'growth', 'pro', 'agency', 'enterprise']

export function BillingClient({
  currentPlan, subscriptionStatus, trialEndsAt, currentPeriodEnd,
  planLimits, usage, planDisplay,
}: Props) {
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [portalPending, setPortalPending] = useState(false)

  async function upgrade(plan: string) {
    setUpgrading(plan)
    try {
      const res = await fetch('/api/billing/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.href = data.url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start checkout')
      setUpgrading(null)
    }
  }

  async function openPortal() {
    setPortalPending(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.href = data.url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open billing portal')
      setPortalPending(false)
    }
  }

  const statusColor = subscriptionStatus === 'active' ? 'text-green-600'
    : subscriptionStatus === 'trialing' ? 'text-blue-600'
    : subscriptionStatus === 'past_due' ? 'text-red-600'
    : 'text-muted-foreground'

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="eyebrow mb-1">Settings</p>
        <h1 className="h-display text-[26px] leading-none">Billing & Plan</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground/70">Manage your subscription and track usage.</p>
      </div>

      {/* Current plan summary */}
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Current plan</p>
            <p className="text-2xl font-bold capitalize">{planDisplay[currentPlan]?.name ?? currentPlan}</p>
            <p className={cn('text-[12.5px] font-medium mt-0.5 capitalize', statusColor)}>{subscriptionStatus}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{fmtNGN(planDisplay[currentPlan]?.priceNGN ?? 0)}</p>
            {trialEndsAt && subscriptionStatus === 'trialing' && (
              <p className="text-[12px] text-muted-foreground">Trial ends {new Date(trialEndsAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' })}</p>
            )}
            {currentPeriodEnd && subscriptionStatus === 'active' && (
              <p className="text-[12px] text-muted-foreground">Renews {new Date(currentPeriodEnd).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' })}</p>
            )}
          </div>
        </div>

        {/* Usage bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
          <UsageBar used={usage.brands}           limit={planLimits.brand_count}  label="Brands" />
          <UsageBar used={usage.portalLinks}      limit={planLimits.portal_links} label="Portal links" />
          <UsageBar used={usage.aiCalls}          limit={planLimits.ai_calls_mo}  label="AI calls this month" />
          <UsageBar used={usage.surveyResponses}  limit={planLimits.survey_mo}    label="Survey responses this month" />
        </div>

        {currentPlan !== 'starter' && (
          <Button variant="outline" size="sm" onClick={openPortal} disabled={portalPending}>
            {portalPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5 mr-1.5" />}
            Manage subscription
          </Button>
        )}
      </div>

      {/* Plan cards */}
      <div className="space-y-3">
        <p className="text-[13px] font-semibold">Available plans</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PLAN_ORDER.filter(p => p !== 'starter' && p !== 'enterprise').map(plan => {
            const display = planDisplay[plan]
            const isCurrent = plan === currentPlan
            return (
              <div key={plan} className={cn(
                'rounded-2xl border p-5 space-y-3 transition-all',
                isCurrent ? 'border-foreground bg-card' : 'border-border bg-card hover:border-border/80'
              )}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-[15px]">{display?.name}</p>
                    <p className="text-[12.5px] text-muted-foreground mt-0.5">{display?.highlight}</p>
                  </div>
                  {isCurrent && <Badge variant="secondary" className="text-[11px]">Current</Badge>}
                </div>
                <p className="text-xl font-bold">{fmtNGN(display?.priceNGN ?? 0)}</p>
                {!isCurrent ? (
                  PLAN_ORDER.indexOf(plan) > PLAN_ORDER.indexOf(currentPlan) ? (
                    <Button
                      size="sm" className="w-full"
                      onClick={() => upgrade(plan)}
                      disabled={!!upgrading}
                    >
                      {upgrading === plan
                        ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Redirecting...</>
                        : <><Zap className="h-3.5 w-3.5 mr-1.5" />Upgrade to {display?.name}</>}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full" onClick={openPortal}>
                      Downgrade
                    </Button>
                  )
                ) : (
                  <div className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-green-500" />Your current plan
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Enterprise */}
        <div className="rounded-2xl border border-dashed p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-[14px]">Enterprise</p>
            <p className="text-[12.5px] text-muted-foreground">Unlimited brands · Custom SLA · Dedicated onboarding</p>
          </div>
          <a
            href="mailto:hello@brandgauge.app?subject=Enterprise enquiry"
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            Contact us
          </a>
        </div>
      </div>
    </div>
  )
}
