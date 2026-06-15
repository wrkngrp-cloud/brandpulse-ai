import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tv, Users, TrendingUp, Activity } from 'lucide-react'
import { TVGRPChart, TVDaypartChart } from './tv-charts'

export const dynamic = 'force-dynamic'

const TV_STATIONS = [
  {
    name:     'NTA Network',
    type:     'State broadcaster',
    duration: '30s spot',
    grp:      '64',
    audShare: '18%',
    cost:     '₦720,000/wk',
    status:   'Active',
  },
  {
    name:     'Channels TV',
    type:     'News & entertainment',
    duration: '30s spot',
    grp:      '78',
    audShare: '22%',
    cost:     '₦860,000/wk',
    status:   'Active',
  },
  {
    name:     'TVC News',
    type:     'News channel',
    duration: '20s spot',
    grp:      '46',
    audShare: '13%',
    cost:     '₦480,000/wk',
    status:   'Reduced',
  },
]

const KEY_METRICS = [
  { label: 'Total HH Reach',   value: '2.1M',    sub: 'Households reached',      icon: Users,     color: 'text-indigo-500' },
  { label: 'Avg Frequency',    value: '3.2×',     sub: 'Per household per week',   icon: Activity,  color: 'text-emerald-500' },
  { label: 'TRP',              value: '168',       sub: 'Target rating points',     icon: TrendingUp, color: 'text-blue-500' },
  { label: 'Cost per GRP',     value: '₦45,000',  sub: 'Blended across stations',  icon: Tv,        color: 'text-violet-500' },
]

const UPLIFT = [
  { label: 'Awareness Lift',       value: '+8%',  bar: 80, color: 'bg-indigo-500' },
  { label: 'Consideration Lift',   value: '+5%',  bar: 50, color: 'bg-emerald-500' },
  { label: 'Purchase Intent Lift', value: '+3%',  bar: 30, color: 'bg-amber-500' },
]

export default function TVPage() {
  return (
    <div className="max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
          <Tv className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">TV Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track TV spot performance, GRP delivery, and brand uplift across Nigeria&apos;s major stations.
          </p>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {KEY_METRICS.map(m => (
          <Card key={m.label} className="border rounded-xl p-5 bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{m.label}</span>
              <m.icon className={`h-4 w-4 ${m.color}`} />
            </div>
            <p className="text-2xl font-bold tracking-tight">{m.value}</p>
            <p className="text-xs text-muted-foreground">{m.sub}</p>
          </Card>
        ))}
      </div>

      {/* Spot tracker */}
      <Card className="border rounded-xl p-5 bg-card space-y-4">
        <h2 className="text-xl font-semibold">Spot Tracker</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                {['Station', 'Type', 'Spot', 'GRP', 'Aud. Share', 'Weekly Cost', 'Status'].map(h => (
                  <th key={h} className="text-left pb-2.5 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TV_STATIONS.map(s => (
                <tr key={s.name} className="border-b border-border/30 last:border-0">
                  <td className="py-3 pr-4 font-medium whitespace-nowrap">{s.name}</td>
                  <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">{s.type}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{s.duration}</td>
                  <td className="py-3 pr-4 font-semibold text-indigo-600">{s.grp}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{s.audShare}</td>
                  <td className="py-3 pr-4 font-medium">{s.cost}</td>
                  <td className="py-3">
                    <Badge variant={s.status === 'Active' ? 'default' : 'secondary'} className="text-[10px]">
                      {s.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* GRP line chart */}
      <Card className="border rounded-xl p-5 bg-card space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Weekly GRP by Station (8 Weeks)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Gross Rating Points delivered per station week-over-week</p>
        </div>
        <TVGRPChart />
      </Card>

      {/* Day-part analysis */}
      <Card className="border rounded-xl p-5 bg-card space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Day-Part Analysis</h2>
          <p className="text-xs text-muted-foreground mt-0.5">GRP contribution by broadcast time period</p>
        </div>
        <TVDaypartChart />
        <p className="text-xs text-muted-foreground pt-1">
          Prime Time (7pm-10pm) accounts for 43% of total GRP delivery — the strongest period for your target demographic (25-44, SEC A/B).
        </p>
      </Card>

      {/* Brand uplift tracker */}
      <Card className="border rounded-xl p-5 bg-card space-y-4">
        <h2 className="text-xl font-semibold">Brand Uplift Tracker</h2>
        <p className="text-xs text-muted-foreground">Measured via pre/post survey among exposed households vs control</p>
        <div className="space-y-4">
          {UPLIFT.map(u => (
            <div key={u.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{u.label}</span>
                <span className="font-semibold text-emerald-600">{u.value}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${u.color}`} style={{ width: `${u.bar}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* AI insight */}
      <Card className="border rounded-xl p-5 bg-card space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
            <Tv className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <h2 className="text-sm font-semibold">AI Insight</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Channels TV prime time slots are delivering the strongest GRP at the most efficient cost per point. The 8% awareness uplift is above the 5.5% FMCG category benchmark. Consider consolidating TVC News budget into additional Channels TV prime-time spots — the audience overlap is under 30%, so you would extend reach rather than duplicate it. Awareness-to-consideration gap (3%) is healthy; focus next flight on driving purchase intent messaging.
        </p>
      </Card>

    </div>
  )
}
