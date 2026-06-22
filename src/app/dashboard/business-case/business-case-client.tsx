'use client'

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Target, DollarSign, Award,
  AlertCircle, CheckCircle2, ChevronRight, BarChart3,
  ArrowUpRight, Briefcase,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

interface Campaign { id: string; name: string; channel: string; status: string; budget: number | null; spend: number | null }

interface AiBusinessCase {
  headline:     string
  case:         string
  roi_argument: string
  risks:        string[]
  asks:         { amount: string; channel: string; rationale: string }[]
  proof_points: string[]
}

interface Props {
  brand:           { name: string; category: string | null }
  currentBhi:      number | null
  bhiChange:       number | null
  bhiTrend:        { date: string; bhi: number }[]
  sov:             number | null
  marketShare:     number | null
  esov:            number | null
  totalSpend:      number
  totalBudget:     number
  activeCampaigns: number
  campaigns:       Campaign[]
  channelSpend:    Record<string, number>
  avgNps:          number | null
  npsCount:        number
  avgSentiment:    number | null
  mentions30d:     number
  spendEfficiency: number | null
  competitors:     string[]
  aiBusinessCase:  AiBusinessCase | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

const fmtNGN = (k: number) => {
  const n = k / 100
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `₦${(n / 1_000).toFixed(0)}K`
  return `₦${n.toFixed(0)}`
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

const ESOV_POSTURE: Record<string, { label: string; color: string; bg: string; text: string }> = {
  growth:   { label: 'Growth Mode',     color: 'text-emerald-700', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200', text: 'You are outspending your market share weight. Sustained positive share of voice above your market share is the strongest predictor of future market share growth — keep this up.' },
  mild:     { label: 'Mild Growth',     color: 'text-teal-700',    bg: 'bg-teal-50 dark:bg-teal-950/30 border-teal-200',         text: 'Slight share-of-voice advantage. Incremental budget can tip this into strong growth mode.' },
  parity:   { label: 'Parity',          color: 'text-amber-700',   bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200',       text: 'You are matching your share with spending. No net gain or loss in market share expected at this rate.' },
  decline:  { label: 'Decline Risk',    color: 'text-orange-700',  bg: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200',    text: 'You are underspending relative to market share. Competitors with positive ESOV will take share from you.' },
  critical: { label: 'Critical',        color: 'text-red-700',     bg: 'bg-red-50 dark:bg-red-950/30 border-red-200',            text: 'Significant underinvestment. Without correction, market share loss is statistically likely within 6–12 months.' },
}

function esovPosture(esov: number | null) {
  if (esov == null) return null
  if (esov >= 5)      return ESOV_POSTURE.growth
  if (esov >= 0)      return ESOV_POSTURE.mild
  if (esov >= -5)     return ESOV_POSTURE.parity
  if (esov >= -10)    return ESOV_POSTURE.decline
  return               ESOV_POSTURE.critical
}

function KpiTile({ icon: Icon, iconColor, label, value, delta, sub }: {
  icon: React.ElementType; iconColor: string; label: string; value: string; delta?: number | null; sub?: string
}) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4', iconColor)} />
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className="text-[28px] font-bold leading-none tracking-tight">{value}</p>
      {delta != null && (
        <p className={cn('text-[12px] font-semibold mt-1 flex items-center gap-0.5', delta >= 0 ? 'text-emerald-600' : 'text-red-600')}>
          {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {delta > 0 ? '+' : ''}{delta.toFixed(1)} pts (90d)
        </p>
      )}
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

function SectionHead({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <Icon className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
      <h2 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">{children}</h2>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  )
}

// ── BCG-style campaign portfolio ───────────────────────────────────────────

const BCG_CHANNELS: Record<string, { quadrant: string; color: string }> = {
  digital:    { quadrant: 'Star',        color: '#3b82f6' },
  social:     { quadrant: 'Star',        color: '#6366f1' },
  influencer: { quadrant: 'Question',    color: '#f59e0b' },
  tv:         { quadrant: 'Cash Cow',    color: '#10b981' },
  radio:      { quadrant: 'Cash Cow',    color: '#14b8a6' },
  ooh:        { quadrant: 'Question',    color: '#8b5cf6' },
  print:      { quadrant: 'Dog',         color: '#6b7280' },
  event:      { quadrant: 'Question',    color: '#f97316' },
}

// ── Main ───────────────────────────────────────────────────────────────────

export function BusinessCaseClient({
  brand, currentBhi, bhiChange, bhiTrend, sov, marketShare, esov,
  totalSpend, totalBudget, activeCampaigns, campaigns, channelSpend,
  avgNps, npsCount, avgSentiment, mentions30d, spendEfficiency,
  competitors, aiBusinessCase,
}: Props) {
  const posture = esovPosture(esov)

  const channelRows = Object.entries(channelSpend)
    .sort((a, b) => b[1] - a[1])
    .map(([channel, spend]) => ({
      channel,
      spend,
      share: totalSpend > 0 ? Math.round((spend / totalSpend) * 100) : 0,
      bcg:   BCG_CHANNELS[channel] ?? { quadrant: 'Other', color: '#9ca3af' },
    }))

  const bhiZone = currentBhi == null ? null
    : currentBhi >= 80 ? 'Leading' : currentBhi >= 65 ? 'Healthy' : currentBhi >= 40 ? 'Building' : 'At Risk'

  return (
    <div className="max-w-4xl space-y-10 pb-16">

      {/* Header */}
      <div>
        <p className="eyebrow mb-1">Reporting</p>
        <h1 className="h-display text-[26px] leading-none">Marketing Business Case</h1>
        <p className="mt-2 text-[13px] text-muted-foreground/70 max-w-xl">
          Data-backed justification for your marketing investment — from brand health trends to channel ROI.
          Use this to defend budget with finance and present to the board.
        </p>
      </div>

      {/* AI Executive Case */}
      {aiBusinessCase && (
        <section>
          <SectionHead icon={Briefcase}>Executive Brief</SectionHead>
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="bg-primary/8 border-b px-5 py-4">
              <p className="text-[15px] font-bold leading-snug">{aiBusinessCase.headline}</p>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-[13.5px] leading-relaxed">{aiBusinessCase.case}</p>
              <div className="rounded-xl bg-muted/40 px-4 py-3">
                <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-1">ROI Argument</p>
                <p className="text-[13px] leading-relaxed">{aiBusinessCase.roi_argument}</p>
              </div>

              {/* Proof points */}
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Proof Points</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {aiBusinessCase.proof_points.map((p, i) => (
                    <div key={i} className="rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 px-3 py-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mb-1" />
                      <p className="text-[12px] text-emerald-800 dark:text-emerald-300">{p}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Budget asks */}
              {aiBusinessCase.asks.length > 0 && (
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Budget Ask</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {aiBusinessCase.asks.map((a, i) => (
                      <div key={i} className="rounded-xl border bg-muted/20 p-3">
                        <p className="text-[18px] font-bold text-primary">{a.amount}</p>
                        <p className="text-[12px] font-semibold capitalize">{a.channel}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{a.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risk if not approved */}
              <div className="border-t pt-4">
                <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Risks if Budget is Not Approved</p>
                <ul className="space-y-1.5">
                  {aiBusinessCase.risks.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px]">
                      <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* KPI Scorecard */}
      <section>
        <SectionHead icon={BarChart3}>Performance Scorecard (90 days)</SectionHead>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiTile icon={Award}       iconColor="text-blue-500"    label="Brand Health"   value={currentBhi != null ? `${currentBhi.toFixed(1)}` : '—'} delta={bhiChange} sub={bhiZone ? `Zone: ${bhiZone}` : undefined} />
          <KpiTile icon={Target}      iconColor="text-violet-500"  label="Share of Voice"  value={sov != null ? `${sov.toFixed(1)}%` : '—'} sub={marketShare ? `Market share: ${marketShare}%` : undefined} />
          <KpiTile icon={TrendingUp}  iconColor="text-emerald-500" label="Avg Sentiment"   value={avgSentiment != null ? `${avgSentiment.toFixed(1)}` : '—'} sub="/ 100" />
          <KpiTile icon={DollarSign}  iconColor="text-amber-500"   label="Media Spend"     value={fmtNGN(totalSpend)} sub={`${activeCampaigns} active campaigns`} />
          <KpiTile icon={CheckCircle2} iconColor="text-teal-500"   label="NPS"             value={avgNps != null ? avgNps.toFixed(1) : '—'} sub={`${npsCount} responses`} />
          <KpiTile icon={ArrowUpRight} iconColor="text-orange-500" label="Mentions (30d)"  value={mentions30d.toLocaleString()} />
          {esov != null && (
            <KpiTile icon={Target} iconColor={esov >= 0 ? 'text-emerald-500' : 'text-red-500'} label="ESOV" value={`${esov > 0 ? '+' : ''}${esov.toFixed(1)}%`} sub="SOV minus market share" />
          )}
        </div>
      </section>

      {/* ESOV Analysis */}
      {esov != null && posture && (
        <section>
          <SectionHead icon={Target}>ESOV Analysis</SectionHead>
          <div className={cn('rounded-2xl border p-5 space-y-3', posture.bg)}>
            <div className="flex items-center gap-3">
              <span className={cn('text-[32px] font-bold', posture.color)}>
                {esov > 0 ? '+' : ''}{esov.toFixed(1)}%
              </span>
              <div>
                <p className={cn('text-[13px] font-bold', posture.color)}>{posture.label}</p>
                <p className="text-[11px] text-muted-foreground">Excess Share of Voice</p>
              </div>
            </div>
            <p className="text-[13px] leading-relaxed">{posture.text}</p>
            <div className="grid grid-cols-3 gap-3 pt-1">
              {[
                { label: 'Your SOV',      value: sov != null ? `${sov.toFixed(1)}%` : '—', note: 'Social mentions' },
                { label: 'Market Share',  value: marketShare != null ? `${marketShare}%` : '—', note: 'Last reported' },
                { label: 'ESOV',          value: `${esov > 0 ? '+' : ''}${esov.toFixed(1)}%`, note: 'SOV − Market share' },
              ].map(({ label, value, note }) => (
                <div key={label} className="rounded-xl bg-background/60 p-3 text-center">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="text-[20px] font-bold">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* BHI Trend */}
      {bhiTrend.length > 1 && (
        <section>
          <SectionHead icon={Award}>Brand Health Index — 90-day Trend</SectionHead>
          <div className="rounded-2xl border bg-card p-5">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={bhiTrend}>
                <defs>
                  <linearGradient id="bhiGradBC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={28} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [typeof v === 'number' ? v.toFixed(1) : v, 'BHI']} labelFormatter={(d) => fmtDate(String(d))} contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                <Area type="monotone" dataKey="bhi" stroke="#3b82f6" strokeWidth={2.5} fill="url(#bhiGradBC)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Channel Spend Breakdown */}
      {channelRows.length > 0 && (
        <section>
          <SectionHead icon={DollarSign}>Channel Investment Breakdown</SectionHead>
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b flex gap-6 flex-wrap">
              <div>
                <p className="text-[11px] text-muted-foreground">Total budget</p>
                <p className="text-[16px] font-bold">{fmtNGN(totalBudget)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Deployed</p>
                <p className="text-[16px] font-bold">{fmtNGN(totalSpend)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Utilisation</p>
                <p className="text-[16px] font-bold">{totalBudget > 0 ? `${Math.round((totalSpend / totalBudget) * 100)}%` : '—'}</p>
              </div>
            </div>
            <div className="p-5">
              <ResponsiveContainer width="100%" height={channelRows.length * 44 + 20}>
                <BarChart data={channelRows} layout="vertical" margin={{ left: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="channel" tick={{ fontSize: 12 }} width={80} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v) => [fmtNGN(Number(v)), 'Spend']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="spend" radius={[0, 6, 6, 0]} barSize={22}>
                    {channelRows.map((r) => (
                      <Cell key={r.channel} fill={r.bcg.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* BCG legend */}
              <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
                <p className="text-[11px] text-muted-foreground font-medium w-full">Channel portfolio classification (BCG lens):</p>
                {channelRows.map(r => (
                  <div key={r.channel} className="flex items-center gap-1.5 text-[11px]">
                    <span className="h-2 w-2 rounded-full" style={{ background: r.bcg.color }} />
                    <span className="capitalize">{r.channel}</span>
                    <span className="text-muted-foreground">({r.bcg.quadrant} · {r.share}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Competitive Context */}
      {competitors.length > 0 && (
        <section>
          <SectionHead icon={Target}>Competitive Context</SectionHead>
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-[13px] text-muted-foreground mb-3">
              Tracked competitors: <span className="font-medium text-foreground">{competitors.join(', ')}</span>
            </p>
            <p className="text-[13px] leading-relaxed">
              With an ESOV of <strong>{esov != null ? `${esov > 0 ? '+' : ''}${esov.toFixed(1)}%` : 'N/A'}</strong>,{' '}
              {esov != null && esov > 0
                ? `${brand.name} is currently outinvesting its market share weight. Sustained positive share of voice above market share over 12–18 months is the strongest single predictor of market share gain in packaged goods and QSR categories.`
                : `${brand.name} is currently underinvesting relative to market share. Competitors with higher SOV than their market share will systematically compound their brand equity advantage.`
              }
            </p>
            <div className="mt-4 p-4 rounded-xl bg-muted/30 text-[12px] text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Competitive Intensity:</strong> Higher competitor SOV and increased sighting frequency indicate intensifying rivalry. Budget reduction during competitive escalation is high-risk — market share lost during low-share-of-voice periods is statistically harder and more expensive to recover than to hold.
            </div>
          </div>
        </section>
      )}

      {/* Methodology note */}
      <div className="rounded-xl border bg-muted/20 p-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Methodology</p>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          Brand Health Index uses a 40/30/30 sentiment/SOV/survey weighting. ESOV (your share of voice minus your market share) consistently predicts market share growth in 12–18 month windows across FMCG and QSR categories when positive. Channel portfolio classification: Stars (high growth/high investment), Cash Cows (established/efficient), Question Marks (unproven/potential), Dogs (low efficiency).
          Business case generated by BrandPulse AI using board-grade analysis.
        </p>
      </div>
    </div>
  )
}
