import { createClient }   from '@/lib/supabase/server'
import { redirect }        from 'next/navigation'
import { Card }            from '@/components/ui/card'
import { Badge }           from '@/components/ui/badge'
import { Tv, Users, TrendingUp, Activity, Download } from 'lucide-react'
import { MediaPlanUploadDialog } from '@/components/offline-media/media-plan-upload-dialog'
import { buttonVariants }  from '@/components/ui/button'
import { cn }              from '@/lib/utils'
import { DateRangeFilter } from '@/components/dashboard/date-range-filter'
import { TvAiAnalysis }    from './tv-ai-analysis'

export const dynamic = 'force-dynamic'

const DAYPART_LABEL: Record<string, string> = {
  breakfast:    'Breakfast',
  daytime:      'Daytime',
  early_fringe: 'Early Fringe',
  prime_time:   'Prime Time',
  late_fringe:  'Late Fringe',
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

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `₦${(n / 1_000).toFixed(0)}K`
  return `₦${n.toFixed(0)}`
}

type TvChannel = {
  reach_prime: number | null
  reach_day:   number | null
} | null

type TvScheduleRow = {
  id: string
  channel_name: string
  programme: string | null
  daypart: string
  spot_date: string
  duration_sec: number
  spots_planned: number
  spots_aired: number | null
  grp_planned: number | null
  grp_delivered: number | null
  net_cost: number | null
  currency: string
  status: string
  tv_channels: TvChannel
}

export default async function TVPage({
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

  const { data: brand } = await supabase.from('brands').select('id, name').limit(1).single()
  if (!brand) redirect('/onboarding')

  const { data: schedulesRaw } = await supabase
    .from('tv_schedules')
    .select(`
      id, channel_name, programme, daypart, spot_date, duration_sec,
      spots_planned, spots_aired, grp_planned, grp_delivered,
      net_cost, currency, status,
      tv_channels ( reach_prime, reach_day )
    `)
    .eq('brand_id', brand.id)
    .gte('spot_date', cutoffStr)
    .order('spot_date', { ascending: false })

  const schedules = (schedulesRaw ?? []) as unknown as TvScheduleRow[]
  const hasData = schedules.length > 0

  // Aggregate metrics
  let totalSpotPlanned = 0
  let totalSpotAired   = 0
  let totalSpend       = 0
  let totalGrpPlanned  = 0
  let totalGrpDelivered = 0
  let totalReach       = 0

  for (const s of schedules) {
    totalSpotPlanned   += s.spots_planned
    totalSpotAired     += s.spots_aired ?? 0
    totalSpend         += Number(s.net_cost ?? 0)
    totalGrpPlanned    += Number(s.grp_planned ?? 0)
    totalGrpDelivered  += Number(s.grp_delivered ?? 0)

    const ch = s.tv_channels
    if (ch) {
      const reachCol = s.daypart === 'prime_time' ? ch.reach_prime : ch.reach_day
      totalReach += (reachCol ?? 0) * s.spots_planned
    }
  }

  const cprp = totalGrpDelivered > 0 ? (totalSpend / totalGrpDelivered) : 0
  const deliveryPct = totalSpotPlanned > 0 ? Math.round(totalSpotAired / totalSpotPlanned * 100) : 0

  return (
    <div className="max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
            <Tv className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">TV Intelligence</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track TV spot performance, GRP delivery, and spend across Nigerian channels.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <DateRangeFilter currentDays={days} defaultDays={30} />
          <a
            href="/api/templates/tv"
            download
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}
          >
            <Download className="h-4 w-4" />
            Template
          </a>
          <MediaPlanUploadDialog type="tv" templateUrl="/api/templates/tv" />
        </div>
      </div>

      {!hasData ? (
        /* ── Empty state ──────────────────────────────────────────────────── */
        <Card className="border rounded-xl p-10 bg-card flex flex-col items-center gap-4 text-center">
          <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
            <Tv className="h-7 w-7 text-blue-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">No TV schedules yet</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Upload your TV buy plan to start tracking GRP delivery, reach, and CPRP
              across NTA, Channels TV, AIT, DSTV, and other Nigerian channels.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <a
              href="/api/templates/tv"
              download
              className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
            >
              <Download className="h-4 w-4" />
              Download template
            </a>
            <MediaPlanUploadDialog type="tv" templateUrl="/api/templates/tv" />
          </div>
          <p className="text-xs text-muted-foreground max-w-xs">
            Fill in the .xlsx template with your channel bookings, then upload it here.
            The system matches channel names and computes estimated reach and CPRP.
          </p>
        </Card>
      ) : (
        <>
          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'GRPs Planned',   value: totalGrpPlanned.toFixed(1),    sub: `Last ${days} days`,          icon: TrendingUp, color: 'text-blue-500' },
              { label: 'GRPs Delivered', value: totalGrpDelivered.toFixed(1),  sub: `${deliveryPct}% delivery`, icon: Activity, color: 'text-emerald-500' },
              { label: 'Est. Reach',     value: fmt(totalReach),               sub: 'Total viewer-spots',    icon: Users,      color: 'text-indigo-500' },
              { label: 'Total Spend',    value: fmtCurrency(totalSpend),       sub: `CPRP: ${fmtCurrency(cprp)}`, icon: Tv, color: 'text-violet-500' },
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
          <TvAiAnalysis days={days} brandName={brand.name} hasData={hasData} />

          {/* Schedule table */}
          <Card className="border rounded-xl p-5 bg-card space-y-4">
            <h2 className="text-xl font-semibold">Schedule (last {days} days)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {['Channel', 'Programme', 'Date', 'Daypart', 'Dur.', 'Planned', 'Aired', 'GRP', 'Net Cost', 'Status'].map(h => (
                      <th key={h} className="text-left pb-2.5 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schedules.slice(0, 50).map(s => (
                    <tr key={s.id} className="border-b border-border/30 last:border-0">
                      <td className="py-2.5 pr-4 font-medium whitespace-nowrap">{s.channel_name}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{s.programme ?? '–'}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{s.spot_date}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{DAYPART_LABEL[s.daypart] ?? s.daypart}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{s.duration_sec}s</td>
                      <td className="py-2.5 pr-4">{s.spots_planned}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{s.spots_aired ?? '–'}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{s.grp_planned ? Number(s.grp_planned).toFixed(1) : '–'}</td>
                      <td className="py-2.5 pr-4 font-medium">{s.net_cost ? fmtCurrency(Number(s.net_cost)) : '–'}</td>
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
