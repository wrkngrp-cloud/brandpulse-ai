import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { Suspense } from 'react'
import { computeFullBHI, type BHIResult } from '@/lib/bhi'
import { OverviewClient } from '@/components/dashboard/overview-client'
import { getActiveBrandId } from '@/lib/active-brand'

const NGN_CPM_BENCHMARK = 500
const NGN_CPE_BENCHMARK = 50
const EMV_SCALE_MAX     = 10_000_000

async function DashboardContent({ days }: { days: number }) {
  const supabase = await createClient()

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  const cutoffISO = cutoff.toISOString()

  const brandId = await getActiveBrandId(supabase)

  const [
    { data: brand },
    { data: sentimentRow },
    { data: sovRow },
    { data: allSurveyResponses },
    { data: bhiHistory },
    { data: recentMentions },
    { count: mentionCount7d },
    { data: activeCampaigns },
    { data: upcomingEvents },
    { data: sentimentTrendRaw },
    { data: socialPosts },
    { data: awarenessCheckSurveys },
    { data: perceptionSurveys },
  ] = await Promise.all([
    brandId
      ? supabase.from('brands').select('id, name, category').eq('id', brandId).single()
      : supabase.from('brands').select('id, name, category').limit(1).single(),
    supabase.from('sentiment_daily').select('social_score, day, positive_pct, negative_pct').eq('brand_id', brandId ?? '').order('day', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('sov_snapshots').select('social_sov, snapshot_date').eq('brand_id', brandId ?? '').order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('survey_responses').select('answers, survey_id, quality_flag').eq('quality_flag', 'ok'),
    supabase.from('brand_health_snapshots').select('bhi, snapshot_date').eq('brand_id', brandId ?? '').order('snapshot_date', { ascending: false }).limit(days),
    supabase.from('mentions').select('id, content, author_handle, platform, sentiment_label, created_at').eq('brand_id', brandId ?? '').order('created_at', { ascending: false }).limit(4),
    supabase.from('mentions').select('id', { count: 'exact', head: true }).eq('brand_id', brandId ?? '').gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('campaigns').select('id, name, status, objectives, start_date, total_budget, currency').eq('brand_id', brandId ?? '').in('status', ['active', 'paused']).order('created_at', { ascending: false }).limit(3),
    supabase.from('events').select('id, name, status, city, date_start, event_type').eq('brand_id', brandId ?? '').in('status', ['planned', 'live']).order('date_start', { ascending: true }).limit(3),
    supabase.from('sentiment_daily').select('social_score, day').eq('brand_id', brandId ?? '').gte('day', cutoffStr).order('day', { ascending: true }),
    supabase.from('social_posts').select('impressions, reach, likes, comments, shares').eq('brand_id', brandId ?? '').gte('posted_at', cutoffISO),
    supabase.from('surveys').select('id').eq('brand_id', brandId ?? '').in('type', ['awareness_check', 'b2_intercept']),
    supabase.from('surveys').select('id').eq('brand_id', brandId ?? '').eq('type', 'perception_audit'),
  ])

  // ── Sentiment score ──────────────────────────────────────────────────────
  const sentimentScore = sentimentRow?.social_score ?? null
  const sovScore       = sovRow?.social_sov ?? null

  // ── Salience (aided awareness %) from awareness_check / b2_intercept surveys
  // Reads q1 specifically — the "Have you heard of [brand]?" question.
  const awarenessIds = new Set((awarenessCheckSurveys ?? []).map(s => s.id))
  const awarenessResponses = (allSurveyResponses ?? []).filter(r => awarenessIds.has(r.survey_id))
  let salienceScore: number | null = null
  if (awarenessResponses.length >= 3) {
    const knownCount = awarenessResponses.filter(r => {
      const a = r.answers as Record<string, unknown>
      const q1 = a['q1']
      return typeof q1 === 'string' && q1.toLowerCase().startsWith('yes')
    }).length
    salienceScore = Math.round((knownCount / awarenessResponses.length) * 100)
  }

  // ── Perception from perception audit surveys ──────────────────────────────
  const perceptionIds = new Set((perceptionSurveys ?? []).map(s => s.id))
  const perceptionResponses = (allSurveyResponses ?? []).filter(r => perceptionIds.has(r.survey_id))
  let perceptionScore: number | null = null
  if (perceptionResponses.length >= 2) {
    const vals: number[] = []
    for (const r of perceptionResponses) {
      const a = r.answers as Record<string, unknown>
      for (const k of ['q2','q3','q4','q5','q6','q7','q8','q9']) {
        const v = a[k]
        if (typeof v === 'number' && v >= 1 && v <= 5) vals.push((v / 5) * 100)
      }
    }
    if (vals.length > 0) perceptionScore = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
  }

  // ── EMV from social posts ─────────────────────────────────────────────────
  const posts = socialPosts ?? []
  let emvScore: number | null = null
  if (posts.length > 0) {
    const imp = posts.reduce((s, p) => s + (p.impressions ?? 0), 0)
    const rch = posts.reduce((s, p) => s + (p.reach ?? 0), 0)
    const eng = posts.reduce((s, p) => s + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0), 0)
    const emvRaw = ((imp + rch) * (NGN_CPM_BENCHMARK / 1000)) + (eng * NGN_CPE_BENCHMARK)
    emvScore = Math.min(Math.round((emvRaw / EMV_SCALE_MAX) * 100), 100)
  }

  // ── Full 7-component BHI (same formula as Brand Equity page) ─────────────
  const fullBhi = computeFullBHI({
    awareness:         sovScore,
    salience:          salienceScore,
    sentiment:         sentimentScore,
    perception:        perceptionScore,
    culturalResonance: null,
    blendedSov:        sovScore,
    emv:               emvScore,
  })

  // Map to BHIResult shape for gauge (show 3 most readable components)
  const bhi: BHIResult = {
    score:    fullBhi.score,
    coverage: fullBhi.coverage,
    zone:     fullBhi.zone,
    components: {
      sentiment: fullBhi.components.sentiment,
      sov:       fullBhi.components.awareness,
      survey:    fullBhi.components.perception ?? fullBhi.components.salience,
    },
  }

  const sparkline = [...(bhiHistory ?? [])]
    .reverse()
    .map(r => ({ date: r.snapshot_date, score: Number(r.bhi) }))

  const bhiByDate = new Map(sparkline.map(r => [r.date, r.score]))
  const sentimentByDate = new Map((sentimentTrendRaw ?? []).map(r => [r.day, r.social_score]))
  const allDates = [...new Set([...bhiByDate.keys(), ...sentimentByDate.keys()])].sort()
  const trendData = allDates.map(date => ({
    date,
    bhi:       bhiByDate.get(date) ?? null,
    sentiment: sentimentByDate.get(date) ?? null,
  }))

  const hasAnyData = sentimentScore !== null || sovScore !== null

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
      mentionCount7d={mentionCount7d ?? 0}
      hasAnyData={hasAnyData}
      trendData={trendData}
      days={days}
    />
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const days = Math.min(365, Math.max(7, Number(params.days ?? 30)))

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
      <DashboardContent days={days} />
    </Suspense>
  )
}
