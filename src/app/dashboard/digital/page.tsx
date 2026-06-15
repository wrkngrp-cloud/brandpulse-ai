import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Monitor, TrendingUp, Eye, MousePointerClick, Coins } from 'lucide-react'
import { DigitalSpendChart } from './digital-charts'

export const dynamic = 'force-dynamic'

const CAMPAIGNS = [
  {
    platform: 'Meta Ads',
    budget:   '₦800,000',
    spend:    '₦742,000',
    impressions: '1,840,000',
    clicks:   '42,320',
    ctr:      '2.3%',
    cpm:      '₦403',
    status:   'Active',
  },
  {
    platform: 'Google Display',
    budget:   '₦600,000',
    spend:    '₦558,000',
    impressions: '1,200,000',
    clicks:   '24,600',
    ctr:      '2.05%',
    cpm:      '₦465',
    status:   'Active',
  },
  {
    platform: 'Programmatic (DV360)',
    budget:   '₦1,000,000',
    spend:    '₦880,000',
    impressions: '1,160,000',
    clicks:   '16,820',
    ctr:      '1.45%',
    cpm:      '₦759',
    status:   'Paused',
  },
]

const CREATIVES = [
  { platform: 'Meta', format: 'Video (15s)', impressions: '820,000', ctr: '3.1%', spend: '₦310,000' },
  { platform: 'Google', format: 'Responsive Display', impressions: '640,000', ctr: '2.4%', spend: '₦220,000' },
  { platform: 'Meta', format: 'Carousel', impressions: '380,000', ctr: '2.8%', spend: '₦212,000' },
]

const KEY_METRICS = [
  { label: 'Total Spend',    value: '₦2.4M',  sub: 'vs ₦2.4M budget',   icon: Coins,          color: 'text-indigo-500' },
  { label: 'Impressions',    value: '4.2M',    sub: '+18% vs last month', icon: Eye,            color: 'text-emerald-500' },
  { label: 'Avg CTR',        value: '2.3%',    sub: 'Industry avg 1.8%',  icon: MousePointerClick, color: 'text-blue-500' },
  { label: 'Cost per Lead',  value: '₦1,200',  sub: '−₦80 vs last month', icon: TrendingUp,     color: 'text-violet-500' },
]

export default function DigitalPage() {
  return (
    <div className="max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 mt-0.5">
          <Monitor className="h-5 w-5 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Digital Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track display, programmatic, and social paid media performance across all platforms.
          </p>
        </div>
      </div>

      {/* Key metrics row */}
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

      {/* Campaign spend tracker */}
      <Card className="border rounded-xl p-5 bg-card space-y-4">
        <h2 className="text-xl font-semibold">Campaign Spend Tracker</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                {['Platform', 'Budget', 'Spend', 'Impressions', 'Clicks', 'CTR', 'CPM', 'Status'].map(h => (
                  <th key={h} className="text-left pb-2.5 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAMPAIGNS.map(c => (
                <tr key={c.platform} className="border-b border-border/30 last:border-0">
                  <td className="py-3 pr-4 font-medium whitespace-nowrap">{c.platform}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{c.budget}</td>
                  <td className="py-3 pr-4 font-medium">{c.spend}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{c.impressions}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{c.clicks}</td>
                  <td className="py-3 pr-4 font-medium text-emerald-600">{c.ctr}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{c.cpm}</td>
                  <td className="py-3">
                    <Badge variant={c.status === 'Active' ? 'default' : 'secondary'} className="text-[10px]">
                      {c.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Performance chart */}
      <Card className="border rounded-xl p-5 bg-card space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Spend vs Impressions (8 Weeks)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Weekly digital ad spend correlated with impression delivery</p>
        </div>
        <DigitalSpendChart />
      </Card>

      {/* Top performing creatives */}
      <Card className="border rounded-xl p-5 bg-card space-y-4">
        <h2 className="text-xl font-semibold">Top Performing Creatives</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {CREATIVES.map((cr, i) => (
            <div key={i} className="border border-border/50 rounded-lg p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cr.platform}</span>
                <Badge variant="outline" className="text-[10px]">{cr.format}</Badge>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Impressions</span>
                  <span className="font-medium">{cr.impressions}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">CTR</span>
                  <span className="font-medium text-emerald-600">{cr.ctr}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Spend</span>
                  <span className="font-medium">{cr.spend}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* AI insight */}
      <Card className="border rounded-xl p-5 bg-card space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-indigo-500/10 flex items-center justify-center shrink-0">
            <Monitor className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          <h2 className="text-sm font-semibold">AI Insight</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your Meta video creatives are outperforming display by 35% on CTR. The Lagos-audience segment (25-34 age band) shows the strongest engagement during evening hours (6pm-9pm). Consider shifting 20% of your DV360 budget to Meta video to capitalise on this pattern. Cost per lead is trending down month-on-month — a strong signal that audience targeting refinements are working.
        </p>
      </Card>

    </div>
  )
}
