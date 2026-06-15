'use client'

import { cn } from '@/lib/utils'
import { CampaignAiSummary } from './campaign-ai-summary'

const OBJECTIVE_META: Record<string, { label: string; color: string }> = {
  awareness:     { label: 'Brand Awareness',  color: 'bg-blue-500' },
  consideration: { label: 'Consideration',    color: 'bg-purple-500' },
  conversion:    { label: 'Conversion',       color: 'bg-green-500' },
  retention:     { label: 'Retention',        color: 'bg-amber-500' },
}

const CHANNEL_META: Record<string, { label: string; color: string }> = {
  ooh:     { label: 'OOH / Outdoor',        color: 'bg-blue-400' },
  events:  { label: 'Events & Activations',  color: 'bg-emerald-400' },
  digital: { label: 'Digital',              color: 'bg-violet-400' },
  radio:   { label: 'Radio',                color: 'bg-orange-400' },
  tv:      { label: 'TV',                   color: 'bg-red-400' },
  print:   { label: 'Print',                color: 'bg-stone-400' },
}

interface Channel {
  id: string
  channel: string
  budget_allocation: number | null
  objectives: string[]
}

interface CampaignOverviewProps {
  campaign: {
    id: string
    name: string
    objectives: string[]
    start_date: string | null
    end_date: string | null
    total_budget: number | null
    currency: string
    status: string
    ai_summary?: string | null
    campaign_channels: Channel[]
  }
  oohSites: { visits: number; monthly_cost: number | null; currency: string | null }[]
  events:   { status: string }[]
  today?: string
}

function fmtMoney(v: number | null, cur = 'NGN') {
  if (!v) return '—'
  return `${cur} ${Number(v).toLocaleString('en-NG')}`
}

function pct(n: number, total: number) {
  if (!total) return 0
  return Math.min(100, Math.round((n / total) * 100))
}

/** Returns 0–100 representing where today sits in the campaign timeline */
function timelineProgress(start: string | null, end: string | null): number {
  if (!start) return 0
  const s   = new Date(start).getTime()
  const now = Date.now()
  if (now <= s) return 0
  if (!end)  return 100  // Always On
  const e = new Date(end).getTime()
  if (now >= e) return 100
  return Math.round(((now - s) / (e - s)) * 100)
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

function fmtDateShort(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

export function CampaignOverview({ campaign, oohSites, events }: CampaignOverviewProps) {
  const { objectives = [], campaign_channels: channels = [], start_date, end_date } = campaign

  const totalVisits   = oohSites.reduce((s, s2) => s + (s2.visits ?? 0), 0)
  const totalOohSpend = oohSites.reduce((s, s2) => s + (Number(s2.monthly_cost) || 0), 0)
  const totalAllocated = channels.reduce((s, ch) => s + (Number(ch.budget_allocation) || 0), 0)
  const remainingBudget = campaign.total_budget ? Number(campaign.total_budget) - totalAllocated : null

  const liveEvents     = events.filter(e => e.status === 'live').length
  const closedEvents   = events.filter(e => e.status === 'closed' || e.status === 'reported').length
  const progress       = timelineProgress(start_date, end_date)
  const daysTotal      = start_date && end_date ? daysBetween(start_date, end_date) : null
  const daysElapsed    = start_date ? Math.max(0, daysBetween(start_date, new Date().toISOString().slice(0, 10))) : null

  return (
    <div className="space-y-5">
      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'OOH visits',     value: totalVisits.toLocaleString() },
          { label: 'Events',         value: `${events.length} total · ${liveEvents} live · ${closedEvents} closed` },
          { label: 'OOH sites',      value: oohSites.length.toString() },
          { label: 'Total budget',   value: fmtMoney(campaign.total_budget, campaign.currency) },
        ].map(m => (
          <div key={m.label} className="border rounded-xl p-4 bg-card space-y-1">
            <p className="text-lg font-semibold tabular-nums leading-tight">{m.value}</p>
            <p className="text-xs text-muted-foreground">{m.label}</p>
          </div>
        ))}
      </div>

      {/* ── AI summary (top of overview) ── */}
      <CampaignAiSummary
        campaignId={campaign.id}
        initialSummary={campaign.ai_summary ?? null}
      />

      {/* ── Objectives ── */}
      {objectives.length > 0 && (
        <div className="border rounded-xl p-5 bg-card space-y-3">
          <p className="text-sm font-medium">Campaign objectives</p>
          <div className="flex flex-wrap gap-2">
            {objectives.map(obj => {
              const meta = OBJECTIVE_META[obj]
              if (!meta) return null
              return (
                <span
                  key={obj}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-muted"
                >
                  <span className={cn('h-2 w-2 rounded-full', meta.color)} />
                  {meta.label}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Campaign Timeline / Gantt ── */}
      <div className="border rounded-xl p-5 bg-card space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Campaign timeline</p>
          {daysTotal !== null && daysElapsed !== null && (
            <p className="text-xs text-muted-foreground">
              Day {Math.min(daysElapsed, daysTotal)} of {daysTotal}
              {end_date ? '' : ' (Always On)'}
            </p>
          )}
        </div>

        {/* Overall timeline bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{fmtDateShort(start_date)}</span>
            <span>{end_date ? fmtDateShort(end_date) : 'Always On'}</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-foreground rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right">{progress}% elapsed</p>
        </div>

        {/* Per-channel Gantt rows */}
        {channels.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Channels</p>
            {channels.map(ch => {
              const meta    = CHANNEL_META[ch.channel] ?? { label: ch.channel, color: 'bg-muted-foreground' }
              const linked  = ch.objectives ?? []
              const barPct  = progress  // channels run for the full campaign duration for now

              return (
                <div key={ch.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 rounded-full shrink-0', meta.color)} />
                      <span className="font-medium">{meta.label}</span>
                      {ch.budget_allocation && (
                        <span className="text-muted-foreground">
                          {fmtMoney(ch.budget_allocation, campaign.currency)}
                        </span>
                      )}
                    </div>
                    {linked.length > 0 && (
                      <div className="flex gap-1">
                        {linked.map(obj => (
                          <span
                            key={obj}
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              OBJECTIVE_META[obj]?.color ?? 'bg-muted-foreground',
                            )}
                            title={OBJECTIVE_META[obj]?.label}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', meta.color)}
                      style={{ width: `${barPct}%`, opacity: 0.7 }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Objective legend */}
        {objectives.length > 0 && channels.some(ch => ch.objectives?.length > 0) && (
          <div className="flex items-center gap-3 pt-1 border-t">
            <p className="text-xs text-muted-foreground shrink-0">Objective dots:</p>
            <div className="flex flex-wrap gap-2">
              {objectives.map(obj => (
                <span key={obj} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className={cn('h-2 w-2 rounded-full', OBJECTIVE_META[obj]?.color)} />
                  {OBJECTIVE_META[obj]?.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Budget breakdown ── */}
      {(totalAllocated > 0 || campaign.total_budget) && (
        <div className="border rounded-xl p-5 bg-card space-y-3">
          <p className="text-sm font-medium">Budget</p>
          <div className="space-y-2">
            {campaign.total_budget && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total budget</span>
                  <span className="font-medium">{fmtMoney(campaign.total_budget, campaign.currency)}</span>
                </div>
                {totalAllocated > 0 && (
                  <>
                    {/* Allocation bar */}
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-foreground rounded-full"
                        style={{ width: `${pct(totalAllocated, Number(campaign.total_budget))}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {pct(totalAllocated, Number(campaign.total_budget))}% allocated across channels
                    </p>
                  </>
                )}
              </>
            )}

            {channels.map(ch => {
              if (!ch.budget_allocation) return null
              const meta = CHANNEL_META[ch.channel]
              return (
                <div key={ch.id} className="flex justify-between text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', meta?.color ?? 'bg-muted-foreground')} />
                    <span>{meta?.label ?? ch.channel}</span>
                  </div>
                  <span>{fmtMoney(ch.budget_allocation, campaign.currency)}</span>
                </div>
              )
            })}

            {remainingBudget !== null && totalAllocated > 0 && (
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-muted-foreground">Unallocated</span>
                <span className={remainingBudget < 0 ? 'text-destructive' : ''}>
                  {fmtMoney(Math.abs(remainingBudget), campaign.currency)}
                  {remainingBudget < 0 ? ' over' : ' remaining'}
                </span>
              </div>
            )}

            {totalOohSpend > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground border-t pt-2">
                <span>OOH monthly spend (entered)</span>
                <span>{fmtMoney(totalOohSpend, campaign.currency)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Channel × Objective attribution matrix ── */}
      {channels.length > 0 && objectives.length > 0 && channels.some(ch => ch.objectives?.length > 0) && (
        <div className="border rounded-xl p-5 bg-card space-y-3">
          <p className="text-sm font-medium">Channel attribution to objectives</p>
          <p className="text-xs text-muted-foreground">Which channels are driving which objectives.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left text-muted-foreground font-medium pb-2 pr-4">Channel</th>
                  {objectives.map(obj => (
                    <th key={obj} className="text-center text-muted-foreground font-medium pb-2 px-2">
                      {OBJECTIVE_META[obj]?.label ?? obj}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {channels.map(ch => {
                  const meta   = CHANNEL_META[ch.channel]
                  const linked = ch.objectives ?? []
                  return (
                    <tr key={ch.id}>
                      <td className="py-2 pr-4 font-medium flex items-center gap-1.5">
                        <span className={cn('h-2 w-2 rounded-full inline-block', meta?.color)} />
                        {meta?.label ?? ch.channel}
                      </td>
                      {objectives.map(obj => (
                        <td key={obj} className="text-center py-2 px-2">
                          {linked.includes(obj)
                            ? <span className={cn('inline-block h-3 w-3 rounded-full', OBJECTIVE_META[obj]?.color ?? 'bg-foreground')} />
                            : <span className="text-muted-foreground/30">·</span>
                          }
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
