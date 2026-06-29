import { createClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { redirect }     from 'next/navigation'
import Link             from 'next/link'
import { ArrowLeft }    from 'lucide-react'
import { NpsClient, type WeeklyNps, type NpsCohort } from './nps-client'

const ROLE_LABEL: Record<string, string> = {
  consumer:      'Consumers',
  trade_partner: 'Trade partners',
  retailer:      'Retailers',
  developer:     'Developers',
  decision_maker:'Decision makers',
  end_user:      'End users',
}

export const dynamic = 'force-dynamic'

function isoWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() - day + 1)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function weekLabel(date: Date): string {
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export default async function NpsTrackerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const twelveWeeksAgo = new Date()
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84)

  const bid = await getActiveBrandId(supabase)

  const [{ data: responses }, { data: brand }, { data: npsRoleRecords }] = await Promise.all([
    supabase
      .from('survey_responses')
      .select('answers, collected_at')
      .eq('quality_flag', 'ok')
      .gte('collected_at', twelveWeeksAgo.toISOString()),
    supabase
      .from('brands')
      .select('name, category')
      .limit(1)
      .maybeSingle(),
    bid
      ? supabase
          .from('nps_records')
          .select('score, respondent_role')
          .eq('brand_id', bid)
      : Promise.resolve({ data: [] as { score: number | null; respondent_role: string | null }[] }),
  ])

  // ── NPS cohort split by respondent_role (scaffold). Shown only when records
  // span 2+ roles — otherwise the headline NPS already covers consumers.
  const cohortBuckets: Record<string, { promoters: number; detractors: number; total: number }> = {}
  for (const r of npsRoleRecords ?? []) {
    const score = r.score
    if (typeof score !== 'number') continue
    const role = (r.respondent_role as string | null) ?? 'consumer'
    const b = cohortBuckets[role] ?? { promoters: 0, detractors: 0, total: 0 }
    b.total++
    if (score >= 9) b.promoters++
    else if (score <= 6) b.detractors++
    cohortBuckets[role] = b
  }
  const cohorts: NpsCohort[] = Object.entries(cohortBuckets)
    .map(([role, b]) => ({
      role,
      label:     ROLE_LABEL[role] ?? role,
      total:     b.total,
      nps:       b.total >= 3 ? Math.round(((b.promoters - b.detractors) / b.total) * 100) : null,
      promoters: b.promoters,
      detractors:b.detractors,
    }))
    .sort((a, b) => b.total - a.total)
  const showCohorts = cohorts.length >= 2

  const NPS_SECTOR_MAP: Record<string, string> = {
    'fmcg':'FMCG','consumer goods':'FMCG','fintech':'Fintech','financial services':'Fintech',
    'banking':'Fintech','telecommunications':'Telecommunications','telecom':'Telecommunications',
    'entertainment':'Entertainment','media':'Entertainment','e-commerce':'E-commerce',
    'retail':'E-commerce','fashion':'Fashion','lifestyle':'Fashion','food & beverage':'Food & Beverage',
    'food':'Food & Beverage','healthcare':'Healthcare','technology':'Technology','tech':'Technology',
    'real estate':'Real Estate',
  }
  const npsSector = NPS_SECTOR_MAP[(brand?.category ?? '').toLowerCase().trim()] ?? 'FMCG'
  const { data: npsBenchmarkRow } = await supabase
    .from('sector_benchmarks')
    .select('p50')
    .eq('sector', npsSector)
    .eq('metric', 'nps')
    .maybeSingle()
  const npsBenchmarkP50 = (npsBenchmarkRow as { p50: number } | null)?.p50 ?? null

  // ── Extract NPS scores and any open-text answers from each response
  interface NpsRow {
    score:      number
    collectedAt: Date
    textAnswers: string[]
  }

  const npsRows: NpsRow[] = []

  for (const r of responses ?? []) {
    const answers = r.answers as Record<string, unknown>
    let npsScore: number | null = null
    const textAnswers: string[] = []

    for (const val of Object.values(answers)) {
      if (typeof val === 'number' && Number.isInteger(val) && val >= 0 && val <= 10) {
        npsScore = val
      }
      if (typeof val === 'string' && val.length > 5) {
        textAnswers.push(val)
      }
    }

    if (npsScore != null) {
      npsRows.push({
        score:       npsScore,
        collectedAt: new Date(r.collected_at as string),
        textAnswers,
      })
    }
  }

  // ── Build 12-week buckets
  const now = new Date()
  const weekBuckets: WeeklyNps[] = []

  for (let w = 11; w >= 0; w--) {
    const weekStart = isoWeekStart(new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000))
    const weekEnd   = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

    const weekRows = npsRows.filter(r => r.collectedAt >= weekStart && r.collectedAt < weekEnd)
    const promoters  = weekRows.filter(r => r.score >= 9).length
    const passives   = weekRows.filter(r => r.score >= 7 && r.score <= 8).length
    const detractors = weekRows.filter(r => r.score <= 6).length
    const total      = weekRows.length

    weekBuckets.push({
      weekLabel:  weekLabel(weekStart),
      nps:        total >= 3
        ? Math.round(((promoters - detractors) / total) * 100)
        : null,
      promoters,
      passives,
      detractors,
      total,
    })
  }

  // ── Aggregate totals
  const totalPromoters  = npsRows.filter(r => r.score >= 9).length
  const totalPassives   = npsRows.filter(r => r.score >= 7 && r.score <= 8).length
  const totalDetractors = npsRows.filter(r => r.score <= 6).length
  const totalResponses  = npsRows.length

  const currentNps = totalResponses >= 3
    ? Math.round(((totalPromoters - totalDetractors) / totalResponses) * 100)
    : null

  // ── Trend direction: compare last 4 weeks vs prior 4 weeks
  const recentAvg = weekBuckets.slice(8)
    .filter(w => w.nps != null).map(w => w.nps as number)
  const priorAvg  = weekBuckets.slice(4, 8)
    .filter(w => w.nps != null).map(w => w.nps as number)

  const recentMean = recentAvg.length
    ? recentAvg.reduce((s, v) => s + v, 0) / recentAvg.length : null
  const priorMean  = priorAvg.length
    ? priorAvg.reduce((s, v) => s + v, 0) / priorAvg.length  : null

  const trendDirection =
    recentMean == null || priorMean == null ? 'insufficient_data' :
    recentMean - priorMean > 5              ? 'rising'             :
    priorMean  - recentMean > 5             ? 'falling'            :
    'stable'

  // ── Sample verbatims for AI diagnosis
  const detractorTexts = npsRows
    .filter(r => r.score <= 6)
    .flatMap(r => r.textAnswers)
    .slice(0, 10)

  const promoterTexts = npsRows
    .filter(r => r.score >= 9)
    .flatMap(r => r.textAnswers)
    .slice(0, 10)

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/dashboard/surveys"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Surveys
        </Link>
        <h1 className="text-xl font-semibold">NPS Tracker</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          12-week rolling Net Promoter Score across all surveys for{' '}
          {brand?.name ?? 'your brand'}.
        </p>
      </div>

      <NpsClient
        weeklyData={weekBuckets}
        currentNps={currentNps}
        totalPromoters={totalPromoters}
        totalPassives={totalPassives}
        totalDetractors={totalDetractors}
        totalResponses={totalResponses}
        trendDirection={trendDirection}
        brandName={brand?.name ?? 'your brand'}
        industry={brand?.category ?? null}
        detractorTexts={detractorTexts}
        promoterTexts={promoterTexts}
        benchmarkP50={npsBenchmarkP50}
        cohorts={showCohorts ? cohorts : []}
      />
    </div>
  )
}
