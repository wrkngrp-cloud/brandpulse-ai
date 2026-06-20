'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar, Cell, ReferenceLine,
} from 'recharts'

// ── local formatters ──────────────────────────────────────────────────────────

function fmtNGN(val: number): string {
  if (val >= 1_000_000) return `₦${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000)     return `₦${(val / 1_000).toFixed(0)}K`
  return `₦${Math.round(val)}`
}

function fmtImpr(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000)     return `${(val / 1_000).toFixed(0)}K`
  return `${val}`
}

function fmtNum(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`
  if (val >= 1_000)     return `${(val / 1_000).toFixed(1)}K`
  return `${Math.round(val)}`
}

// ── DigitalSpendChart ─────────────────────────────────────────────────────────

export interface SpendDataPoint {
  label:       string
  spend:       number
  impressions: number
}

const DEFAULT_SPEND_DATA: SpendDataPoint[] = [
  { label: 'Wk 1', spend: 280000, impressions: 480000 },
  { label: 'Wk 2', spend: 320000, impressions: 560000 },
  { label: 'Wk 3', spend: 295000, impressions: 510000 },
  { label: 'Wk 4', spend: 410000, impressions: 720000 },
  { label: 'Wk 5', spend: 380000, impressions: 650000 },
  { label: 'Wk 6', spend: 450000, impressions: 810000 },
  { label: 'Wk 7', spend: 390000, impressions: 680000 },
  { label: 'Wk 8', spend: 425000, impressions: 745000 },
]

interface SpendChartProps {
  data?: SpendDataPoint[]
  demo?: boolean
}

export function DigitalSpendChart({ data, demo }: SpendChartProps) {
  const chartData = data && data.length > 0 ? data : demo ? DEFAULT_SPEND_DATA : null

  if (!chartData) {
    return (
      <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
        Connect an ad account to see spend data here.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="imprGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="spend" tickFormatter={fmtNGN} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={56} />
        <YAxis yAxisId="impr" orientation="right" tickFormatter={fmtImpr} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={52} />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
          formatter={(val, name) =>
            name === 'spend'
              ? [typeof val === 'number' ? fmtNGN(val) : val, 'Spend']
              : [typeof val === 'number' ? fmtImpr(val) : val, 'Impressions']
          }
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Area yAxisId="spend" type="monotone" dataKey="spend"       stroke="#6366f1" strokeWidth={2} fill="url(#spendGrad)" name="spend"       dot={false} />
        <Area yAxisId="impr"  type="monotone" dataKey="impressions" stroke="#10b981" strokeWidth={2} fill="url(#imprGrad)"  name="impressions" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── ConversionFunnelChart ─────────────────────────────────────────────────────
// Bars use a logarithmic scale so the cascade is readable even when
// the click-to-conversion ratio is very small.

export interface FunnelData {
  impressions: number
  clicks:      number
  conversions: number
}

const DEMO_FUNNEL: FunnelData = {
  impressions: 4_200_000,
  clicks:      96_600,
  conversions: 1_352,
}

function logBarPct(val: number, base: number): number {
  if (base <= 1 || val <= 0) return 0
  return Math.max((Math.log(val) / Math.log(base)) * 100, 1.5)
}

export function ConversionFunnelChart({ data, demo }: { data?: FunnelData; demo?: boolean }) {
  const d = data && data.impressions > 0 ? data : demo ? DEMO_FUNNEL : null

  if (!d) {
    return (
      <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">
        Connect an ad account to see funnel data.
      </div>
    )
  }

  const ctr = d.impressions > 0 ? (d.clicks      / d.impressions) * 100 : 0
  const cvr = d.clicks      > 0 ? (d.conversions / d.clicks)      * 100 : 0

  const steps = [
    {
      label:  'Impressions',
      value:  d.impressions,
      barPct: 100,
      color:  '#6366f1',
      rate:   null as string | null,
    },
    {
      label:  'Clicks',
      value:  d.clicks,
      barPct: logBarPct(d.clicks, d.impressions),
      color:  '#8b5cf6',
      rate:   `↓ ${ctr.toFixed(2)}% CTR`,
    },
    {
      label:  'Conversions',
      value:  d.conversions,
      barPct: logBarPct(d.conversions, d.impressions),
      color:  '#10b981',
      rate:   `↓ ${cvr.toFixed(2)}% CVR`,
    },
  ]

  return (
    <div className="space-y-4">
      {steps.map(step => (
        <div key={step.label} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">{step.label}</span>
              {step.rate && (
                <span className="text-[11px] font-medium truncate" style={{ color: step.color }}>
                  {step.rate}
                </span>
              )}
            </div>
            <span className="text-sm font-bold tabular-nums shrink-0">{fmtNum(step.value)}</span>
          </div>
          <div className="h-5 bg-muted/50 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${step.barPct}%`, backgroundColor: step.color, opacity: 0.82 }}
            />
          </div>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground text-right">
        Bar widths use a log scale for readability
      </p>
    </div>
  )
}

// ── FrequencyBarChart ─────────────────────────────────────────────────────────

export interface FrequencyPoint {
  platform:  string
  frequency: number
}

const DEMO_FREQUENCY: FrequencyPoint[] = [
  { platform: 'Meta Ads',   frequency: 4.2 },
  { platform: 'Google Ads', frequency: 1.8 },
]

function freqColor(f: number): string {
  if (f >= 7) return '#ef4444'
  if (f >= 4) return '#f59e0b'
  return '#10b981'
}

interface FreqProps {
  data?: FrequencyPoint[]
  demo?: boolean
}

export function FrequencyBarChart({ data, demo }: FreqProps) {
  const chartData = data && data.length > 0 ? data : demo ? DEMO_FREQUENCY : null

  if (!chartData) {
    return (
      <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">
        No frequency data yet.
      </div>
    )
  }

  const maxVal    = Math.max(...chartData.map(d => d.frequency), 8)
  const domainMax = Math.ceil(maxVal * 1.15)

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData} margin={{ top: 8, right: 48, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
          <XAxis dataKey="platform" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, domainMax]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={24} />
          <Tooltip
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
            formatter={(val) => [typeof val === 'number' ? val.toFixed(2) : String(val), 'Avg Frequency']}
          />
          <ReferenceLine y={7} stroke="#ef4444" strokeDasharray="4 2" />
          <ReferenceLine y={4} stroke="#f59e0b" strokeDasharray="4 2" />
          <Bar dataKey="frequency" radius={[4, 4, 0, 0]} maxBarSize={56}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={freqColor(entry.frequency)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-5 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
          {'<4 Healthy'}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
          {'4–7 Watch'}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />
          {'>7 Fatigue'}
        </div>
      </div>
    </div>
  )
}
