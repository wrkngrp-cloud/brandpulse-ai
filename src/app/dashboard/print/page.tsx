import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Newspaper, BookOpen, TrendingUp, BarChart2 } from 'lucide-react'
import { PrintReadershipChart } from './print-charts'

export const dynamic = 'force-dynamic'

const PUBLICATIONS = [
  {
    name:        'The Punch',
    type:        'Daily national',
    placement:   'Full Page, Page 5',
    circulation: '150,000',
    readership:  '380,000',
    cost:        '₦1,200,000',
    frequency:   '2× per month',
    status:      'Active',
  },
  {
    name:        'Vanguard',
    type:        'Daily national',
    placement:   'Half Page, Back',
    circulation: '110,000',
    readership:  '290,000',
    cost:        '₦720,000',
    frequency:   '2× per month',
    status:      'Active',
  },
  {
    name:        'BusinessDay',
    type:        'Business daily',
    placement:   'Quarter Page, B8',
    circulation: '80,000',
    readership:  '220,000',
    cost:        '₦480,000',
    frequency:   '1× per month',
    status:      'Active',
  },
]

const KEY_METRICS = [
  { label: 'Total Readership',   value: '890K',     sub: 'Combined across 3 titles', icon: BookOpen,   color: 'text-indigo-500' },
  { label: 'Avg Frequency',      value: '2×',       sub: 'Per publication/month',    icon: TrendingUp, color: 'text-emerald-500' },
  { label: 'CPT (Cost/Thousand)',value: '₦4,200',   sub: 'Blended across titles',    icon: BarChart2,  color: 'text-blue-500' },
  { label: 'Total Print Spend',  value: '₦2.4M',    sub: 'Monthly media spend',      icon: Newspaper,  color: 'text-violet-500' },
]

const COVERAGE_CALENDAR = [
  { pub: 'The Punch',   Jan: true,  Feb: true,  Mar: true,  Apr: true,  May: true,  Jun: true  },
  { pub: 'Vanguard',    Jan: true,  Feb: true,  Mar: false, Apr: true,  May: true,  Jun: true  },
  { pub: 'BusinessDay', Jan: false, Feb: true,  Mar: true,  Apr: false, May: true,  Jun: true  },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] as const

export default function PrintPage() {
  return (
    <div className="max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
          <Newspaper className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Print Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track newspaper and magazine placements, readership reach, and cost efficiency across Nigeria&apos;s leading publications.
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

      {/* Publication tracker */}
      <Card className="border rounded-xl p-5 bg-card space-y-4">
        <h2 className="text-xl font-semibold">Publication Tracker</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                {['Publication', 'Type', 'Placement', 'Circulation', 'Readership', 'Monthly Cost', 'Frequency', 'Status'].map(h => (
                  <th key={h} className="text-left pb-2.5 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PUBLICATIONS.map(p => (
                <tr key={p.name} className="border-b border-border/30 last:border-0">
                  <td className="py-3 pr-4 font-medium whitespace-nowrap">{p.name}</td>
                  <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">{p.type}</td>
                  <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">{p.placement}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{p.circulation}</td>
                  <td className="py-3 pr-4 font-medium">{p.readership}</td>
                  <td className="py-3 pr-4 font-medium">{p.cost}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{p.frequency}</td>
                  <td className="py-3">
                    <Badge variant="default" className="text-[10px]">{p.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Readership chart */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border rounded-xl p-5 bg-card space-y-3">
          <div>
            <h2 className="text-xl font-semibold">Readership by Publication</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Estimated readers per title (print + digital editions)</p>
          </div>
          <PrintReadershipChart />
        </Card>

        {/* Coverage calendar */}
        <Card className="border rounded-xl p-5 bg-card space-y-4">
          <h2 className="text-xl font-semibold">Coverage Calendar</h2>
          <p className="text-xs text-muted-foreground">H1 2026 — months with active placements</p>
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left pb-2 pr-2 font-semibold text-muted-foreground uppercase tracking-wide">Publication</th>
                {MONTHS.map(m => (
                  <th key={m} className="pb-2 px-1 font-semibold text-muted-foreground uppercase tracking-wide text-center">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COVERAGE_CALENDAR.map(row => (
                <tr key={row.pub} className="border-t border-border/30">
                  <td className="py-2.5 pr-2 font-medium whitespace-nowrap">{row.pub}</td>
                  {MONTHS.map(m => (
                    <td key={m} className="py-2.5 px-1 text-center">
                      {row[m] ? (
                        <span className="inline-block h-5 w-5 rounded bg-indigo-500/15 border border-indigo-200 text-indigo-600 text-[10px] font-bold leading-5">✓</span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* AI insight */}
      <Card className="border rounded-xl p-5 bg-card space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-amber-500/10 flex items-center justify-center shrink-0">
            <Newspaper className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <h2 className="text-sm font-semibold">AI Insight</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Print campaigns running in the same week as digital activity show a 28% higher brand search uplift than digital-only weeks. The Punch Page 5 placement consistently outperforms back-page placements on unaided recall for your category. BusinessDay reaches a high-value SEC A audience that has limited overlap with your current digital targeting — consider scaling BusinessDay frequency to extend reach into that segment. CPT at ₦4,200 is competitive vs. digital display for this income group.
        </p>
      </Card>

    </div>
  )
}
