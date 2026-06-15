import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { ContentTableClient } from './content-table-client'
import { SovWidgetClient } from './sov-widget-client'
import { SocialConnectCard } from '@/components/dashboard/social-connect-card'
import { InstagramPageIdForm } from '@/components/dashboard/instagram-page-id-form'
import { ContentTableSkeleton } from '@/components/dashboard/content-table'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { FunnelChart } from './funnel-chart'
import { SovHistoryChart } from '@/components/dashboard/sov-history-chart'
import { DateRangeFilter } from '@/components/dashboard/date-range-filter'
import { rangeLabelLong } from '@/lib/range-label'

async function ContentData({ days }: { days: number }) {
  const supabase = await createClient()

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString()

  const [{ data: posts }, { data: connections }, { data: competitors }, { data: sovSnap }, { data: sovHistory }] =
    await Promise.all([
      supabase
        .from('social_posts')
        .select('id,platform,content,content_type,reach,impressions,likes,comments,shares,engagement_rate,funnel_stage,ai_performance_score,posted_at')
        .gte('posted_at', cutoffStr)
        .order('posted_at', { ascending: false })
        .limit(500),
      supabase
        .from('social_connections')
        .select('platform,account_name,sync_status,last_synced_at'),
      supabase
        .from('competitors')
        .select('id,name'),
      supabase
        .from('sov_snapshots')
        .select('social_sov,competitor_data')
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('sov_snapshots')
        .select('snapshot_date,social_sov')
        .order('snapshot_date', { ascending: true })
        .limit(60),
    ])

  const competitorData = sovSnap?.competitor_data as {
    brand_volume?:       number
    competitor_volumes?: Record<string, number>
  } | null

  const sovData = {
    brand_mentions:     competitorData?.brand_volume       ?? 0,
    competitor_mentions: competitorData?.competitor_volumes ?? {},
    sov_pct:            sovSnap?.social_sov                ?? null,
  }

  const sovHistoryPoints = (sovHistory ?? [])
    .filter(s => s.social_sov != null)
    .map(s => ({ date: s.snapshot_date as string, sov_pct: s.social_sov as number }))

  return (
    <div className="space-y-6">
      {/* Top row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SocialConnectCard connections={connections ?? []} />
        </div>
        <SovWidgetClient
          sov={sovData}
          competitors={competitors ?? []}
        />
      </div>

      {/* SOV history chart */}
      {sovHistoryPoints.length >= 2 && (
        <SovHistoryChart data={sovHistoryPoints} />
      )}

      {/* Funnel breakdown charts */}
      {(posts ?? []).some(p => p.funnel_stage) && (() => {
        const stagePosts = (posts ?? []).filter(p => p.funnel_stage)
        const byStage: Record<string, { count: number; engagements: number[]; reaches: number[] }> = {}
        for (const p of stagePosts) {
          const s = p.funnel_stage!
          if (!byStage[s]) byStage[s] = { count: 0, engagements: [], reaches: [] }
          byStage[s].count++
          if (p.engagement_rate) byStage[s].engagements.push(Number(p.engagement_rate))
          if (p.reach) byStage[s].reaches.push(Number(p.reach))
        }
        const funnelOrder = ['Awareness', 'Consideration', 'Conversion', 'Loyalty', 'Re-engagement']
        const funnelData = funnelOrder
          .filter(s => byStage[s])
          .map(s => ({
            stage:          s,
            posts:          byStage[s].count,
            avg_engagement: byStage[s].engagements.length
              ? byStage[s].engagements.reduce((a, b) => a + b, 0) / byStage[s].engagements.length
              : 0,
            avg_reach: byStage[s].reaches.length
              ? byStage[s].reaches.reduce((a, b) => a + b, 0) / byStage[s].reaches.length
              : 0,
          }))
        return funnelData.length > 0 ? (
          <div className="border rounded-xl p-5 bg-card space-y-3">
            <h2 className="text-sm font-medium">Content by funnel stage</h2>
            <FunnelChart data={funnelData} />
          </div>
        ) : null
      })()}

      {/* Content Performance table */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Content Performance</h2>
          <p className="text-sm text-muted-foreground">
            {rangeLabelLong(days).charAt(0).toUpperCase() + rangeLabelLong(days).slice(1)} · syncs nightly at 3 AM Lagos time
          </p>
        </div>
        <ContentTableClient posts={posts ?? []} />
      </div>
    </div>
  )
}

function getOAuthError(error: string | undefined, reason: string | undefined, page: string | undefined): { title: string; steps: string[] } | null {
  if (!error) return null

  if (error === 'no_facebook_page') {
    if (reason === 'no_pages_returned') {
      return {
        title: 'Facebook did not share your Page with this app',
        steps: [
          'Click Connect on Instagram again.',
          'During the Facebook login dialog, look for a step that says "What Sweetness Studios (or your page name) can do" — there will be a Pages section.',
          'Make sure your page is listed and toggled on before clicking Continue.',
          'If you do not see that step, click "Edit access" on the permissions screen to expand it.',
        ],
      }
    }
    if (reason?.startsWith('missing_scopes')) {
      return {
        title: 'Instagram needs a Facebook Page as a bridge',
        steps: [
          'Go to facebook.com and create a free Page for your brand (takes about 2 minutes).',
          'In the Instagram app, go to Settings > Account > Switch to Professional Account and choose Business or Creator.',
          'Go to Settings > Business > Connect to Facebook, and link that Page.',
          'Come back here and click Connect on Instagram again.',
        ],
      }
    }
    return {
      title: 'Instagram needs a Facebook Page as a bridge',
      steps: [
        'Go to facebook.com and create a free Page for your brand (takes about 2 minutes).',
        'In the Instagram app, go to Settings > Account > Switch to Professional Account and choose Business or Creator.',
        'Go to Settings > Business > Connect to Facebook, and link that Page.',
        'Come back here and click Connect on Instagram again.',
      ],
    }
  }

  if (error === 'no_ig_business_account') {
    const pageName = page ?? 'your Facebook Page'
    return {
      title: `Found "${pageName}" but no linked Instagram Business account`,
      steps: [
        'Open the Instagram app and go to Settings > Account > Switch to Professional Account.',
        'Choose Business or Creator (either works).',
        `Go to Settings > Business > Connect to Facebook and link "${pageName}".`,
        'Come back here and click Connect on Instagram again.',
      ],
    }
  }

  return null
}

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const days = Math.min(180, Math.max(7, Number(params.days ?? 30)))
  const oauthError = params.error
  const connected = params.connected
  const needsPageId = params.action === 'needs-page-id' ? params.key : null
  const errorInfo = getOAuthError(oauthError, params.reason, params.page)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Owned Performance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your content, reach, and share of voice</p>
        </div>
        <DateRangeFilter currentDays={days} defaultDays={30} />
      </div>

      {/* Success banner */}
      {connected && (
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900 p-4">
          <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-300 capitalize">
            {connected} connected. Data will appear after tonight&apos;s sync at 3 AM Lagos time.
          </p>
        </div>
      )}

      {/* Instagram NPE page-id form */}
      {needsPageId && <InstagramPageIdForm pendingKey={needsPageId} />}

      {/* OAuth error banner with setup steps */}
      {errorInfo && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{errorInfo.title}</p>
          </div>
          <ol className="ml-7 space-y-1.5 list-decimal list-outside">
            {errorInfo.steps.map((step, i) => (
              <li key={i} className="text-sm text-amber-700 dark:text-amber-400">{step}</li>
            ))}
          </ol>
        </div>
      )}

      <Suspense fallback={
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Skeleton className="lg:col-span-2 h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
          <ContentTableSkeleton />
        </div>
      }>
        <ContentData days={days} />
      </Suspense>
    </div>
  )
}
