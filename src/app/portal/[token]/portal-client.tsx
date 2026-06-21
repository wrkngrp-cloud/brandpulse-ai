'use client'

import { useState, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, AreaChart, Area, BarChart, Bar, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus, Activity, Radio, MessageSquare,
  DollarSign, Target, Award, AlertCircle, CheckCircle2, ChevronRight,
  RefreshCw, Calendar, BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

type Range = '7d' | '30d' | '90d' | '6m'

interface Campaign {
  id:         string
  name:       string
  channel:    string
  status:     string
  budget:     number | null
  spend:      number | null
  start_date: string
  end_date:   string | null
}

interface PortalData {
  brand:            { name: string; category: string | null; logo_url: string | null; market_share_pct: number | null }
  sections:         string[]
  range:            Range
  days:             number
  bhiHistory:       { bhi: number; snapshot_date: string }[]
  bhiDelta:         number | null
  sentimentData:    { social_score: number; day: string; positive_pct: number; negative_pct: number }[]
  sentimentDelta:   number | null
  latestSentiment:  number | null
  avgSentiment:     number | null
  latestSov:        { social_sov: number; snapshot_date: string } | null
  sovTrend:         { social_sov: number; snapshot_date: string }[]
  campaigns:        Campaign[]
  totalBudget:      number
  totalSpend:       number
  activeCampaigns:  number
  npsResponses:     { nps_score: number; created_at: string }[]
  avgNps:           number | null
  mentionCount:     number
  competitors:      { name: string; type: string }[]
  sovCompetitor:    { competitor_breakdown: unknown } | null
  executiveSummary: string | null
  winsAndConcerns:  { wins: string[]; concerns: string[]; priorities: string[] } | null
  asOf:             string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

function fmtNGN(kobo: number) {
  const ngn = kobo / 100
  if (ngn >= 1_000_000) return `₦${(ngn / 1_000_000).toFixed(1)}M`
  if (ngn >= 1_000)     return `₦${(ngn / 1_000).toFixed(0)}K`
  return `₦${ngn.toFixed(0)}`
}

function bhiZone(bhi: number): { label: string; color: string } {
  if (bhi >= 75) return { label: 'Strong',   color: 'text-emerald-600' }
  if (bhi >= 55) return { label: 'Healthy',  color: 'text-blue-600'    }
  if (bhi >= 40) return { label: 'Caution',  color: 'text-amber-600'   }
  return           { label: 'At Risk',  color: 'text-red-600'    }
}

function DeltaBadge({ delta, unit = '' }: { delta: number | null; unit?: string }) {
  if (delta == null) return <span className="text-[11px] text-muted-foreground">—</span>
  const pos = delta >= 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-semibold', pos ? 'text-emerald-600' : 'text-red-600')}>
      {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {pos ? '+' : ''}{delta.toFixed(1)}{unit}
    </span>
  )
}

function KpiCard({ icon: Icon, iconColor, label, value, delta, unit = '', sub }: {
  icon: React.ElementType; iconColor: string; label: string; value: string; delta?: number | null; unit?: string; sub?: string
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', iconColor)} />
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-[28px] font-bold leading-none tracking-tight">{value}</p>
        {delta !== undefined && <DeltaBadge delta={delta} unit={unit} />}
      </div>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

function SectionHeading({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">{children}</h2>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  )
}

// ── Range picker ───────────────────────────────────────────────────────────

function RangePicker({ value, onChange, loading }: { value: Range; onChange: (r: Range) => void; loading: boolean }) {
  const opts: { v: Range; label: string }[] = [
    { v: '7d', label: '7D' }, { v: '30d', label: '30D' }, { v: '90d', label: '90D' }, { v: '6m', label: '6M' },
  ]
  return (
    <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1">
      {opts.map(o => (
        <button
          key={o.v}
          onClick={() => !loading && onChange(o.v)}
          className={cn(
            'px-3 py-1 text-[12px] font-semibold rounded-md transition-all',
            value === o.v
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Main portal client ─────────────────────────────────────────────────────

export function PortalClient({ data: initialData, token }: { data: PortalData; token: string }) {
  const [data, setData] = useState(initialData)
  const [range, setRange] = useState<Range>(initialData.range)
  const [loading, setLoading] = useState(false)

  const fetchRange = useCallback(async (r: Range) => {
    setLoading(true)
    setRange(r)
    try {
      const res = await fetch(`/api/portal/view?token=${token}&range=${r}`)
      const json = await res.json()
      if (res.ok) setData(json)
    } catch { /* noop */ } finally {
      setLoading(false)
    }
  }, [token])

  const { brand, sections, bhiHistory, bhiDelta, sentimentData, sentimentDelta, latestSentiment, latestSov, sovTrend, campaigns, totalBudget, totalSpend, activeCampaigns, npsResponses, avgNps, mentionCount, competitors, executiveSummary, winsAndConcerns, days } = data

  const latestBhi = bhiHistory.length > 0 ? Number(bhiHistory[bhiHistory.length - 1].bhi) : null
  const zone      = latestBhi != null ? bhiZone(latestBhi) : null

  const reportTitle = `${brand.name} — Brand Intelligence Report`
  const reportPeriod = `Last ${days} days · as of ${new Date(data.asOf).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}`

  // Build NPS weekly buckets
  const npsWeeks: { week: string; score: number }[] = []
  if (npsResponses.length > 0) {
    const byWeek: Record<string, number[]> = {}
    for (const r of npsResponses) {
      const d = new Date(r.created_at)
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - d.getDay())
      const key = weekStart.toISOString().slice(0, 10)
      if (!byWeek[key]) byWeek[key] = []
      byWeek[key].push(r.nps_score)
    }
    Object.entries(byWeek).sort().forEach(([week, scores]) => {
      npsWeeks.push({ week, score: scores.reduce((a, b) => a + b, 0) / scores.length })
    })
  }

  // SOV chart
  const sovChartData = sovTrend.map(r => ({ date: r.snapshot_date, sov: r.social_sov }))

  // Sentiment chart
  const sentimentChartData = sentimentData.map(r => ({
    date:  r.day,
    score: r.social_score,
    pos:   r.positive_pct,
    neg:   r.negative_pct,
  }))

  // Campaign table — show with spend % of budget
  const campaignRows = campaigns.map(c => ({
    ...c,
    spendPct: c.budget ? Math.round(((c.spend ?? 0) / c.budget) * 100) : null,
  }))

  return (
    <div className={cn('min-h-screen bg-[#f9fafb] dark:bg-background', loading && 'opacity-60 pointer-events-none')}>

      {/* ── Sticky header ──────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-card/90 backdrop-blur-md border-b">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {brand.logo_url && (
              <div className="h-7 w-7 rounded-lg border bg-muted overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={brand.logo_url} alt="" className="h-full w-full object-contain" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[14px] font-bold truncate leading-tight">{brand.name}</p>
              {brand.category && <p className="text-[10px] text-muted-foreground truncate">{brand.category}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <RangePicker value={range} onChange={fetchRange} loading={loading} />
            {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-8 space-y-10">

        {/* ── Report header ──────────────────────────────────────── */}
        <div className="space-y-1">
          <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight">{reportTitle}</h1>
          <p className="text-[13px] text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {reportPeriod}
          </p>
        </div>

        {/* ── Executive Summary ──────────────────────────────────── */}
        {sections.includes('executive_summary') && executiveSummary && (
          <section>
            <SectionHeading icon={BarChart3}>Executive Summary</SectionHeading>
            <div className="rounded-2xl border-l-4 border-primary bg-primary/5 px-5 py-4">
              <p className="text-[14px] leading-relaxed text-foreground">{executiveSummary}</p>
            </div>
          </section>
        )}

        {/* ── KPI scoreboard ─────────────────────────────────────── */}
        <section>
          <SectionHeading icon={Activity}>Brand Scorecard</SectionHeading>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {sections.includes('bhi') && (
              <KpiCard
                icon={Activity}
                iconColor="text-blue-500"
                label="Brand Health"
                value={latestBhi != null ? latestBhi.toFixed(1) : '—'}
                delta={bhiDelta}
                sub={zone ? `${zone.label} zone` : undefined}
              />
            )}
            {sections.includes('sentiment') && (
              <KpiCard
                icon={TrendingUp}
                iconColor="text-emerald-500"
                label="Sentiment"
                value={latestSentiment != null ? latestSentiment.toFixed(1) : '—'}
                delta={sentimentDelta}
                sub="Social score / 100"
              />
            )}
            {sections.includes('sov') && (
              <KpiCard
                icon={Radio}
                iconColor="text-violet-500"
                label="Share of Voice"
                value={latestSov ? `${latestSov.social_sov}%` : '—'}
                sub="Social SOV"
              />
            )}
            <KpiCard
              icon={MessageSquare}
              iconColor="text-orange-500"
              label="Total Mentions"
              value={mentionCount.toLocaleString()}
              sub={`Last ${days} days`}
            />
            {sections.includes('nps') && (
              <KpiCard
                icon={Award}
                iconColor="text-teal-500"
                label="NPS Score"
                value={avgNps != null ? avgNps.toFixed(1) : '—'}
                sub={`${npsResponses.length} responses`}
              />
            )}
            {sections.includes('campaigns') && (
              <KpiCard
                icon={DollarSign}
                iconColor="text-amber-500"
                label="Media Spend"
                value={fmtNGN(totalSpend)}
                sub={`${activeCampaigns} active campaign${activeCampaigns !== 1 ? 's' : ''}`}
              />
            )}
            {brand.market_share_pct != null && (
              <KpiCard
                icon={Target}
                iconColor="text-pink-500"
                label="Market Share"
                value={`${brand.market_share_pct}%`}
                sub="Last reported"
              />
            )}
          </div>
        </section>

        {/* ── BHI Trend ──────────────────────────────────────────── */}
        {sections.includes('bhi') && bhiHistory.length > 1 && (
          <section>
            <SectionHeading icon={Activity}>Brand Health Index Trend</SectionHeading>
            <div className="rounded-2xl border bg-card p-5">
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                {latestBhi != null && zone && (
                  <div className="flex items-center gap-2">
                    <span className={cn('text-[26px] font-bold', zone.color)}>{latestBhi.toFixed(1)}</span>
                    <span className="text-[12px] text-muted-foreground">/ 100</span>
                    <span className={cn('text-[12px] font-semibold ml-1', zone.color)}>{zone.label}</span>
                  </div>
                )}
                <DeltaBadge delta={bhiDelta} unit=" pts" />
                <span className="text-[11px] text-muted-foreground ml-auto">BHI = sentiment + share-of-voice + reach blend</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={bhiHistory.map(r => ({ date: r.snapshot_date, bhi: Number(r.bhi) }))}>
                  <defs>
                    <linearGradient id="bhiGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={28} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v) => [typeof v === 'number' ? v.toFixed(1) : v, 'BHI']} labelFormatter={(d) => fmtDate(String(d))} contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                  <Area type="monotone" dataKey="bhi" stroke="#3b82f6" strokeWidth={2.5} fill="url(#bhiGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* ── Sentiment ──────────────────────────────────────────── */}
        {sections.includes('sentiment') && sentimentChartData.length > 1 && (
          <section>
            <SectionHeading icon={TrendingUp}>Sentiment Analysis</SectionHeading>
            <div className="rounded-2xl border bg-card p-5">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={sentimentChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={28} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v) => [typeof v === 'number' ? v.toFixed(1) : v, '']} labelFormatter={(d) => fmtDate(String(d))} contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="score" name="Overall" stroke="#10b981" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="pos"   name="Positive" stroke="#6366f1" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="neg"   name="Negative" stroke="#f43f5e" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* ── Share of Voice ─────────────────────────────────────── */}
        {sections.includes('sov') && sovChartData.length > 1 && (
          <section>
            <SectionHeading icon={Radio}>Share of Voice Trend</SectionHeading>
            <div className="rounded-2xl border bg-card p-5">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={sovChartData}>
                  <defs>
                    <linearGradient id="sovGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} width={32} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v) => [typeof v === 'number' ? `${v.toFixed(1)}%` : v, 'SOV']} labelFormatter={(d) => fmtDate(String(d))} contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                  <Area type="monotone" dataKey="sov" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#sovGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* ── Campaign ROI ───────────────────────────────────────── */}
        {sections.includes('campaigns') && campaigns.length > 0 && (
          <section>
            <SectionHeading icon={DollarSign}>Campaign Performance & Spend</SectionHeading>
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between gap-4 flex-wrap">
                <div className="flex gap-6">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Total budget</p>
                    <p className="text-[16px] font-bold">{fmtNGN(totalBudget)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Deployed spend</p>
                    <p className="text-[16px] font-bold">{fmtNGN(totalSpend)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Budget utilisation</p>
                    <p className="text-[16px] font-bold">{totalBudget > 0 ? `${Math.round((totalSpend / totalBudget) * 100)}%` : '—'}</p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-5 py-2.5 font-semibold text-muted-foreground">Campaign</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Channel</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Spend</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Budget</th>
                      <th className="text-right px-5 py-2.5 font-semibold text-muted-foreground">Utilisation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignRows.map(c => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', c.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                            <span className="font-medium truncate max-w-[160px]">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground capitalize">{c.channel}</td>
                        <td className="px-4 py-3 text-right font-medium">{c.spend != null ? fmtNGN(c.spend) : '—'}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{c.budget != null ? fmtNGN(c.budget) : '—'}</td>
                        <td className="px-5 py-3 text-right">
                          {c.spendPct != null ? (
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, c.spendPct)}%` }} />
                              </div>
                              <span className="font-medium">{c.spendPct}%</span>
                            </div>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ── NPS ────────────────────────────────────────────────── */}
        {sections.includes('nps') && npsResponses.length > 0 && (
          <section>
            <SectionHeading icon={Award}>Net Promoter Score</SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border bg-card p-5 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Avg NPS</p>
                <p className={cn('text-[42px] font-bold leading-none', (avgNps ?? 0) >= 7 ? 'text-emerald-600' : (avgNps ?? 0) >= 5 ? 'text-amber-600' : 'text-red-600')}>
                  {avgNps != null ? avgNps.toFixed(1) : '—'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">out of 10</p>
              </div>
              <div className="rounded-2xl border bg-card p-5 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Responses</p>
                <p className="text-[42px] font-bold leading-none">{npsResponses.length}</p>
                <p className="text-[11px] text-muted-foreground mt-1">survey replies</p>
              </div>
              <div className="rounded-2xl border bg-card p-5 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Promoters</p>
                <p className="text-[42px] font-bold leading-none text-emerald-600">
                  {Math.round((npsResponses.filter(r => r.nps_score >= 9).length / npsResponses.length) * 100)}%
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">scored 9-10</p>
              </div>
            </div>
            {npsWeeks.length > 1 && (
              <div className="rounded-2xl border bg-card p-5 mt-4">
                <p className="text-[12px] font-medium mb-4 text-muted-foreground">NPS trend (weekly avg)</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={npsWeeks} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="week" tickFormatter={fmtDate} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} width={24} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => [typeof v === 'number' ? v.toFixed(1) : v, 'NPS']} labelFormatter={(d) => fmtDate(String(d))} contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                    <Bar dataKey="score" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        )}

        {/* ── Competitive Position ───────────────────────────────── */}
        {competitors.length > 0 && (
          <section>
            <SectionHeading icon={Target}>Competitive Position</SectionHeading>
            <div className="rounded-2xl border bg-card p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-primary/8 border border-primary/20 p-4 text-center">
                  <p className="text-[11px] font-bold text-primary uppercase tracking-wider mb-1">{brand.name}</p>
                  <p className="text-[22px] font-bold text-primary">{latestSov ? `${latestSov.social_sov}%` : '—'}</p>
                  <p className="text-[10px] text-primary/70">Share of Voice</p>
                </div>
                {competitors.slice(0, 5).map(c => (
                  <div key={c.name} className="rounded-xl bg-muted/40 p-4 text-center">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1 truncate">{c.name}</p>
                    <p className="text-[22px] font-bold">—</p>
                    <p className="text-[10px] text-muted-foreground">Monitoring</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">Competitive SOV data updates weekly from social listening.</p>
            </div>
          </section>
        )}

        {/* ── Key Wins & Concerns ────────────────────────────────── */}
        {sections.includes('insights') && winsAndConcerns && (
          <section>
            <SectionHeading icon={CheckCircle2}>Strategic Insights</SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Wins */}
              <div className="rounded-2xl border bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <p className="text-[12px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Key Wins</p>
                </div>
                <ul className="space-y-2">
                  {winsAndConcerns.wins.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-emerald-800 dark:text-emerald-300">
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-60" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Concerns */}
              <div className="rounded-2xl border bg-red-50/70 dark:bg-red-950/20 border-red-100 dark:border-red-900/40 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <p className="text-[12px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Watch Items</p>
                </div>
                <ul className="space-y-2">
                  {winsAndConcerns.concerns.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-red-800 dark:text-red-300">
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-60" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Priorities */}
              <div className="rounded-2xl border bg-blue-50/70 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/40 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-blue-600" />
                  <p className="text-[12px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Next Priorities</p>
                </div>
                <ul className="space-y-2">
                  {winsAndConcerns.priorities.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-blue-800 dark:text-blue-300">
                      <span className="text-[10px] font-bold mt-0.5 shrink-0 w-4 text-blue-500">{i + 1}.</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* ── Footer ─────────────────────────────────────────────── */}
        <footer className="border-t pt-6 pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-[11px] text-muted-foreground">
              Prepared by <strong>{brand.name}</strong> marketing team using BrandPulse AI.
              This report is confidential and intended solely for the named recipient.
            </p>
            <p className="text-[11px] text-muted-foreground">
              Generated {new Date(data.asOf).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-2">
            Powered by BrandPulse AI · Data sourced from connected social, campaign, and survey platforms.
            Figures represent the selected period and may not reflect full historical performance.
          </p>
        </footer>

      </main>
    </div>
  )
}
