import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function thirtyDaysAgo() {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10)
}
function sevenDaysAgo() {
  const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10)
}

export interface RetentionSignal {
  type:        string
  label:       string
  severity:    'low' | 'medium' | 'high' | 'critical'
  detail:      string
  value?:      number
  benchmark?:  number
}

export interface RetentionRiskData {
  overall_risk:       'low' | 'medium' | 'high' | 'critical'
  risk_score:         number   // 0-100
  signals:            RetentionSignal[]
  nps_breakdown:      { promoters: number; passives: number; detractors: number; total: number }
  sentiment_7d_avg:   number | null
  sentiment_30d_avg:  number | null
  bhi_latest:         number | null
  bhi_30d_ago:        number | null
  detractors:         { id: string; score: number; verbatim: string | null; created_at: string }[]
  computed_at:        string
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string; name: string }>(supabase, 'id, name')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const since30 = thirtyDaysAgo()
  const since7  = sevenDaysAgo()

  const [sentimentRes, npsRes, bhiRes] = await Promise.all([
    supabase
      .from('sentiment_daily')
      .select('day, social_score')
      .eq('brand_id', brand.id)
      .gte('day', since30)
      .order('day', { ascending: true }),

    supabase
      .from('nps_records')
      .select('id, score, verbatim, promoter_type, created_at')
      .eq('brand_id', brand.id)
      .gte('created_at', `${since30}T00:00:00.000Z`)
      .order('created_at', { ascending: false }),

    supabase
      .from('brand_health_snapshots')
      .select('bhi, snapshot_date')
      .eq('brand_id', brand.id)
      .gte('snapshot_date', since30)
      .order('snapshot_date', { ascending: true }),
  ])

  const sentimentRows = sentimentRes.data ?? []
  const npsRows       = npsRes.data ?? []
  const bhiRows       = bhiRes.data ?? []

  // ── Compute sentiment averages ──────────────────────────────────
  const sentRows7d  = sentimentRows.filter(r => r.day >= since7)
  const sentRows30d = sentimentRows.filter(r => r.day < since7)

  const avg = (rows: { social_score: number }[]) =>
    rows.length ? rows.reduce((s, r) => s + r.social_score, 0) / rows.length : null

  const sentiment7dAvg  = avg(sentRows7d)
  const sentiment30dAvg = avg(sentRows30d.length ? sentRows30d : sentimentRows)

  // ── NPS breakdown ───────────────────────────────────────────────
  const promoters  = npsRows.filter(r => r.score >= 9).length
  const passives   = npsRows.filter(r => r.score >= 7 && r.score < 9).length
  const detractors = npsRows.filter(r => r.score <= 6).length
  const totalNps   = npsRows.length

  const detractorRecords = npsRows
    .filter(r => r.score <= 6)
    .slice(0, 10)
    .map(r => ({ id: r.id, score: r.score, verbatim: r.verbatim, created_at: r.created_at }))

  // ── BHI delta ──────────────────────────────────────────────────
  const bhiLatest = bhiRows.length ? Number(bhiRows[bhiRows.length - 1].bhi) : null
  const bhi30dAgo = bhiRows.length > 1 ? Number(bhiRows[0].bhi) : null

  // ── Build signals ──────────────────────────────────────────────
  const signals: RetentionSignal[] = []
  let riskScore = 0

  // Signal 1: Sentiment declining
  if (sentiment7dAvg !== null && sentiment30dAvg !== null) {
    const drop = sentiment30dAvg - sentiment7dAvg
    if (drop >= 15) {
      signals.push({
        type: 'sentiment_drop', label: 'Sentiment falling sharply',
        severity: 'critical',
        detail: `Last 7-day sentiment (${sentiment7dAvg.toFixed(1)}) is ${drop.toFixed(1)} pts below the prior-period average.`,
        value: sentiment7dAvg, benchmark: sentiment30dAvg,
      })
      riskScore += 35
    } else if (drop >= 8) {
      signals.push({
        type: 'sentiment_drop', label: 'Sentiment declining',
        severity: 'high',
        detail: `Last 7-day sentiment (${sentiment7dAvg.toFixed(1)}) is ${drop.toFixed(1)} pts below the prior-period average.`,
        value: sentiment7dAvg, benchmark: sentiment30dAvg,
      })
      riskScore += 20
    } else if (drop >= 4) {
      signals.push({
        type: 'sentiment_drop', label: 'Mild sentiment softening',
        severity: 'medium',
        detail: `Sentiment eased ${drop.toFixed(1)} pts over the last 7 days — worth monitoring.`,
        value: sentiment7dAvg, benchmark: sentiment30dAvg,
      })
      riskScore += 10
    }
  } else if (sentimentRows.length === 0) {
    signals.push({
      type: 'no_sentiment_data', label: 'No sentiment data',
      severity: 'low',
      detail: 'No sentiment records in the last 30 days. Connect social platforms to enable monitoring.',
    })
    riskScore += 5
  }

  // Signal 2: High detractor ratio
  if (totalNps > 0) {
    const detractorPct = (detractors / totalNps) * 100
    if (detractorPct >= 40) {
      signals.push({
        type: 'high_detractors', label: 'High detractor rate',
        severity: 'critical',
        detail: `${detractors} of ${totalNps} NPS responses (${detractorPct.toFixed(0)}%) are detractors. Immediate outreach needed.`,
        value: detractorPct,
      })
      riskScore += 30
    } else if (detractorPct >= 25) {
      signals.push({
        type: 'high_detractors', label: 'Elevated detractor rate',
        severity: 'high',
        detail: `${detractorPct.toFixed(0)}% of recent NPS responses are detractors (${detractors} of ${totalNps}).`,
        value: detractorPct,
      })
      riskScore += 18
    } else if (detractorPct >= 15) {
      signals.push({
        type: 'high_detractors', label: 'Detractor watch',
        severity: 'medium',
        detail: `${detractorPct.toFixed(0)}% detractor rate — above the healthy <15% threshold.`,
        value: detractorPct,
      })
      riskScore += 8
    }
  }

  // Signal 3: BHI declining
  if (bhiLatest !== null && bhi30dAgo !== null) {
    const bhiDrop = bhi30dAgo - bhiLatest
    if (bhiDrop >= 10) {
      signals.push({
        type: 'bhi_decline', label: 'Brand health declining',
        severity: bhiDrop >= 20 ? 'critical' : 'high',
        detail: `BHI dropped ${bhiDrop.toFixed(1)} pts in 30 days (${bhi30dAgo.toFixed(1)} → ${bhiLatest.toFixed(1)}).`,
        value: bhiLatest, benchmark: bhi30dAgo,
      })
      riskScore += bhiDrop >= 20 ? 25 : 15
    } else if (bhiDrop >= 5) {
      signals.push({
        type: 'bhi_decline', label: 'Brand health softening',
        severity: 'medium',
        detail: `BHI eased ${bhiDrop.toFixed(1)} pts over 30 days.`,
        value: bhiLatest, benchmark: bhi30dAgo,
      })
      riskScore += 8
    }
  }

  // Signal 4: No recent NPS data
  if (totalNps === 0) {
    signals.push({
      type: 'no_nps_data', label: 'No NPS data in 30 days',
      severity: 'medium',
      detail: 'No NPS survey responses in the last 30 days. Run an NPS survey to get visibility on customer sentiment.',
    })
    riskScore += 10
  }

  // Signal 5: Low promoter ratio
  if (totalNps >= 5 && promoters / totalNps < 0.25) {
    signals.push({
      type: 'low_promoters', label: 'Low promoter base',
      severity: 'medium',
      detail: `Only ${Math.round((promoters / totalNps) * 100)}% of NPS respondents are promoters (target: ≥25%). Advocacy pipeline is thin.`,
      value: Math.round((promoters / totalNps) * 100),
    })
    riskScore += 8
  }

  riskScore = Math.min(100, riskScore)

  const overallRisk: RetentionRiskData['overall_risk'] =
    riskScore >= 70 ? 'critical' :
    riskScore >= 45 ? 'high' :
    riskScore >= 20 ? 'medium' : 'low'

  return NextResponse.json({
    overall_risk:      overallRisk,
    risk_score:        riskScore,
    signals,
    nps_breakdown:     { promoters, passives, detractors, total: totalNps },
    sentiment_7d_avg:  sentiment7dAvg,
    sentiment_30d_avg: sentiment30dAvg,
    bhi_latest:        bhiLatest,
    bhi_30d_ago:       bhi30dAgo,
    detractors:        detractorRecords,
    computed_at:       new Date().toISOString(),
  } satisfies RetentionRiskData)
}
