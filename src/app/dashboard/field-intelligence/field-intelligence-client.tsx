'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ClipboardList, MapPin, Package, AlertTriangle, ChevronRight, TrendingDown } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Stats {
  totalOutlets: number
  availPct:     number
  posmPct:      number
  oos:          number
}

interface AreaRow {
  state:     string
  lga:       string | null
  total:     number
  available: number
  pct:       number
}

interface ReportRow {
  id:          string
  fso_name:    string
  fso_id_code: string | null
  report_date: string
  state:       string | null
  lga:         string | null
  notes:       string | null
  submitted_at: string
  fso_teams:   { name: string } | { name: string }[] | null
  outletStats: { total: number; available: number }
}

interface CompetitorRow {
  competitor_name:     string | null
  competitor_activity: string | null
  outlet_type:         string | null
  outlet_name:         string | null
  state:               string | null
  lga:                 string | null
  report_date:         string
}

interface Props {
  stats:          Stats
  areaBreakdown:  AreaRow[]
  recentReports:  ReportRow[]
  competitorFeed: CompetitorRow[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function availColor(pct: number) {
  if (pct >= 80) return 'text-emerald-600'
  if (pct >= 60) return 'text-amber-500'
  return 'text-red-500'
}

function availBg(pct: number) {
  if (pct >= 80) return 'bg-emerald-50 dark:bg-emerald-900/20'
  if (pct >= 60) return 'bg-amber-50 dark:bg-amber-900/20'
  return 'bg-red-50 dark:bg-red-900/20'
}

function teamName(fso_teams: ReportRow['fso_teams']): string {
  if (!fso_teams) return ''
  return Array.isArray(fso_teams) ? (fso_teams[0]?.name ?? '') : fso_teams.name
}

const OUTLET_LABELS: Record<string, string> = {
  supermarket:        'Supermarket',
  neighbourhood_shop: 'Neighbourhood Shop',
  pharmacy:           'Pharmacy',
  open_market:        'Open Market',
  petrol_station:     'Petrol Station',
  hospital:           'Hospital',
  other:              'Other',
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, suffix, colorFn, note,
}: {
  label:   string
  value:   number | string
  suffix?: string
  colorFn?: (v: number) => string
  note?:   string
}) {
  const numericVal = typeof value === 'number' ? value : parseInt(String(value), 10)
  const color = colorFn ? colorFn(numericVal) : undefined

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-1">
      <p className={cn('text-2xl font-bold tabular-nums', color)}>
        {value}{suffix}
      </p>
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      {note && <p className="text-[10px] text-muted-foreground/60">{note}</p>}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function FieldIntelligenceClient({ stats, areaBreakdown, recentReports, competitorFeed }: Props) {
  const hasData = stats.totalOutlets > 0

  if (!hasData) {
    return <EmptyState />
  }

  return (
    <div className="space-y-8">
      {/* Header stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Outlets visited"
          value={stats.totalOutlets}
          note="Last 30 days"
        />
        <StatCard
          label="Availability rate"
          value={stats.availPct}
          suffix="%"
          colorFn={availColor}
          note={stats.availPct >= 80 ? 'Good' : stats.availPct >= 60 ? 'Needs attention' : 'Critical'}
        />
        <StatCard
          label="POSM compliance"
          value={stats.posmPct}
          suffix="%"
          colorFn={availColor}
        />
        <StatCard
          label="Out-of-stock alerts"
          value={stats.oos}
          colorFn={v => v > 0 ? 'text-red-500' : 'text-foreground'}
          note={stats.oos > 0 ? 'Outlets with no product' : 'All outlets stocked'}
        />
      </div>

      {/* State/LGA breakdown */}
      {areaBreakdown.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Availability by area</h2>
            <span className="text-xs text-muted-foreground">(lowest first)</span>
          </div>
          <div className="overflow-x-auto -mx-1 px-1">
            <div className="rounded-xl border border-border overflow-hidden min-w-[360px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">State</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">LGA</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Outlets</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Availability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {areaBreakdown.map((row, i) => (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{row.state}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{row.lga ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{row.total}</td>
                      <td className={cn('px-4 py-2.5 text-right tabular-nums font-semibold', availColor(row.pct))}>
                        {row.pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Recent reports */}
      {recentReports.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Recent reports</h2>
          </div>
          <div className="space-y-2">
            {recentReports.map(r => {
              const avail = r.outletStats.total > 0
                ? Math.round((r.outletStats.available / r.outletStats.total) * 100)
                : 0
              return (
                <div key={r.id} className={cn('rounded-xl border border-border p-4', availBg(avail))}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{r.fso_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.report_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                        {r.state ? ` · ${r.state}` : ''}
                        {r.lga   ? ` · ${r.lga}`   : ''}
                        {' · '}{teamName(r.fso_teams)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn('text-sm font-bold tabular-nums', availColor(avail))}>{avail}%</p>
                      <p className="text-[10px] text-muted-foreground">{r.outletStats.total} outlets</p>
                    </div>
                  </div>
                  {r.notes && (
                    <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50 line-clamp-2">{r.notes}</p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Competitor feed */}
      {competitorFeed.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold">Competitor activity</h2>
            <span className="text-xs text-muted-foreground">Last 30 days</span>
          </div>
          <div className="space-y-2">
            {competitorFeed.map((c, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{c.competitor_name ?? 'Unknown'}</span>
                  {c.outlet_type && (
                    <span className="text-[10px] text-muted-foreground">· {OUTLET_LABELS[c.outlet_type] ?? c.outlet_type}</span>
                  )}
                </div>
                <p className="text-sm text-foreground">{c.competitor_activity}</p>
                <p className="text-xs text-muted-foreground">
                  {c.outlet_name && `${c.outlet_name} · `}
                  {c.state}{c.lga ? ` · ${c.lga}` : ''}{' · '}
                  {new Date(c.report_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center gap-6">
      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
        <Package className="h-8 w-8 text-muted-foreground" />
      </div>

      <div className="space-y-2 max-w-md">
        <h2 className="text-lg font-bold">Field intelligence gives your brand a live view</h2>
        <p className="text-sm text-muted-foreground">
          Track product availability, pricing compliance, POSM placement, and competitor activity across your full distribution network — updated daily by your field team.
        </p>
      </div>

      <div className="space-y-3 text-left max-w-sm w-full">
        {[
          { step: '1', text: 'Create an FSO team in Settings → Field Teams' },
          { step: '2', text: 'Share the link with your field officers via WhatsApp' },
          { step: '3', text: 'They submit daily route reports from their phone — no app needed' },
          { step: '4', text: 'See aggregated insights here within seconds' },
        ].map(({ step, text }) => (
          <div key={step} className="flex gap-3 items-start">
            <span className="shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
              {step}
            </span>
            <p className="text-sm text-muted-foreground pt-0.5">{text}</p>
          </div>
        ))}
      </div>

      <Link
        href="/dashboard/settings/field-teams"
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        Set up field team
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
