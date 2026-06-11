import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { ContentTableClient } from './content-table-client'
import { SovWidgetClient } from './sov-widget-client'
import { SocialConnectCard } from '@/components/dashboard/social-connect-card'
import { ContentTableSkeleton } from '@/components/dashboard/content-table'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

async function ContentData() {
  const supabase = await createClient()

  const [{ data: posts }, { data: connections }, { data: competitors }, { data: sovSnap }] =
    await Promise.all([
      supabase
        .from('social_posts')
        .select('id,platform,content,content_type,reach,impressions,likes,comments,shares,engagement_rate,funnel_stage,ai_performance_score,posted_at')
        .order('posted_at', { ascending: false })
        .limit(200),
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
    ])

  const sovData = {
    brand_mentions: 0,
    competitor_mentions: {} as Record<string, number>,
    sov_pct: sovSnap?.social_sov ?? null,
  }

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

      {/* Content Performance table */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Content Performance</h2>
          <p className="text-sm text-muted-foreground">
            Last 7 days · syncs nightly at 3 AM Lagos time
          </p>
        </div>
        <ContentTableClient posts={posts ?? []} />
      </div>
    </div>
  )
}

const OAUTH_ERRORS: Record<string, { title: string; steps: string[] }> = {
  no_facebook_page: {
    title: 'Instagram needs a Facebook Page as a bridge',
    steps: [
      'Go to facebook.com and create a free Page for your brand (takes about 2 minutes).',
      'In the Instagram app, go to Settings > Account > Switch to Professional Account and choose Business or Creator.',
      'Then go to Settings > Business > Connect to Facebook, and link that Page.',
      'Come back here and click Connect on Instagram again.',
    ],
  },
  no_ig_business_account: {
    title: 'No Instagram Business account found on your Facebook Page',
    steps: [
      'Open the Instagram app and go to Settings > Account > Switch to Professional Account.',
      'Choose Business or Creator (either works).',
      'Go to Settings > Business > Connect to Facebook and link your Facebook Page.',
      'Come back here and click Connect on Instagram again.',
    ],
  },
}

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const oauthError = params.error
  const connected = params.connected
  const errorInfo = oauthError ? OAUTH_ERRORS[oauthError] : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Owned Performance</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your content, reach, and share of voice</p>
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
        <ContentData />
      </Suspense>
    </div>
  )
}
