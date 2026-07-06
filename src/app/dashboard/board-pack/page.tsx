import { createClient }   from '@/lib/supabase/server'
import { redirect }        from 'next/navigation'
import { getActiveBrand }  from '@/lib/active-brand'
import { computeLiveBHI }  from '@/lib/live-bhi'
import { BoardPackClient } from './board-pack-client'

export const dynamic = 'force-dynamic'

export default async function BoardPackPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const brand = await getActiveBrand<{
    id:       string
    name:     string
    category: string | null
  }>(supabase, 'id, name, category')
  if (!brand) redirect('/onboarding')

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  // ── Core queries ──────────────────────────────────────────────────────────
  const [
    liveBhi,
    { data: latestSentiment },
    { data: latestSov },
    { data: campaigns },
    { data: recentEvents },
  ] = await Promise.all([
    computeLiveBHI(supabase, brand.id),

    supabase
      .from('sentiment_daily')
      .select('social_score, day')
      .eq('brand_id', brand.id)
      .order('day', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('sov_snapshots')
      .select('social_sov, snapshot_date')
      .eq('brand_id', brand.id)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('campaigns')
      .select('id, name, status, total_budget')
      .eq('brand_id', brand.id)
      .in('status', ['active', 'paused']),

    supabase
      .from('events')
      .select('id, name, status, expected_attendance')
      .eq('brand_id', brand.id)
      .in('status', ['live', 'closed', 'reported'])
      .gte('date_start', ninetyDaysAgo),
  ])

  // ── NPS from nps_records ──────────────────────────────────────────────────
  const { data: npsRows } = await supabase
    .from('nps_records')
    .select('score')
    .eq('brand_id', brand.id)
    .not('score', 'is', null)
    .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())

  // ── Ambassador interactions (event sub-query) ─────────────────────────────
  const eventIds = (recentEvents ?? []).map(e => e.id)
  let ambassadorInteractions = 0
  if (eventIds.length > 0) {
    const { count } = await supabase
      .from('event_interactions')
      .select('id', { count: 'exact', head: true })
      .in('event_id', eventIds)
    ambassadorInteractions = count ?? 0
  }

  // ── metric_manual (may not exist yet) ─────────────────────────────────────
  let manualMetrics: { metric_name: string; value: number; unit: string | null }[] = []
  try {
    const { data } = await supabase
      .from('metric_manual')
      .select('metric_name, value, unit')
      .eq('brand_id', brand.id)
      .order('recorded_at', { ascending: false })
      .limit(20)
    manualMetrics = (data ?? []) as typeof manualMetrics
  } catch {
    // Table not yet created -- skip gracefully
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const bhi       = liveBhi.score
  const sentiment = latestSentiment?.social_score != null ? Number(latestSentiment.social_score) : null
  const sov       = latestSov?.social_sov         != null ? Number(latestSov.social_sov)         : null

  const activeCampaigns = (campaigns ?? []).filter(c => c.status === 'active')
  const allCampaigns    = campaigns ?? []
  const totalBudget     = allCampaigns.reduce((s, c) => s + (c.total_budget ?? 0), 0)
  const topCampaign     = activeCampaigns[0]?.name ?? allCampaigns[0]?.name ?? null

  const npsScores = (npsRows ?? []).map(r => r.score ?? 0)
  const avgNps    = npsScores.length > 0
    ? Math.round(npsScores.reduce((a, b) => a + b, 0) / npsScores.length)
    : null

  return (
    <BoardPackClient
      brand={{ name: brand.name, category: brand.category }}
      bhi={bhi}
      sentiment={sentiment}
      sov={sov}
      activeCampaignCount={activeCampaigns.length}
      allCampaignCount={allCampaigns.length}
      totalBudget={totalBudget}
      topCampaign={topCampaign}
      recentEventCount={(recentEvents ?? []).length}
      ambassadorInteractions={ambassadorInteractions}
      avgNps={avgNps}
      manualMetrics={manualMetrics}
    />
  )
}
