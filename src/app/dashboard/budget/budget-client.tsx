'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DollarSign, Plus, RefreshCw, Loader2, X,
  ChevronDown, ChevronRight, TrendingUp, AlertCircle,
  CheckCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn, formatNGN } from '@/lib/utils'
import { toast } from 'sonner'
import { TourTrigger } from '@/components/tours/tour-trigger'

interface LineItem {
  id:             string
  channel:        string
  label:          string
  planned_amount: number
  actual_amount:  number
  currency:       string
  actuals:        { id: string; amount: number; description: string; spent_on: string }[]
}

interface BudgetPlan {
  id:           string
  name:         string
  period_start: string
  period_end:   string
  total_budget: number
  currency:     string
  status:       string
  notes:        string | null
  line_items:   LineItem[]
}

const CHANNEL_COLOR: Record<string, string> = {
  digital:    'bg-blue-100 text-blue-800',
  tv:         'bg-purple-100 text-purple-800',
  radio:      'bg-green-100 text-green-800',
  ooh:        'bg-orange-100 text-orange-800',
  influencer: 'bg-pink-100 text-pink-800',
  events:     'bg-yellow-100 text-yellow-800',
  print:      'bg-gray-100 text-gray-800',
  other:      'bg-slate-100 text-slate-800',
}

export function BudgetClient() {
  const [plans, setPlans]           = useState<BudgetPlan[]>([])
  const [loading, setLoading]       = useState(true)
  const [showNewPlan, setShowNewPlan] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [addLineFor, setAddLineFor] = useState<string | null>(null)
  const [addActualFor, setAddActualFor] = useState<string | null>(null) // line_item id

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/budget/plans')
    if (res.ok) setPlans((await res.json()).plans ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const activePlan = plans.find(p => p.status === 'active')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Budget & Pacing</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track planned vs. actual spend across channels
          </p>
        </div>
        <div className="flex gap-2">
          <TourTrigger module="budget" autoStart />
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowNewPlan(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New plan
          </Button>
        </div>
      </div>

      <div data-tour="budget-main">
      {/* Active plan summary */}
      {activePlan && (
        <ActivePlanSummary plan={activePlan} />
      )}

      {/* New plan form */}
      {showNewPlan && (
        <NewPlanForm
          onSave={async (data) => {
            const res = await fetch('/api/budget/plans', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
            })
            if (!res.ok) { toast.error('Failed to create plan'); return }
            toast.success('Budget plan created')
            setShowNewPlan(false)
            load()
          }}
          onCancel={() => setShowNewPlan(false)}
        />
      )}

      {loading && plans.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && plans.length === 0 && (
        <div className="rounded-xl border border-dashed p-16 text-center">
          <DollarSign className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No budget plans yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Create your first budget plan to start tracking planned vs. actual spend by channel.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {plans.map(plan => (
          <div key={plan.id} className="rounded-xl border bg-card overflow-hidden">
            {/* Plan header */}
            <button
              onClick={() => setExpandedId(expandedId === plan.id ? null : plan.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 text-left"
            >
              {expandedId === plan.id ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{plan.name}</span>
                  <Badge variant={plan.status === 'active' ? 'default' : 'secondary'} className="text-xs capitalize">
                    {plan.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(plan.period_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' })} –{' '}
                  {new Date(plan.period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' })}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold">{formatNGN(plan.total_budget)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatNGN(plan.line_items?.reduce((s, li) => s + li.actual_amount, 0) ?? 0)} spent
                </p>
              </div>
            </button>

            {/* Expanded: line items */}
            {expandedId === plan.id && (
              <div className="border-t px-4 py-4 space-y-4">
                {/* Spend progress */}
                <SpendProgress plan={plan} />

                {/* Line items table */}
                {plan.line_items?.length > 0 && (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted border-b">
                        <tr>
                          {['Channel', 'Line item', 'Planned', 'Actual', 'Variance', 'Pacing', ''].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {plan.line_items.map(li => {
                          const variance    = li.actual_amount - li.planned_amount
                          const pacingPct   = li.planned_amount > 0 ? (li.actual_amount / li.planned_amount) * 100 : 0
                          const isOver      = variance > 0
                          return (
                            <tr key={li.id} className="hover:bg-muted/20">
                              <td className="px-3 py-2">
                                <span className={cn('px-1.5 py-0.5 rounded text-[11px] font-medium capitalize', CHANNEL_COLOR[li.channel] ?? 'bg-muted')}>
                                  {li.channel}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-medium">{li.label}</td>
                              <td className="px-3 py-2">{formatNGN(li.planned_amount)}</td>
                              <td className="px-3 py-2">{formatNGN(li.actual_amount)}</td>
                              <td className={cn('px-3 py-2 font-medium', isOver ? 'text-red-600' : variance < 0 ? 'text-green-600' : 'text-muted-foreground')}>
                                {variance !== 0 ? (isOver ? '+' : '') + formatNGN(variance) : '—'}
                              </td>
                              <td className="px-3 py-2 w-28">
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1 bg-muted rounded-full h-1.5">
                                    <div
                                      className={cn('h-1.5 rounded-full', pacingPct > 110 ? 'bg-red-500' : pacingPct > 90 ? 'bg-yellow-500' : 'bg-green-500')}
                                      style={{ width: `${Math.min(100, pacingPct)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground w-8 shrink-0">{Math.round(pacingPct)}%</span>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  onClick={() => setAddActualFor(addActualFor === li.id ? null : li.id)}
                                  className="text-xs text-primary hover:underline"
                                >
                                  + Actual
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add actual spend inline form */}
                {addActualFor && plan.line_items.some(li => li.id === addActualFor) && (
                  <AddActualForm
                    lineItemId={addActualFor}
                    onSave={async (data) => {
                      const res = await fetch('/api/budget/actuals', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
                      })
                      if (!res.ok) { toast.error('Failed to log spend'); return }
                      toast.success('Spend logged')
                      setAddActualFor(null)
                      load()
                    }}
                    onCancel={() => setAddActualFor(null)}
                  />
                )}

                {/* Add line item */}
                {addLineFor === plan.id ? (
                  <AddLineItemForm
                    planId={plan.id}
                    onSave={async (data) => {
                      const res = await fetch(`/api/budget/plans/${plan.id}/line-items`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
                      })
                      if (!res.ok) { toast.error('Failed to add line item'); return }
                      toast.success('Line item added')
                      setAddLineFor(null)
                      load()
                    }}
                    onCancel={() => setAddLineFor(null)}
                  />
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setAddLineFor(plan.id)}>
                    <Plus className="h-3 w-3 mr-1.5" />
                    Add line item
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      </div>
    </div>
  )
}

function ActivePlanSummary({ plan }: { plan: BudgetPlan }) {
  const totalActual  = plan.line_items?.reduce((s, li) => s + li.actual_amount, 0) ?? 0
  const pacingPct    = plan.total_budget > 0 ? (totalActual / plan.total_budget) * 100 : 0
  const remaining    = plan.total_budget - totalActual
  const daysTotal    = Math.round((new Date(plan.period_end).getTime() - new Date(plan.period_start).getTime()) / 86400_000)
  const daysElapsed  = Math.round((Date.now() - new Date(plan.period_start).getTime()) / 86400_000)
  const timePct      = daysTotal > 0 ? (daysElapsed / daysTotal) * 100 : 0
  const paceGap      = pacingPct - timePct // positive = spending ahead of time

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">Active plan: {plan.name}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div><p className="text-xs text-muted-foreground">Total budget</p><p className="font-bold">{formatNGN(plan.total_budget)}</p></div>
        <div><p className="text-xs text-muted-foreground">Spent</p><p className="font-bold">{formatNGN(totalActual)}</p></div>
        <div><p className="text-xs text-muted-foreground">Remaining</p><p className="font-bold">{formatNGN(remaining)}</p></div>
        <div>
          <p className="text-xs text-muted-foreground">Pace</p>
          <div className="flex items-center gap-1">
            {Math.abs(paceGap) < 5
              ? <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              : paceGap > 5
                ? <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
                : <AlertCircle className="h-3.5 w-3.5 text-blue-500" />}
            <span className="text-sm font-bold">
              {Math.abs(paceGap) < 5 ? 'On track' : paceGap > 5 ? 'Ahead' : 'Behind'}
            </span>
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Spend ({Math.round(pacingPct)}%)</span>
          <span>Time ({Math.round(timePct)}%)</span>
        </div>
        <div className="relative bg-muted rounded-full h-2">
          <div className="absolute h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, pacingPct)}%` }} />
          <div className="absolute h-2 w-0.5 bg-foreground/30" style={{ left: `${Math.min(100, timePct)}%` }} />
        </div>
      </div>
    </div>
  )
}

function SpendProgress({ plan }: { plan: BudgetPlan }) {
  const byChannel: Record<string, { planned: number; actual: number }> = {}
  for (const li of plan.line_items ?? []) {
    if (!byChannel[li.channel]) byChannel[li.channel] = { planned: 0, actual: 0 }
    byChannel[li.channel].planned += li.planned_amount
    byChannel[li.channel].actual  += li.actual_amount
  }

  return (
    <div className="space-y-2">
      {Object.entries(byChannel).map(([ch, { planned, actual }]) => {
        const pct = planned > 0 ? Math.min(100, (actual / planned) * 100) : 0
        return (
          <div key={ch} className="flex items-center gap-3">
            <span className={cn('px-1.5 py-0.5 rounded text-[11px] font-medium capitalize w-20 text-center shrink-0', CHANNEL_COLOR[ch] ?? 'bg-muted')}>
              {ch}
            </span>
            <div className="flex-1 bg-muted rounded-full h-2">
              <div
                className={cn('h-2 rounded-full', pct > 110 ? 'bg-red-500' : pct > 90 ? 'bg-yellow-500' : 'bg-primary')}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(pct)}%</span>
            <span className="text-xs font-medium w-24 text-right">{formatNGN(actual)}</span>
          </div>
        )
      })}
    </div>
  )
}

function NewPlanForm({ onSave, onCancel }: { onSave: (d: Record<string, unknown>) => void; onCancel: () => void }) {
  const [name, setName]     = useState('')
  const [start, setStart]   = useState('')
  const [end, setEnd]       = useState('')
  const [budget, setBudget] = useState('')
  const [saving, setSave]   = useState(false)

  const handle = async () => {
    if (!name || !start || !end || !budget) { toast.error('All fields required'); return }
    setSave(true)
    await onSave({ name, period_start: start, period_end: end, total_budget: parseFloat(budget) })
    setSave(false)
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm">New budget plan</p>
        <button onClick={onCancel}><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Plan name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q3 2026 Marketing" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Total budget (₦) *</Label>
          <Input value={budget} onChange={e => setBudget(e.target.value)} type="number" placeholder="0" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Start date *</Label>
          <Input value={start} onChange={e => setStart(e.target.value)} type="date" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">End date *</Label>
          <Input value={end} onChange={e => setEnd(e.target.value)} type="date" className="mt-1" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handle} disabled={saving}>
          {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Create plan
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function AddLineItemForm({ planId, onSave, onCancel }: { planId: string; onSave: (d: Record<string, unknown>) => void; onCancel: () => void }) {
  const [channel, setChannel] = useState('digital')
  const [label, setLabel]     = useState('')
  const [amount, setAmount]   = useState('')
  const [saving, setSave]     = useState(false)

  const handle = async () => {
    if (!label || !amount) { toast.error('Label and amount required'); return }
    setSave(true)
    await onSave({ channel, label, planned_amount: parseFloat(amount) })
    setSave(false)
  }

  return (
    <div className="rounded-lg border bg-muted/10 p-4 space-y-3">
      <p className="text-xs font-medium">Add line item</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Channel</Label>
          <select value={channel} onChange={e => setChannel(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background">
            {['digital', 'tv', 'radio', 'ooh', 'influencer', 'events', 'print', 'other'].map(c => (
              <option key={c} value={c} className="capitalize">{c}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Label *</Label>
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Meta Ads" className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Planned (₦) *</Label>
          <Input value={amount} onChange={e => setAmount(e.target.value)} type="number" placeholder="0" className="mt-1 h-8 text-sm" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handle} disabled={saving}>
          {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Add
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function AddActualForm({ lineItemId, onSave, onCancel }: { lineItemId: string; onSave: (d: Record<string, unknown>) => void; onCancel: () => void }) {
  const [amount, setAmount]   = useState('')
  const [desc, setDesc]       = useState('')
  const [ref, setRef]         = useState('')
  const [date, setDate]       = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSave]     = useState(false)

  const handle = async () => {
    if (!amount || !desc) { toast.error('Amount and description required'); return }
    setSave(true)
    await onSave({ line_item_id: lineItemId, amount: parseFloat(amount), description: desc, reference: ref || undefined, spent_on: date })
    setSave(false)
  }

  return (
    <div className="rounded-lg border bg-blue-50/50 border-blue-200 p-4 space-y-3">
      <p className="text-xs font-medium text-blue-800">Log actual spend</p>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Amount (₦) *</Label>
          <Input value={amount} onChange={e => setAmount(e.target.value)} type="number" placeholder="0" className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Description *</Label>
          <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Invoice for..." className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Reference</Label>
          <Input value={ref} onChange={e => setRef(e.target.value)} placeholder="INV-001" className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Date</Label>
          <Input value={date} onChange={e => setDate(e.target.value)} type="date" className="mt-1 h-8 text-sm" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handle} disabled={saving}>
          {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Log spend
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}
