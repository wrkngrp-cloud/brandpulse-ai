import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn, formatNGN } from '@/lib/utils'
import {
  Monitor, TrendingUp, Eye, MousePointerClick, Coins, Users, Target,
  CheckCircle, AlertCircle, Link as LinkIcon, ChevronRight,
} from 'lucide-react'
import {
  DigitalSpendChart,
  ConversionFunnelChart,
  FrequencyBarChart,
} from './digital-charts'
import type { SpendDataPoint, FunnelData, FrequencyPoint } from './digital-charts'
import { createClient } from '@/lib/supabase/server'
import { DateRangeFilter } from '@/components/dashboard/date-range-filter'
import { TourTrigger } from '@/components/tours/tour-trigger'
import {
  getBenchmarks,
  benchCTR, benchCPC, benchCPM, benchROAS, benchFreq, benchCVR,
  OBJECTIVE_METRIC_LABELS,
} from '@/lib/benchmarks/digital'

export const dynamic = 'force-dynamic'

// ── types ─────────────────────────────────────────────────────────────────────

interface AdAccount {
  id:             string
  platform:       string
  account_name:   string | null
  sync_status:    string
  last_synced_at: string | null
}

interface PerfRow {
  platform:        string
  date:            string
  spend:           number
  impressions:     number
  reach:           number
  clicks:          number
  ctr:             number | null
  cpm:             number | null
  cpc:             number | null
  cpa:             number | null
  roas:            number | null
  frequency:       number | null
  video_views:     number | null
  video_view_rate: number | null
  conversions:     number
  campaign_id:     string | null
  campaign_name:   string | null
  objective:       string | null
}

interface PlatformSummary {
  platform:     string
  spend:        number
  impressions:  number
  reach:        number
  clicks:       number
  conversions:  number
  avgCtr:       number
  avgCpm:       number
  avgCpc:       number
  avgCpa:       number
  avgRoas:      number
  avgFrequency: number
  cvr:          number
}

interface CampaignSummary {
  campaign_id:   string
  campaign_name: string
  platform:      string
  objective:     string | null
  spend:         number
  impressions:   number
  reach:         number
  clicks:        number
  conversions:   number
  avgCtr:        number
  avgCpm:        number
  avgCpc:        number
  avgCpa:        number
  avgRoas:       number
  cvr:           number
  days:          number
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtNGN(val: number): string {
  return formatNGN(val)
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

function objectiveLabel(o: string | null): string {
  if (!o) return '—'
  return OBJECTIVE_METRIC_LABELS[o]?.label ?? o
}

// ── server-component sub-components ──────────────────────────────────────────

function MetricRow({ label, value, bench }: {
  label: string
  value: string
  bench?: { label: string; cls: string } | null
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold tabular-nums">{value}</span>
        {bench && (
          <span className={`text-[10px] font-medium leading-none ${bench.cls}`}>{bench.label}</span>
        )}
      </div>
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function DigitalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params      = await searchParams
  const days        = Math.min(180, Math.max(7, Number(params.days ?? 30)))
  const connected   = params.connected
  const setupNeeded = params.setup
  const oauthError  = params.error

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let adAccounts:  AdAccount[] = []
  let perfRows:    PerfRow[]   = []
  let brandId:     string | null = null
  let brandIndustry: string | null = null

  if (user) {
    const { data: brand } = await supabase
      .from('brands')
      .select('id, category')
      .limit(1)
      .single()

    if (brand) {
      brandId       = brand.id
      brandIndustry = brand.category ?? null

      const { data: accounts } = await supabase
        .from('digital_ad_accounts')
        .select('id, platform, account_name, sync_status, last_synced_at')
        .eq('brand_id', brand.id)
        .neq('sync_status', 'disconnected')
      adAccounts = accounts ?? []

      const { data: rows } = await supabase
        .from('digital_performance_daily')
        .select('platform, date, spend, impressions, reach, clicks, ctr, cpm, cpc, cpa, roas, frequency, video_views, video_view_rate, conversions, campaign_id, campaign_name, objective')
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

  if (isDemo && brandId && process.env.APP_URL) {
    void fetch(`${process.env.APP_URL}/api/demo/seed-digital`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => null)
  }

  const bench = getBenchmarks(brandIndustry)

  // ── core aggregates ───────────────────────────────────────────────────────

  const totalSpend       = perfRows.reduce((s, r) => s + (r.spend       ?? 0), 0)
  const totalImpressions = perfRows.reduce((s, r) => s + (r.impressions ?? 0), 0)
  const totalReach       = perfRows.reduce((s, r) => s + (r.reach       ?? 0), 0)
  const totalClicks      = perfRows.reduce((s, r) => s + (r.clicks      ?? 0), 0)
  const totalConversions = perfRows.reduce((s, r) => s + (r.conversions ?? 0), 0)

  const ctrRows  = perfRows.filter(r => r.ctr            !== null && (r.ctr            ?? 0) !== 0)
  const cpmRows  = perfRows.filter(r => r.cpm            !== null && (r.cpm            ?? 0) !== 0)
  const cpcRows  = perfRows.filter(r => r.cpc            !== null && (r.cpc            ?? 0) !== 0)
  const cpaRows  = perfRows.filter(r => r.cpa            !== null && (r.cpa            ?? 0) !== 0)
  const roasRows = perfRows.filter(r => r.roas           !== null && (r.roas           ?? 0) !== 0)
  const freqRows = perfRows.filter(r => r.frequency      !== null && (r.frequency      ?? 0) !== 0)
  const vvrRows  = perfRows.filter(r => r.video_view_rate !== null && (r.video_view_rate ?? 0) !== 0)

  const avgCtr       = ctrRows.length  > 0 ? ctrRows.reduce((s, r)  => s + (r.ctr            ?? 0), 0) / ctrRows.length  : 0
  const avgCpm       = cpmRows.length  > 0 ? cpmRows.reduce((s, r)  => s + (r.cpm            ?? 0), 0) / cpmRows.length  : 0
  const avgCpc       = cpcRows.length  > 0 ? cpcRows.reduce((s, r)  => s + (r.cpc            ?? 0), 0) / cpcRows.length  : 0
  const avgCpa       = cpaRows.length  > 0 ? cpaRows.reduce((s, r)  => s + (r.cpa            ?? 0), 0) / cpaRows.length  : 0
  const avgRoasDB    = roasRows.length > 0 ? roasRows.reduce((s, r) => s + (r.roas           ?? 0), 0) / roasRows.length : 0
  const avgFrequency = freqRows.length > 0 ? freqRows.reduce((s, r) => s + (r.frequency      ?? 0), 0) / freqRows.length : 0
  const avgVVR       = vvrRows.length  > 0 ? vvrRows.reduce((s, r)  => s + (r.video_view_rate ?? 0), 0) / vvrRows.length  : 0
  const cvr          = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0
  const avgRoas      = avgRoasDB > 0
    ? avgRoasDB
    : totalSpend > 0 && totalConversions > 0
      ? (totalConversions * 1200) / totalSpend
      : 0

  // ── per-campaign breakdown ────────────────────────────────────────────────

  const campaignMap: Record<string, CampaignSummary> = {}
  for (const row of perfRows) {
    const key = row.campaign_id ?? `__no_id_${row.platform}`
    if (!campaignMap[key]) {
      campaignMap[key] = {
        campaign_id:   row.campaign_id ?? key,
        campaign_name: row.campaign_name ?? 'Unknown Campaign',
        platform:      row.platform,
        objective:     row.objective ?? null,
        spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0,
        avgCtr: 0, avgCpm: 0, avgCpc: 0, avgCpa: 0, avgRoas: 0, cvr: 0, days: 0,
      }
    }
    const c = campaignMap[key]
    c.spend       += row.spend       ?? 0
    c.impressions += row.impressions ?? 0
    c.reach       += row.reach       ?? 0
    c.clicks      += row.clicks      ?? 0
    c.conversions += row.conversions ?? 0
    c.days        += 1
    if (!c.objective && row.objective) c.objective = row.objective
  }

  for (const c of Object.values(campaignMap)) {
    const pr = perfRows.filter(r => (r.campaign_id ?? `__no_id_${r.platform}`) === c.campaign_id)
    const avgOf = (fn: (r: PerfRow) => number | null) => {
      const valid = pr.filter(r => { const v = fn(r); return v !== null && v > 0 })
      return valid.length > 0 ? valid.reduce((s, r) => s + (fn(r) ?? 0), 0) / valid.length : 0
    }
    c.avgCtr  = avgOf(r => r.ctr)
    c.avgCpm  = avgOf(r => r.cpm)
    c.avgCpc  = avgOf(r => r.cpc)
    c.avgCpa  = avgOf(r => r.cpa)
    c.avgRoas = avgOf(r => r.roas)
    c.cvr     = c.clicks > 0 ? (c.conversions / c.clicks) * 100 : 0
  }

  const campaignSummaries = Object.values(campaignMap).sort((a, b) => b.spend - a.spend)

  // ── per-platform breakdown ────────────────────────────────────────────────

  const platformMap: Record<string, PlatformSummary> = {}
  for (const row of perfRows) {
    if (!platformMap[row.platform]) {
      platformMap[row.platform] = {
        platform: row.platform, spend: 0, impressions: 0, reach: 0,
        clicks: 0, conversions: 0, avgCtr: 0, avgCpm: 0, avgCpc: 0,
        avgCpa: 0, avgRoas: 0, avgFrequency: 0, cvr: 0,
      }
    }
    const p = platformMap[row.platform]
    p.spend       += row.spend       ?? 0
    p.impressions += row.impressions ?? 0
    p.reach       += row.reach       ?? 0
    p.clicks      += row.clicks      ?? 0
    p.conversions += row.conversions ?? 0
  }
  for (const p of Object.values(platformMap)) {
    const pr    = perfRows.filter(r => r.platform === p.platform)
    const _ctr  = pr.filter(r => r.ctr  !== null && (r.ctr  ?? 0) !== 0)
    const _cpm  = pr.filter(r => r.cpm  !== null && (r.cpm  ?? 0) !== 0)
    const _cpc  = pr.filter(r => r.cpc  !== null && (r.cpc  ?? 0) !== 0)
    const _cpa  = pr.filter(r => r.cpa  !== null && (r.cpa  ?? 0) !== 0)
    const _roas = pr.filter(r => r.roas !== null && (r.roas ?? 0) !== 0)
    const _freq = pr.filter(r => r.frequency !== null && (r.frequency ?? 0) !== 0)
    p.avgCtr      = _ctr.length  > 0 ? _ctr.reduce((s, r)  => s + (r.ctr  ?? 0), 0) / _ctr.length  : 0
    p.avgCpm      = _cpm.length  > 0 ? _cpm.reduce((s, r)  => s + (r.cpm  ?? 0), 0) / _cpm.length  : 0
    p.avgCpc      = _cpc.length  > 0 ? _cpc.reduce((s, r)  => s + (r.cpc  ?? 0), 0) / _cpc.length  : 0
    p.avgCpa      = _cpa.length  > 0 ? _cpa.reduce((s, r)  => s + (r.cpa  ?? 0), 0) / _cpa.length  : 0
    p.avgRoas     = _roas.length > 0 ? _roas.reduce((s, r) => s + (r.roas ?? 0), 0) / _roas.length : 0
    p.avgFrequency = _freq.length > 0 ? _freq.reduce((s, r) => s + (r.frequency ?? 0), 0) / _freq.length : 0
    p.cvr         = p.clicks > 0 ? (p.conversions / p.clicks) * 100 : 0
  }
  const platformSummaries = Object.values(platformMap).sort((a, b) => b.spend - a.spend)

  // ── chart data ────────────────────────────────────────────────────────────

  const funnelData: FunnelData | undefined = hasRealData
    ? { impressions: totalImpressions, clicks: totalClicks, conversions: totalConversions }
    : undefined

  const frequencyChartData: FrequencyPoint[] = hasRealData
    ? platformSummaries
        .filter(p => p.avgFrequency > 0)
        .map(p => ({ platform: platformLabel(p.platform), frequency: parseFloat(p.avgFrequency.toFixed(2)) }))
    : []

  const dailyMap: Record<string, { spend: number; impressions: number }> = {}
  for (const row of perfRows) {
    if (!dailyMap[row.date]) dailyMap[row.date] = { spend: 0, impressions: 0 }
    dailyMap[row.date].spend       += row.spend       ?? 0
    dailyMap[row.date].impressions += row.impressions ?? 0
  }
  const sortedDates = Object.keys(dailyMap).sort()
  const spendChartData: SpendDataPoint[] = []
  for (let i = 0; i < sortedDates.length; i += 7) {
    const bucket = sortedDates.slice(i, i + 7)
    spendChartData.push({
      label:       `Wk ${Math.floor(i / 7) + 1}`,
      spend:       bucket.reduce((s, d) => s + dailyMap[d].spend,       0),
      impressions: bucket.reduce((s, d) => s + dailyMap[d].impressions, 0),
    })
  }

  // ── platform connection config ────────────────────────────────────────────

  const PLATFORMS = [
    { key: 'meta',     label: 'Meta Ads',     description: 'Facebook & Instagram campaigns', connectHref: '/api/ads/meta/connect',     available: true  },
    { key: 'google',   label: 'Google Ads',   description: 'Search, Display & Shopping',     connectHref: '/api/ads/google/connect',   available: true  },
    { key: 'twitter',  label: 'X (Twitter)',  description: 'Promoted posts and campaigns',   connectHref: '/api/ads/twitter/connect',  available: true  },
    { key: 'tiktok',   label: 'TikTok Ads',   description: 'Short-form video advertising',   connectHref: '#',                        available: false },
    { key: 'linkedin', label: 'LinkedIn Ads', description: 'B2B and professional audiences', connectHref: '#',                        available: false },
  ]

  const connectedPlatforms = new Set(adAccounts.map(a => a.platform))

  // ── KPI grid ──────────────────────────────────────────────────────────────

  const kpis = [
    {
      label: 'Total Spend',
      value: hasRealData ? fmtNGN(totalSpend)       : isDemo ? '₦2.4M'  : '—',
      sub:   hasRealData ? `Last ${days} days`       : isDemo ? 'Demo data'          : 'Connect an ad account',
      icon: Coins,            color: 'text-indigo-500',
    },
    {
      label: 'Impressions',
      value: hasRealData ? fmtNum(totalImpressions) : isDemo ? '4.2M'   : '—',
      sub:   hasRealData ? `Last ${days} days`       : isDemo ? 'Demo data'          : 'No data yet',
      icon: Eye,              color: 'text-emerald-500',
    },
    {
      label: 'Reach',
      value: hasRealData ? fmtNum(totalReach)       : isDemo ? '2.8M'   : '—',
      sub:   hasRealData ? 'Unique users'            : isDemo ? 'Demo data'          : 'No data yet',
      icon: Users,            color: 'text-sky-500',
    },
    {
      label: 'Avg CTR',
      value: hasRealData ? fmtPct(avgCtr)           : isDemo ? '2.30%'  : '—',
      sub:   'Est. benchmark: >1.8%',
      icon: MousePointerClick, color: 'text-blue-500',
    },
    {
      label: 'Avg CPC',
      value: hasRealData ? (avgCpc > 0 ? fmtNGN(avgCpc) : 'N/A') : isDemo ? '₦127'   : '—',
      sub:   'Est. benchmark: <₦150',
      icon: MousePointerClick, color: 'text-violet-500',
    },
    {
      label: 'Avg CPM',
      value: hasRealData ? (avgCpm > 0 ? fmtNGN(avgCpm) : 'N/A') : isDemo ? '₦462'   : '—',
      sub:   'Est. benchmark: <₦1,000',
      icon: Eye,              color: 'text-teal-500',
    },
    {
      label: 'Avg CPA',
      value: hasRealData ? (avgCpa > 0 ? fmtNGN(avgCpa) : 'N/A') : isDemo ? '₦850'   : '—',
      sub:   'Cost per acquisition',
      icon: Target,           color: 'text-orange-500',
    },
    {
      label: 'Avg ROAS',
      value: hasRealData ? (avgRoas > 0 ? `${avgRoas.toFixed(1)}x` : 'N/A') : isDemo ? '3.4x' : '—',
      sub:   'Est. benchmark: >2.0x',
      icon: TrendingUp,       color: 'text-rose-500',
    },
  ]

  // ── 3-pillar framework ────────────────────────────────────────────────────

  const pillars = [
    {
      name:      'Awareness',
      dotColor:  'bg-blue-500',
      textColor: 'text-blue-500',
      metrics: [
        {
          label: 'CPM',
          value: hasRealData ? (avgCpm > 0 ? fmtNGN(avgCpm) : 'N/A') : isDemo ? '₦462'  : '—',
          bench: hasRealData && avgCpm > 0 ? benchCPM(avgCpm, bench) : null,
        },
        {
          label: 'Reach',
          value: hasRealData ? fmtNum(totalReach) : isDemo ? '2.8M' : '—',
          bench: null,
        },
        {
          label: 'Frequency',
          value: hasRealData ? (avgFrequency > 0 ? avgFrequency.toFixed(1) : 'N/A') : isDemo ? '1.5' : '—',
          bench: hasRealData && avgFrequency > 0 ? benchFreq(avgFrequency, bench) : null,
        },
      ],
    },
    {
      name:      'Consideration',
      dotColor:  'bg-violet-500',
      textColor: 'text-violet-500',
      metrics: [
        {
          label: 'CPC',
          value: hasRealData ? (avgCpc > 0 ? fmtNGN(avgCpc) : 'N/A') : isDemo ? '₦127'  : '—',
          bench: hasRealData && avgCpc > 0 ? benchCPC(avgCpc, bench) : null,
        },
        {
          label: 'CTR',
          value: hasRealData ? fmtPct(avgCtr) : isDemo ? '2.30%' : '—',
          bench: hasRealData && avgCtr > 0 ? benchCTR(avgCtr, bench) : null,
        },
        {
          label: 'Video View Rate',
          value: hasRealData ? (avgVVR > 0 ? `${(avgVVR * 100).toFixed(1)}%` : 'N/A') : isDemo ? '18.4%' : '—',
          bench: null,
        },
      ],
    },
    {
      name:      'Conversion',
      dotColor:  'bg-emerald-500',
      textColor: 'text-emerald-500',
      metrics: [
        {
          label: 'CPA',
          value: hasRealData ? (avgCpa > 0 ? fmtNGN(avgCpa) : 'N/A') : isDemo ? '₦850' : '—',
          bench: null,
        },
        {
          label: 'CVR',
          value: hasRealData ? (totalClicks > 0 ? `${cvr.toFixed(2)}%` : 'N/A') : isDemo ? '1.40%' : '—',
          bench: hasRealData && cvr > 0 ? benchCVR(cvr, bench) : null,
        },
        {
          label: 'ROAS',
          value: hasRealData ? (avgRoas > 0 ? `${avgRoas.toFixed(1)}x` : 'N/A') : isDemo ? '3.4x' : '—',
          bench: hasRealData && avgRoas > 0 ? benchROAS(avgRoas, bench) : null,
        },
      ],
    },
  ]

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl space-y-8" data-tour="digital-main">

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
        <div className="flex items-center gap-2 flex-wrap">
          <TourTrigger module="digital" autoStart />
          <DateRangeFilter currentDays={days} defaultDays={30} />
          <Link
            href="/dashboard/digital/drafts"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 text-xs')}
          >
            Ad Drafts
          </Link>
          <Link
            href="/dashboard/digital/create-ad"
            className={cn(buttonVariants({ size: 'sm' }), 'h-8 text-xs')}
          >
            Create Ad
          </Link>
        </div>
      </div>

      {/* Banners */}
      {connected && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 dark:border-green-800/40 dark:bg-green-950/30 px-4 py-3">
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-300 capitalize">
            {connected} Ads connected. Data will appear after tonight&apos;s sync at 5 AM Lagos time.
          </p>
        </div>
      )}

      {setupNeeded && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-950/30 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 shrink-0" />
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300 capitalize">
              {setupNeeded} Ads: environment variables needed
            </p>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-400 ml-6">
            Add{' '}
            <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">
              {setupNeeded === 'google'
                ? 'GOOGLE_ADS_CLIENT_ID + GOOGLE_ADS_CLIENT_SECRET'
                : setupNeeded === 'tiktok'
                  ? 'TIKTOK_ADS_APP_ID + TIKTOK_ADS_SECRET'
                  : setupNeeded === 'linkedin'
                    ? 'LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET'
                    : `${setupNeeded.toUpperCase()}_CLIENT_ID`}
            </code>{' '}
            to your Vercel environment variables, then redeploy.
          </p>
        </div>
      )}

      {oauthError === 'oauth_cancelled' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/30 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Meta Ads: Redirect URI not whitelisted
            </p>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            In your <strong>Meta for Developers</strong> app, go to{' '}
            <strong>Facebook Login → Settings</strong> and add this exact URL to{' '}
            <strong>Valid OAuth Redirect URIs</strong>:
          </p>
          <code className="block text-xs bg-amber-100 dark:bg-amber-900/40 px-3 py-1.5 rounded font-mono">
            {process.env.APP_URL ?? 'https://brandpulse-ai-tau.vercel.app'}/api/ads/meta/callback
          </code>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Also ensure your app has <strong>Marketing API</strong> enabled and that{' '}
            <strong>Client OAuth Login</strong> and <strong>Web OAuth Login</strong> are both on.
          </p>
        </div>
      )}

      {isDemo && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/30 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            You are viewing demo data for Jara Foods. Connect a real ad account below to see your actual performance.
          </p>
        </div>
      )}

      {/* Platform connection cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

      {/* Core KPI grid */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold">Core Metrics</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map(m => (
            <Card key={m.label} className="border rounded-xl p-4 bg-card space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                  {m.label}
                </span>
                <m.icon className={`h-3.5 w-3.5 ${m.color}`} />
              </div>
              <p className="text-xl font-bold tracking-tight">{m.value}</p>
              <p className="text-[10px] text-muted-foreground">{m.sub}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Campaign Breakdown — main new section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Campaigns</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click any campaign to see objective-specific metrics and set performance targets
            </p>
          </div>
        </div>

        {campaignSummaries.length > 0 ? (
          <Card className="border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    {['Campaign', 'Platform', 'Objective', 'Spend', 'ROAS', 'CPA', 'CTR', 'Conversions', ''].map(h => (
                      <th
                        key={h}
                        className="text-left py-3 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaignSummaries.map(c => (
                    <tr key={c.campaign_id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <Link
                          href={`/dashboard/digital/campaigns/${encodeURIComponent(c.campaign_id)}`}
                          className="font-medium hover:text-indigo-500 transition-colors line-clamp-1 max-w-[180px]"
                        >
                          {c.campaign_name}
                        </Link>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge variant="secondary" className="text-[10px]">{platformLabel(c.platform)}</Badge>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-muted-foreground">
                        {objectiveLabel(c.objective)}
                      </td>
                      <td className="py-3 px-4 font-medium whitespace-nowrap">{fmtNGN(c.spend)}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {c.avgRoas > 0 ? (
                          <span className={benchROAS(c.avgRoas, bench).cls}>{c.avgRoas.toFixed(1)}x</span>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                        {c.avgCpa > 0 ? fmtNGN(c.avgCpa) : '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {c.avgCtr > 0 ? (
                          <span className={benchCTR(c.avgCtr, bench).cls}>{fmtPct(c.avgCtr)}</span>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">{c.conversions > 0 ? fmtNum(c.conversions) : '—'}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Link
                          href={`/dashboard/digital/campaigns/${encodeURIComponent(c.campaign_id)}`}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          View <ChevronRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card className="border rounded-xl p-8 text-center space-y-2">
            <p className="text-sm text-muted-foreground">No campaign data in this period.</p>
            <p className="text-xs text-muted-foreground">Connect an ad account above to see per-campaign breakdowns.</p>
          </Card>
        )}
      </div>

      {/* 3-Pillar Performance Framework */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Performance Framework</h2>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
            Three-tier view across all campaigns
            <span className="inline-block px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">Estimated</span>
            <span>Benchmarks are directional West African market estimates, not sourced data.</span>
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {pillars.map(pillar => (
            <Card key={pillar.name} className="border rounded-xl p-5 bg-card space-y-4">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full shrink-0 ${pillar.dotColor}`} />
                <span className={`text-[10px] font-bold uppercase tracking-widest ${pillar.textColor}`}>
                  {pillar.name}
                </span>
              </div>
              <div className="space-y-3 divide-y divide-border/40">
                {pillar.metrics.map((m, i) => (
                  <div key={m.label} className={i > 0 ? 'pt-3' : ''}>
                    <MetricRow label={m.label} value={m.value} bench={m.bench} />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Conversion Funnel */}
      <Card className="border rounded-xl p-5 bg-card space-y-4">
        <div>
          <h2 className="text-base font-semibold">Conversion Funnel</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Impressions to conversions cascade across all campaigns
            {isDemo ? ' · Demo data' : ''}
          </p>
        </div>
        <ConversionFunnelChart data={funnelData} demo={isDemo} />
      </Card>

      {/* Creative Fatigue Monitor */}
      <Card className="border rounded-xl p-5 bg-card space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Creative Fatigue Monitor</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Average ad frequency per platform. Above 7 signals audience fatigue and rising CPMs
              {isDemo ? ' · Demo data' : ''}
            </p>
          </div>
          <Link
            href="/dashboard/creative-fatigue"
            className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'shrink-0 text-xs')}
          >
            Full analysis →
          </Link>
        </div>
        <FrequencyBarChart
          data={frequencyChartData.length > 0 ? frequencyChartData : undefined}
          demo={isDemo}
        />
      </Card>

      {/* Platform Breakdown Table */}
      {platformSummaries.length > 0 && (
        <Card className="border rounded-xl p-5 bg-card space-y-4">
          <h2 className="text-base font-semibold">Platform Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  {['Platform', 'Spend', 'ROAS', 'CPA', 'CTR', 'CVR', 'Conversions'].map(h => (
                    <th
                      key={h}
                      className="text-left pb-2.5 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                    >
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
                    <td className="py-3 pr-4">
                      {p.avgRoas > 0 ? (
                        <span className={benchROAS(p.avgRoas, bench).cls}>{p.avgRoas.toFixed(1)}x</span>
                      ) : '—'}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {p.avgCpa > 0 ? fmtNGN(p.avgCpa) : '—'}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={benchCTR(p.avgCtr, bench).cls}>{fmtPct(p.avgCtr)}</span>
                    </td>
                    <td className="py-3 pr-4">
                      {p.cvr > 0 ? (
                        <span className={benchCVR(p.cvr, bench).cls}>{p.cvr.toFixed(2)}%</span>
                      ) : '—'}
                    </td>
                    <td className="py-3">{p.conversions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Spend vs Impressions Chart */}
      <Card className="border rounded-xl p-5 bg-card space-y-3">
        <div>
          <h2 className="text-base font-semibold">Spend vs Impressions ({days} Days)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Weekly ad spend correlated with impression delivery
            {isDemo ? ' · Demo data' : ''}
          </p>
        </div>
        <DigitalSpendChart
          data={spendChartData.length > 0 ? spendChartData : undefined}
          demo={isDemo}
        />
      </Card>

    </div>
  )
}
