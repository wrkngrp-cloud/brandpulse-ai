import { createClient }   from '@/lib/supabase/server'
import { redirect }        from 'next/navigation'
import { Card }            from '@/components/ui/card'
import { Badge }           from '@/components/ui/badge'
import { Newspaper, BookOpen, TrendingUp, BarChart2, Download, QrCode, ExternalLink } from 'lucide-react'
import { MediaPlanUploadDialog } from '@/components/offline-media/media-plan-upload-dialog'
import { buttonVariants }  from '@/components/ui/button'
import { cn, formatNGN }   from '@/lib/utils'
import { DateRangeFilter } from '@/components/dashboard/date-range-filter'
import { PrintAiAnalysis } from './print-ai-analysis'
import { getActiveBrand }  from '@/lib/active-brand'

export const dynamic = 'force-dynamic'

const POSITION_LABEL: Record<string, string> = {
  front_page:  'Front Page',
  back_page:   'Back Page',
  page_3:      'Page 3',
  rop_interior:'ROP Interior',
  centrespread:'Centrespread',
}

const SIZE_LABEL: Record<string, string> = {
  full_page:    'Full Page',
  half_page:    'Half Page',
  quarter_page: 'Quarter Page',
  strip:        'Strip',
  jacket:       'Jacket',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  scheduled:  'secondary',
  published:  'default',
  cancelled:  'destructive',
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

type PrintPublication = {
  circulation: number | null
  readership_mult: number | null
} | null

type PrintPlacementRow = {
  id: string
  publication_name: string
  edition_date: string
  position: string
  size: string
  colour: string
  insertions: number
  net_cost: number | null
  attribution_url: string | null
  vanity_slug: string | null
  qr_scan_count: number
  status: string
  print_publications: PrintPublication
}

const APP_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://brandpulse-ai-tau.vercel.app'

export default async function PrintPage({
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

  const { data: placementsRaw } = await supabase
    .from('print_placements')
    .select(`
      id, publication_name, edition_date, position, size, colour,
      insertions, net_cost, attribution_url, vanity_slug, qr_scan_count, status,
      print_publications ( circulation, readership_mult )
    `)
    .eq('brand_id', brand.id)
    .gte('edition_date', cutoffStr)
    .order('edition_date', { ascending: false })
    .limit(200)

  const placements = (placementsRaw ?? []) as unknown as PrintPlacementRow[]
  const hasData = placements.length > 0

  // Aggregate metrics
  let totalInsertions   = 0
  let totalSpend        = 0
  let totalReadership   = 0
  let totalQrScans      = 0

  for (const p of placements) {
    totalInsertions += p.insertions
    totalSpend      += Number(p.net_cost ?? 0)
    totalQrScans    += p.qr_scan_count

    const pub = p.print_publications
    if (pub?.circulation && pub?.readership_mult) {
      totalReadership += pub.circulation * Number(pub.readership_mult) * p.insertions
    }
  }

  const qrScanRate = totalInsertions > 0 ? (totalQrScans / totalInsertions * 100).toFixed(2) : '0'

  return (
    <div className="max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
            <Newspaper className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Print Intelligence</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track newspaper and magazine placements, readership, and QR attribution
              across Nigeria&apos;s leading publications.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <DateRangeFilter currentDays={days} defaultDays={30} />
          <a
            href="/api/templates/print"
            download
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}
          >
            <Download className="h-4 w-4" />
            Template
          </a>
          <MediaPlanUploadDialog type="print" templateUrl="/api/templates/print" />
        </div>
      </div>

      {!hasData ? (
        /* ── Empty state ──────────────────────────────────────────────────── */
        <Card className="border rounded-xl p-10 bg-card flex flex-col items-center gap-4 text-center">
          <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <Newspaper className="h-7 w-7 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">No print placements yet</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Upload your print media plan to start tracking readership reach, cost efficiency,
              and QR scan attribution across The Punch, Vanguard, BusinessDay, and more.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <a
              href="/api/templates/print"
              download
              className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
            >
              <Download className="h-4 w-4" />
              Download template
            </a>
            <MediaPlanUploadDialog type="print" templateUrl="/api/templates/print" />
          </div>
          <p className="text-xs text-muted-foreground max-w-xs">
            Add an Attribution URL per placement and BrandPulse generates a QR-trackable
            vanity link automatically — no extra setup needed.
          </p>
        </Card>
      ) : (
        <>
          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total Insertions',   value: totalInsertions.toLocaleString(), sub: `Last ${days} days`,           icon: Newspaper,  color: 'text-amber-600' },
              { label: 'Total Spend',        value: formatNGN(totalSpend),          sub: 'Net cost across all buys', icon: TrendingUp,  color: 'text-indigo-500' },
              { label: 'Est. Readership',    value: fmt(totalReadership),             sub: 'Circ. × pass-along',      icon: BookOpen,    color: 'text-emerald-500' },
              { label: 'QR Scans',           value: totalQrScans.toLocaleString(),    sub: `${qrScanRate}% scan rate`, icon: BarChart2,  color: 'text-blue-500' },
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
          <PrintAiAnalysis days={days} brandName={brand.name} hasData={hasData} />

          {/* Placements table */}
          <Card className="border rounded-xl p-5 bg-card space-y-4">
            <h2 className="text-xl font-semibold">Placements</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {['Publication', 'Date', 'Position', 'Size', 'Colour', 'Insertions', 'Net Cost', 'QR Link', 'Scans', 'Status'].map(h => (
                      <th key={h} className="text-left pb-2.5 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {placements.slice(0, 50).map(p => {
                    const qrUrl = p.vanity_slug ? `${APP_URL}/go/${p.vanity_slug}` : null
                    return (
                      <tr key={p.id} className="border-b border-border/30 last:border-0">
                        <td className="py-2.5 pr-4 font-medium whitespace-nowrap">{p.publication_name}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{p.edition_date}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{POSITION_LABEL[p.position] ?? p.position}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{SIZE_LABEL[p.size] ?? p.size}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{p.colour === 'full_colour' ? 'Colour' : 'B&W'}</td>
                        <td className="py-2.5 pr-4">{p.insertions}</td>
                        <td className="py-2.5 pr-4 font-medium">{p.net_cost ? formatNGN(Number(p.net_cost)) : '–'}</td>
                        <td className="py-2.5 pr-4">
                          {qrUrl ? (
                            <a
                              href={qrUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <QrCode className="h-3 w-3" />
                              <span className="max-w-[100px] truncate">{p.vanity_slug}</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground/40">–</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 font-medium">
                          {p.qr_scan_count > 0 ? (
                            <span className="text-emerald-600">{p.qr_scan_count.toLocaleString()}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <Badge variant={STATUS_VARIANT[p.status] ?? 'secondary'} className="text-[10px] capitalize">
                            {p.status}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {placements.length > 50 && (
                <p className="text-xs text-muted-foreground pt-3">Showing 50 of {placements.length} placements</p>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
