import { createClient }   from '@/lib/supabase/server'
import { redirect }        from 'next/navigation'
import { Card }            from '@/components/ui/card'
import { Badge }           from '@/components/ui/badge'
import { Radio, Users, TrendingUp, Volume2, Download } from 'lucide-react'
import { MediaPlanUploadDialog } from '@/components/offline-media/media-plan-upload-dialog'
import { buttonVariants }  from '@/components/ui/button'
import { cn, formatNGN }   from '@/lib/utils'
import { DateRangeFilter } from '@/components/dashboard/date-range-filter'
import { RadioAiAnalysis } from './radio-ai-analysis'
import { getActiveBrand }  from '@/lib/active-brand'

export const dynamic = 'force-dynamic'

// Daypart → reach column
const REACH_COLUMN: Record<string, 'reach_am' | 'reach_pm' | 'reach_day'> = {
  morning_drive:    'reach_am',
  evening:          'reach_pm',
  daytime:          'reach_day',
  early_morning:    'reach_am',
  afternoon_drive:  'reach_pm',
  late_night:       'reach_day',
}

const DAYPART_LABEL: Record<string, string> = {
  early_morning:    'Early Morning',
  morning_drive:    'Morning Drive',
  daytime:          'Daytime',
  afternoon_drive:  'Afternoon Drive',
  evening:          'Evening',
  late_night:       'Late Night',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  scheduled:  'secondary',
  aired:      'default',
  missed:     'destructive',
  make_good:  'secondary',
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

type RadioStation = {
  reach_am: number | null
  reach_pm: number | null
  reach_day: number | null
} | null

type RadioScheduleRow = {
  id: string
  station_name: string
  daypart: string
  spot_date: string
  duration_sec: number
  spots_planned: number
  spots_aired: number | null
  net_cost: number | null
  rate_card: number | null
  currency: string
  status: string
  radio_stations: RadioStation
}

export default async function RadioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const days   = Math.min(180, Math.max(7, Number(params.days ?? 30)))

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const brand = await getActiveBrand<{ id: string; name: string }>(supabase, 'id, name')
  if (!brand) redirect('/onboarding')

  const { data: schedulesRaw } = await supabase
    .from('radio_schedules')
    .select(`
      id, station_name, daypart, spot_date, duration_sec,
      spots_planned, spots_aired, net_cost, rate_card, currency, status,
      radio_stations ( reach_am, reach_pm, reach_day )
    `)
    .eq('brand_id', brand.id)
    .gte('spot_date', cutoffStr)
    .order('spot_date', { ascending: false })

  const schedules = (schedulesRaw ?? []) as unknown as RadioScheduleRow[]
  const hasData = schedules.length > 0

  // Aggregate metrics
  let totalSpotPlanned = 0
  let totalSpotAired   = 0
  let totalSpend       = 0
  let totalReach       = 0

  for (const s of schedules) {
    totalSpotPlanned += s.spots_planned
    totalSpotAired   += s.spots_aired ?? 0
    totalSpend       += Number(s.net_cost ?? 0)

    const station = s.radio_stations
    if (station) {
      const col = REACH_COLUMN[s.daypart] ?? 'reach_day'
      totalReach += (station[col] ?? 0) * s.spots_planned
    }
  }

  const cpt = totalReach > 0 ? (totalSpend / (totalReach / 1000)) : 0
  const deliveryPct = totalSpotPlanned > 0 ? Math.round(totalSpotAired / totalSpotPlanned * 100) : 0

  return (
    <div className="max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
            <Radio className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Radio Intelligence</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track airtime, reach, and spend across Nigeria&apos;s top radio stations.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <DateRangeFilter currentDays={days} defaultDays={30} />
          <a
            href="/api/templates/radio"
            download
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}
          >
            <Download className="h-4 w-4" />
            Template
          </a>
          <MediaPlanUploadDialog type="radio" templateUrl="/api/templates/radio" />
        </div>
      </div>

      {!hasData ? (
        /* ── Empty state ──────────────────────────────────────────────────── */
        <Card className="border rounded-xl p-10 bg-card flex flex-col items-center gap-4 text-center">
          <div className="h-14 w-14 rounded-2xl bg-violet-500/10 flex items-center justify-center">
            <Radio className="h-7 w-7 text-violet-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">No radio schedules yet</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Upload your radio buy plan from your media agency to start tracking airtime,
              reach, and CPT across Nigerian stations.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <a
              href="/api/templates/radio"
              download
              className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
            >
              <Download className="h-4 w-4" />
              Download template
            </a>
            <MediaPlanUploadDialog type="radio" templateUrl="/api/templates/radio" />
          </div>
          <p className="text-xs text-muted-foreground max-w-xs">
            Fill in the .xlsx template with your station bookings, then upload it here.
            The system matches station names and calculates reach and CPT automatically.
          </p>
        </Card>
      ) : (
        <>
          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Spots Planned',  value: totalSpotPlanned.toLocaleString(), sub: `Last ${days} days`,          icon: Radio,      color: 'text-violet-500' },
              { label: 'Spots Aired',    value: totalSpotAired.toLocaleString(),   sub: `${deliveryPct}% delivery`, icon: Volume2, color: 'text-emerald-500' },
              { label: 'Gross Impressions', value: fmt(totalReach),                sub: 'Total listener-spots',  icon: Users,      color: 'text-blue-500' },
              { label: 'Total Spend',    value: formatNGN(totalSpend),           sub: `CPT: ${formatNGN(cpt)}/k`, icon: TrendingUp, color: 'text-indigo-500' },
            ].map(m => (
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

          {/* AI analysis */}
          <RadioAiAnalysis days={days} brandName={brand.name} hasData={hasData} />

          {/* Schedule table */}
          <Card className="border rounded-xl p-5 bg-card space-y-4">
            <h2 className="text-xl font-semibold">Schedule (last {days} days)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {['Station', 'Date', 'Daypart', 'Dur.', 'Planned', 'Aired', 'Net Cost', 'Status'].map(h => (
                      <th key={h} className="text-left pb-2.5 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schedules.slice(0, 50).map(s => (
                    <tr key={s.id} className="border-b border-border/30 last:border-0">
                      <td className="py-2.5 pr-4 font-medium whitespace-nowrap">{s.station_name}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{s.spot_date}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{DAYPART_LABEL[s.daypart] ?? s.daypart}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{s.duration_sec}s</td>
                      <td className="py-2.5 pr-4">{s.spots_planned}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{s.spots_aired ?? '–'}</td>
                      <td className="py-2.5 pr-4 font-medium">{s.net_cost ? formatNGN(Number(s.net_cost)) : '–'}</td>
                      <td className="py-2.5">
                        <Badge variant={STATUS_VARIANT[s.status] ?? 'secondary'} className="text-[10px] capitalize">
                          {s.status.replace('_', ' ')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {schedules.length > 50 && (
                <p className="text-xs text-muted-foreground pt-3">Showing 50 of {schedules.length} rows</p>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
