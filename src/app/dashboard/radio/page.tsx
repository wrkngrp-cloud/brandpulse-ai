import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Radio, Users, TrendingUp, Volume2 } from 'lucide-react'
import { RadioReachChart } from './radio-charts'

export const dynamic = 'force-dynamic'

const STATIONS = [
  {
    name:    'Cool FM Lagos',
    freq:    '96.9 FM',
    slots:   '14 spots/week',
    grp:     '68',
    reach:   '420,000',
    cost:    '₦380,000',
    status:  'Active',
    color:   'bg-indigo-500/10 text-indigo-500',
  },
  {
    name:    'Beat FM',
    freq:    '99.9 FM',
    slots:   '10 spots/week',
    grp:     '44',
    reach:   '265,000',
    cost:    '₦240,000',
    status:  'Active',
    color:   'bg-emerald-500/10 text-emerald-500',
  },
  {
    name:    'Wazobia FM',
    freq:    '94.1 FM',
    slots:   '12 spots/week',
    grp:     '58',
    reach:   '350,000',
    cost:    '₦310,000',
    status:  'Active',
    color:   'bg-amber-500/10 text-amber-500',
  },
]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SLOTS: Record<string, Record<string, string | null>> = {
  Morning: {
    Mon: 'Cool FM', Tue: 'Wazobia', Wed: 'Cool FM', Thu: 'Beat FM', Fri: 'Cool FM', Sat: null, Sun: null,
  },
  Afternoon: {
    Mon: 'Wazobia', Tue: null, Wed: 'Beat FM', Thu: 'Wazobia', Fri: 'Beat FM', Sat: 'Cool FM', Sun: null,
  },
  Evening: {
    Mon: 'Cool FM', Tue: 'Cool FM', Wed: 'Wazobia', Thu: 'Cool FM', Fri: 'Cool FM', Sat: 'Wazobia', Sun: 'Beat FM',
  },
}

const SLOT_COLORS: Record<string, string> = {
  'Cool FM':  'bg-indigo-500/15 text-indigo-600 border-indigo-200',
  'Beat FM':  'bg-emerald-500/15 text-emerald-600 border-emerald-200',
  'Wazobia':  'bg-amber-500/15 text-amber-600 border-amber-200',
}

const KEY_METRICS = [
  { label: 'Total Airtime Cost', value: '₦930K',   sub: 'Across 3 stations', icon: Volume2,    color: 'text-indigo-500' },
  { label: 'Total Weekly GRP',   value: '170',      sub: 'Gross Rating Points', icon: TrendingUp, color: 'text-emerald-500' },
  { label: 'Estimated Reach',    value: '1.03M',    sub: 'Unduplicated audience', icon: Users,    color: 'text-blue-500' },
  { label: 'Brand Recall Lift',  value: '+12%',     sub: 'Post-campaign survey', icon: Radio,     color: 'text-violet-500' },
]

export default function RadioPage() {
  return (
    <div className="max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
          <Radio className="h-5 w-5 text-violet-500" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Radio Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor airtime, GRP, and brand recall lift across Nigeria&apos;s top radio stations.
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

      {/* Station breakdown */}
      <Card className="border rounded-xl p-5 bg-card space-y-4">
        <h2 className="text-xl font-semibold">Station Breakdown</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {STATIONS.map(s => (
            <div key={s.name} className="border border-border/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.freq}</p>
                </div>
                <Badge variant="default" className="text-[10px]">{s.status}</Badge>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Airtime slots</span>
                  <span className="font-medium">{s.slots}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">GRP</span>
                  <span className="font-medium">{s.grp}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Est. reach</span>
                  <span className="font-medium">{s.reach}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Weekly cost</span>
                  <span className="font-medium">{s.cost}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Airtime calendar */}
      <Card className="border rounded-xl p-5 bg-card space-y-4">
        <h2 className="text-xl font-semibold">Airtime Calendar</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left pb-2 pr-3 font-semibold text-muted-foreground uppercase tracking-wide w-24">Slot</th>
                {DAYS.map(d => (
                  <th key={d} className="pb-2 px-1.5 font-semibold text-muted-foreground uppercase tracking-wide text-center">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(['Morning', 'Afternoon', 'Evening'] as const).map(period => (
                <tr key={period} className="border-t border-border/30">
                  <td className="py-2.5 pr-3 font-medium text-muted-foreground">{period}</td>
                  {DAYS.map(d => {
                    const station = SLOTS[period][d]
                    return (
                      <td key={d} className="py-2.5 px-1 text-center">
                        {station ? (
                          <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium ${SLOT_COLORS[station]}`}>
                            {station}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Reach & Frequency chart */}
      <Card className="border rounded-xl p-5 bg-card space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Weekly Reach by Station (8 Weeks)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Estimated unduplicated audience per station per week</p>
        </div>
        <RadioReachChart />
      </Card>

      {/* AI insight */}
      <Card className="border rounded-xl p-5 bg-card space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-violet-500/10 flex items-center justify-center shrink-0">
            <Radio className="h-3.5 w-3.5 text-violet-500" />
          </div>
          <h2 className="text-sm font-semibold">AI Insight</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Evening drive-time slots (5pm-8pm) on Cool FM Lagos are delivering 40% more brand recall than morning slots at similar cost. The Wazobia FM audience shows stronger resonance in Pidgin-language markets — consider adapting your ad copy to Pidgin for that slot. Combining radio with same-day digital retargeting has shown a 22% uplift in conversion for FMCG brands in the Lagos market.
        </p>
      </Card>

    </div>
  )
}
