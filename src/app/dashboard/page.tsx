import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { Suspense } from 'react'
import { computeBHI } from '@/lib/bhi'
import { OverviewClient } from '@/components/dashboard/overview-client'

async function DashboardContent() {
  const supabase = await createClient()

  const [
    { data: brand },
    { data: sentimentRow },
    { data: sovRow },
    { data: surveyResponses },
    { data: bhiHistory },
    { data: recentMentions },
    { data: activeCampaigns },
    { data: upcomingEvents },
    { data: sentimentTrendRaw },
  ] = await Promise.all([
    supabase.from('brands').select('id, name, category').limit(1).single(),
    supabase.from('sentiment_daily').select('social_score, day, positive_pct, negative_pct').order('day', { ascending: false }).limit(1).single(),
    supabase.from('sov_snapshots').select('social_sov, snapshot_date').order('snapshot_date', { ascending: false }).limit(1).single(),
    supabase.from('survey_responses').select('answers, quality_flag').eq('quality_flag', 'ok'),
    supabase.from('brand_health_snapshots').select('bhi, snapshot_date').order('snapshot_date', { ascending: false }).limit(30),
    supabase.from('mentions').select('id, content, author_handle, platform, sentiment_label, created_at').order('created_at', { ascending: false }).limit(4),
    supabase.from('campaigns').select('id, name, status, objectives, start_date, total_budget, currency').in('status', ['active', 'paused']).order('created_at', { ascending: false }).limit(3),
    supabase.from('events').select('id, name, status, city, date_start, event_type').in('status', ['planned', 'live']).order('date_start', { ascending: true }).limit(3),
    supabase.from('sentiment_daily').select('social_score, day').order('day', { ascending: true }).limit(30),
  ])

  const npsScores = (surveyResponses ?? [])
    .map(r => (r.answers as Record<string, unknown>)?.q2 as number | undefined)
    .filter((s): s is number => typeof s === 'number' && s >= 0 && s <= 10)
  const avgNps = npsScores.length ? npsScores.reduce((a, b) => a + b, 0) / npsScores.length : null
  const surveyScore = avgNps !== null ? avgNps * 10 : null

  const sentimentScore = sentimentRow?.social_score ?? null
  const sovScore       = sovRow?.social_sov ?? null
  const bhi = computeBHI({ sentimentScore, sovScore, surveyScore })

  const sparkline = [...(bhiHistory ?? [])]
    .reverse()
    .map(r => ({ date: r.snapshot_date, score: Number(r.bhi) }))

  // Build merged trend data: align BHI and Sentiment by date
  const bhiByDate = new Map(sparkline.map(r => [r.date, r.score]))
  const sentimentByDate = new Map((sentimentTrendRaw ?? []).map(r => [r.day, r.social_score]))
  const allDates = [...new Set([...bhiByDate.keys(), ...sentimentByDate.keys()])].sort()
  const trendData = allDates.map(date => ({
    date,
    bhi:       bhiByDate.get(date) ?? null,
    sentiment: sentimentByDate.get(date) ?? null,
  }))

  const hasAnyData = sentimentScore !== null || sovScore !== null || surveyScore !== null

  return (
    <OverviewClient
      brandName={brand?.name ?? 'Your brand'}
      category={brand?.category ?? null}
      bhi={bhi}
      sparkline={sparkline}
      sentiment={sentimentRow ?? null}
      sovScore={sovScore}
      sovDate={sovRow?.snapshot_date ?? null}
      activeCampaigns={(activeCampaigns ?? []).map(c => ({
        ...c,
        objectives: c.objectives as string[] | null,
      }))}
      upcomingEvents={upcomingEvents ?? []}
      recentMentions={recentMentions ?? []}
      hasAnyData={hasAnyData}
      trendData={trendData}
    />
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-8 w-40 hidden sm:block" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-72 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
