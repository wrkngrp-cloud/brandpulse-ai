import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { ContentTableClient } from './content-table-client'
import { SovWidgetClient } from './sov-widget-client'
import { SocialConnectCard } from '@/components/dashboard/social-connect-card'
import { ContentTableSkeleton } from '@/components/dashboard/content-table'
import { Skeleton } from '@/components/ui/skeleton'

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

export default function ContentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Owned Performance</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your content, reach, and share of voice</p>
      </div>
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
