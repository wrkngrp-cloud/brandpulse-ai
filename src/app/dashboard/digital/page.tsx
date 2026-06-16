import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Monitor, TrendingUp, Eye, MousePointerClick, Coins,
  CheckCircle, AlertCircle, Link as LinkIcon,
} from 'lucide-react'
import { DigitalSpendChart } from './digital-charts'
import type { SpendDataPoint } from './digital-charts'
import { createClient } from '@/lib/supabase/server'
import { DateRangeFilter } from '@/components/dashboard/date-range-filter'

export const dynamic = 'force-dynamic'

// ── types ────────────────────────────────────────────────────────────────────

interface AdAccount {
  id:          string
  platform:    string
  account_name: string | null
  sync_status: string
  last_synced_at: string | null
}

interface PerfRow {
  platform:    string
  date:        string
  spend:       number
  impressions: number
  clicks:      number
  ctr:         number | null
  cpm:         number | null
  conversions: number
}

interface PlatformSummary {
  platform:    string
  spend:       number
  impressions: number
  clicks:      number
  avgCtr:      number
  avgCpm:      number
  conversions: number
}

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtNGN(val: number): string {
  if (val >= 1_000_000) return `₦${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000)     return `₦${(val / 1_000).toFixed(0)}K`
  return `₦${Math.round(val)}`
}

function fmtNum(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000)     return `${(val / 1_000).toFixed(0)}K`
  return `${Math.round(val)}`
}

function fmtPct(val: number): string {
  return `${(val * 100).toFixed(2)}%`
}

function platformLabel(p: string): string {
  const map: Record<string, string> = {
    meta:     'Meta Ads',
    google:   'Google Ads',
    tiktok:   'TikTok Ads',
    linkedin: 'LinkedIn Ads',
    twitter:  'X (Twitter) Ads',
  }
  return map[p] ?? p
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function DigitalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params    = await searchParams
  const days      = Math.min(180, Math.max(7, Number(params.days ?? 30)))
  const connected = params.connected   // e.g. 'meta'
  const setupNeeded = params.setup     // e.g. 'google' — env var not configured
  const oauthError  = params.error

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  let adAccounts: AdAccount[] = []
  let perfRows:   PerfRow[]   = []
  let brandId:    string | null = null

  if (user) {
    // Resolve brand
    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .limit(1)
      .single()

    if (brand) {
      brandId = brand.id

      // Fetch connected ad accounts
      const { data: accounts } = await supabase
        .from('digital_ad_accounts')
        .select('id, platform, account_name, sync_status, last_synced_at')
        .eq('brand_id', brand.id)
        .neq('sync_status', 'disconnected')

      adAccounts = accounts ?? []

      // Fetch performance data for selected range
      const { data: rows } = await supabase
        .from('digital_performance_daily')
        .select('platform, date, spend, impressions, clicks, ctr, cpm, conversions')
        .eq('brand_id', brand.id)
        .gte('date', cutoffStr)
        .order('date', { ascending: true })

      perfRows = (rows ?? []) as PerfRow[]
    }
  }

  const DEMO_EMAIL  = 'demo@jarafoods.brandpulse.ai'
  const isDemoUser  = user?.email === DEMO_EMAIL
  const hasRealData = perfRows.length > 0
  const isDemo      = !hasRealData && isDemoUser

  // ── seed demo data only for the Jara Foods demo account ──────────────────
  if (isDemo && brandId) {
    void fetch(`${process.env.APP_URL ?? ''}/api/demo/seed-digital`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => null)
  }

  // ── aggregates ───────────────────────────────────────────────────────────
  const totalSpend       = perfRows.reduce((s, r) => s + (r.spend ?? 0), 0)
  const totalImpressions = perfRows.reduce((s, r) => s + (r.impressions ?? 0), 0)
  const totalClicks      = perfRows.reduce((s, r) => s + (r.clicks ?? 0), 0)
  const totalConversions = perfRows.reduce((s, r) => s + (r.conversions ?? 0), 0)

  const ctrRows  = perfRows.filter(r => r.ctr  !== null && r.ctr  !== 0)
  const avgCtr   = ctrRows.length  > 0 ? ctrRows.reduce((s, r)  => s + (r.ctr  ?? 0), 0) / ctrRows.length  : 0
  const avgRoas  = totalSpend > 0 && totalConversions > 0
    ? (totalConversions * 1200) / totalSpend   // Approx: each conversion ~₦1,200 revenue
    : 0

  // ── per-platform breakdown ────────────────────────────────────────────────
  const platformMap: Record<string, PlatformSummary> = {}
  for (const row of perfRows) {
    if (!platformMap[row.platform]) {
      platformMap[row.platform] = { platform: row.platform, spend: 0, impressions: 0, clicks: 0, avgCtr: 0, avgCpm: 0, conversions: 0 }
    }
    const p = platformMap[row.platform]
    p.spend       += row.spend       ?? 0
    p.impressions += row.impressions ?? 0
    p.clicks      += row.clicks      ?? 0
    p.conversions += row.conversions ?? 0
  }
  for (const p of Object.values(platformMap)) {
    const pRows = perfRows.filter(r => r.platform === p.platform)
    const ctrR  = pRows.filter(r => r.ctr !== null && r.ctr !== 0)
    const cpmR  = pRows.filter(r => r.cpm !== null && r.cpm !== 0)
    p.avgCtr = ctrR.length > 0 ? ctrR.reduce((s, r) => s + (r.ctr ?? 0), 0) / ctrR.length : 0
    p.avgCpm = cpmR.length > 0 ? cpmR.reduce((s, r) => s + (r.cpm ?? 0), 0) / cpmR.length : 0
  }
  const platformSummaries = Object.values(platformMap).sort((a, b) => b.spend - a.spend)

  // ── chart data: daily totals grouped into weeks ───────────────────────────
  const dailyMap: Record<string, { spend: number; impressions: number }> = {}
  for (const row of perfRows) {
    if (!dailyMap[row.date]) dailyMap[row.date] = { spend: 0, impressions: 0 }
    dailyMap[row.date].spend       += row.spend       ?? 0
    dailyMap[row.date].impressions += row.impressions ?? 0
  }

  // Group into 7-day buckets
  const sortedDates = Object.keys(dailyMap).sort()
  const chartData: SpendDataPoint[] = []
  for (let i = 0; i < sortedDates.length; i += 7) {
    const bucket = sortedDates.slice(i, i + 7)
    const spend       = bucket.reduce((s, d) => s + dailyMap[d].spend,       0)
    const impressions = bucket.reduce((s, d) => s + dailyMap[d].impressions, 0)
    const weekNum = Math.floor(i / 7) + 1
    chartData.push({ label: `Wk ${weekNum}`, spend, impressions })
  }

  // ── platform connection cards config ─────────────────────────────────────
  const PLATFORMS = [
    {
      key:         'meta',
      label:       'Meta Ads',
      description: 'Facebook & Instagram campaigns',
      connectHref: '/api/ads/meta/connect',
      available:   true,
    },
    {
      key:         'google',
      label:       'Google Ads',
      description: 'Search, Display & Shopping',
      connectHref: '/api/ads/google/connect',
      available:   true,
    },
    {
      key:         'tiktok',
      label:       'TikTok Ads',
      description: 'Short-form video advertising',
      connectHref: '#',
      available:   false,
    },
    {
      key:         'linkedin',
      label:       'LinkedIn Ads',
      description: 'B2B and professional audiences',
      connectHref: '#',
      available:   false,
    },
  ]

  const connectedPlatforms = new Set(adAccounts.map(a => a.platform))

  const kpis = [
    {
      label: 'Total Spend',
      value: hasRealData ? fmtNGN(totalSpend) : isDemo ? '₦2.4M' : '—',
      sub:   hasRealData ? `Last ${days} days` : isDemo ? 'Demo data' : 'Connect an ad account',
      icon:  Coins,
      color: 'text-indigo-500',
    },
    {
      label: 'Impressions',
      value: hasRealData ? fmtNum(totalImpressions) : isDemo ? '4.2M' : '—',
      sub:   hasRealData ? `Last ${days} days` : isDemo ? 'Demo data' : 'No data yet',
      icon:  Eye,
      color: 'text-emerald-500',
    },
    {
      label: 'Avg CTR',
      value: hasRealData ? fmtPct(avgCtr) : isDemo ? '2.3%' : '—',
      sub:   hasRealData ? 'Across all platforms' : isDemo ? 'Industry avg 1.8%' : 'No data yet',
      icon:  MousePointerClick,
      color: 'text-blue-500',
    },
    {
      label: 'Avg ROAS',
      value: hasRealData ? (avgRoas > 0 ? `${avgRoas.toFixed(1)}x` : 'N/A') : isDemo ? '3.4x' : '—',
      sub:   hasRealData ? 'Return on ad spend' : isDemo ? 'Demo data' : 'No data yet',
      icon:  TrendingUp,
      color: 'text-violet-500',
    },
  ]

  return (
    <div className="max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 mt-0.5">
            <Monitor className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Digital Campaigns</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track your paid media performance across all connected ad platforms.
            </p>
          </div>
        </div>
        <DateRangeFilter currentDays={days} defaultDays={30} />
      </div>

      {/* Connected success banner */}
      {connected && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 dark:border-green-800/40 dark:bg-green-950/30 px-4 py-3">
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-300 capitalize">
            {connected} Ads connected. Data will appear after tonight&apos;s sync at 5 AM Lagos time.
          </p>
        </div>
      )}

      {/* Setup required banner — env vars not yet configured */}
      {setupNeeded && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-950/30 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 shrink-0" />
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300 capitalize">{setupNeeded} Ads: environment variables needed</p>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-400 ml-6">
            Add <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">
              {setupNeeded === 'google' ? 'GOOGLE_ADS_CLIENT_ID + GOOGLE_ADS_CLIENT_SECRET' :
               setupNeeded === 'tiktok' ? 'TIKTOK_ADS_APP_ID + TIKTOK_ADS_SECRET' :
               setupNeeded === 'linkedin' ? 'LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET' : `${setupNeeded.toUpperCase()}_CLIENT_ID`}
            </code> to your Vercel environment variables, then redeploy.
          </p>
        </div>
      )}

      {/* Meta OAuth redirect URI instruction banner */}
      {oauthError === 'oauth_cancelled' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/30 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Meta Ads: Redirect URI not whitelisted</p>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            In your <strong>Meta for Developers</strong> app, go to <strong>Facebook Login → Settings</strong> and add this exact URL to <strong>Valid OAuth Redirect URIs</strong>:
          </p>
          <code className="block text-xs bg-amber-100 dark:bg-amber-900/40 px-3 py-1.5 rounded font-mono">
            {process.env.APP_URL ?? 'https://brandpulse-ai-tau.vercel.app'}/api/ads/meta/callback
          </code>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Also ensure your app has <strong>Marketing API</strong> enabled and that <strong>Client OAuth Login</strong> and <strong>Web OAuth Login</strong> are both turned on.
          </p>
        </div>
      )}

      {/* Demo banner */}
      {isDemo && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/30 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            You are viewing demo data for Jara Foods. Connect a real ad account below to see your actual performance.
          </p>
        </div>
      )}

      {/* Platform connection cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PLATFORMS.map(p => {
          const isConnected = connectedPlatforms.has(p.key)
          const acct        = adAccounts.find(a => a.platform === p.key)

          return (
            <Card key={p.key} className="border rounded-xl p-4 bg-card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{p.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                </div>
                {isConnected ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : p.available ? (
                  <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                ) : null}
              </div>

              {isConnected && acct ? (
                <div className="space-y-1">
                  <Badge variant="default" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-0">
                    Connected
                  </Badge>
                  {acct.last_synced_at && (
                    <p className="text-[10px] text-muted-foreground">
                      Synced {new Date(acct.last_synced_at).toLocaleDateString('en-NG')}
                    </p>
                  )}
                  {acct.sync_status === 'error' && (
                    <p className="text-[10px] text-rose-500">Sync error — check connection</p>
                  )}
                </div>
              ) : p.available ? (
                <Link
                  href={p.connectHref}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full text-xs h-7 justify-center')}
                >
                  Connect
                </Link>
              ) : (
                <Badge variant="secondary" className="text-[10px]">Coming soon</Badge>
              )}
            </Card>
          )
        })}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map(m => (
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

      {/* Per-platform breakdown */}
      {platformSummaries.length > 0 && (
        <Card className="border rounded-xl p-5 bg-card space-y-4">
          <h2 className="text-base font-semibold">Platform Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  {['Platform', 'Spend', 'Impressions', 'Clicks', 'Avg CTR', 'Avg CPM', 'Conversions'].map(h => (
                    <th key={h} className="text-left pb-2.5 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {platformSummaries.map(p => (
                  <tr key={p.platform} className="border-b border-border/30 last:border-0">
                    <td className="py-3 pr-4 font-medium whitespace-nowrap">{platformLabel(p.platform)}</td>
                    <td className="py-3 pr-4 font-medium">{fmtNGN(p.spend)}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{fmtNum(p.impressions)}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{fmtNum(p.clicks)}</td>
                    <td className="py-3 pr-4 font-medium text-emerald-600">{fmtPct(p.avgCtr)}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{fmtNGN(p.avgCpm)}</td>
                    <td className="py-3">{p.conversions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Spend vs Impressions chart */}
      <Card className="border rounded-xl p-5 bg-card space-y-3">
        <div>
          <h2 className="text-base font-semibold">Spend vs Impressions ({days} Days)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Weekly digital ad spend correlated with impression delivery
            {isDemo && ' · Demo data'}
          </p>
        </div>
        <DigitalSpendChart data={chartData.length > 0 ? chartData : undefined} demo={isDemo} />
      </Card>

    </div>
  )
}
