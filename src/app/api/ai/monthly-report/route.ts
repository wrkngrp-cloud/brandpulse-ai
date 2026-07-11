import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'
import { getActiveBrand } from '@/lib/active-brand'

export const runtime = 'nodejs'
export const maxDuration = 120

interface NextMonthPriority {
  priority:   string
  rationale:  string
}

interface MonthlyReportResult {
  month:                string
  headline_score:       string
  executive_summary:    string
  key_wins:             string[]
  key_concerns:         string[]
  sentiment_narrative:  string
  content_performance:  string
  audience_signals:     string
  next_month_priorities: NextMonthPriority[]
  data_quality:         'High' | 'Medium' | 'Low'
}

function getMonthLabel(): string {
  return new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' })
}

function thirtyDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString()
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string; name: string; category: string | null }>(supabase, 'id, name, category')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const service = await createServiceClient()
  const since   = thirtyDaysAgo()

  // Fetch all metrics in parallel
  const [
    sentimentRes,
    sovRes,
    surveyRes,
    socialRes,
    prePostRes,
  ] = await Promise.all([
    // Sentiment daily: avg social_score + pcts
    service
      .from('sentiment_daily')
      .select('social_score, positive_pct, neutral_pct, negative_pct')
      .eq('brand_id', brand.id)
      .gte('day', since.slice(0, 10)),

    // SOV snapshots
    service
      .from('sov_snapshots')
      .select('social_sov')
      .eq('brand_id', brand.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10),

    // Survey responses: count via surveys → survey_responses join
    service
      .from('survey_responses')
      .select('id, answers, surveys!inner(brand_id)')
      .eq('surveys.brand_id', brand.id)
      .gte('collected_at', since),

    // Social posts: aggregate engagement
    service
      .from('social_posts')
      .select('impressions, reach, likes, comments, shares')
      .eq('brand_id', brand.id)
      .gte('posted_at', since),

    // Pre-post analyses
    service
      .from('pre_post_analyses')
      .select('cultural_score')
      .eq('brand_id', brand.id)
      .gte('created_at', since),
  ])

  // Compute sentiment averages
  const sentimentRows = sentimentRes.data ?? []
  const avgSocialScore = sentimentRows.length
    ? (sentimentRows.reduce((s, r) => s + (r.social_score ?? 0), 0) / sentimentRows.length).toFixed(1)
    : 'no data'
  const avgPosPct = sentimentRows.length
    ? (sentimentRows.reduce((s, r) => s + (r.positive_pct ?? 0), 0) / sentimentRows.length).toFixed(1)
    : 'no data'
  const avgNegPct = sentimentRows.length
    ? (sentimentRows.reduce((s, r) => s + (r.negative_pct ?? 0), 0) / sentimentRows.length).toFixed(1)
    : 'no data'
  const avgNeutPct = sentimentRows.length
    ? (sentimentRows.reduce((s, r) => s + (r.neutral_pct ?? 0), 0) / sentimentRows.length).toFixed(1)
    : 'no data'

  // SOV
  const sovRows = sovRes.data ?? []
  const avgSov = sovRows.length
    ? (sovRows.reduce((s, r) => s + (r.social_sov ?? 0), 0) / sovRows.length).toFixed(1)
    : 'no data'

  // Survey NPS
  const surveyRows = surveyRes.data ?? []
  const surveyCount = surveyRows.length

  // Social posts aggregate
  const socialRows = socialRes.data ?? []
  const totalImpressions = socialRows.reduce((s, r) => s + (r.impressions ?? 0), 0)
  const totalReach        = socialRows.reduce((s, r) => s + (r.reach ?? 0), 0)
  const totalLikes        = socialRows.reduce((s, r) => s + (r.likes ?? 0), 0)
  const totalComments     = socialRows.reduce((s, r) => s + (r.comments ?? 0), 0)
  const totalShares       = socialRows.reduce((s, r) => s + (r.shares ?? 0), 0)

  // Pre-post analyses
  const prePostRows = prePostRes.data ?? []
  const avgCulturalScore = prePostRows.length
    ? (prePostRows.reduce((s, r) => s + (r.cultural_score ?? 0), 0) / prePostRows.length).toFixed(1)
    : 'no data'

  const month = getMonthLabel()

  const userPrompt = `Brand: ${brand.name}
Category: ${brand.category ?? 'not specified'}
Report period: Last 30 days (${month})

SENTIMENT DATA (${sentimentRows.length} daily snapshots):
- Average social sentiment score: ${avgSocialScore}/100
- Average positive %: ${avgPosPct}%
- Average neutral %: ${avgNeutPct}%
- Average negative %: ${avgNegPct}%

SHARE OF VOICE (${sovRows.length} snapshots):
- Average social SOV: ${avgSov}%

SURVEY RESPONSES:
- Total responses last 30 days: ${surveyCount}

SOCIAL CONTENT PERFORMANCE (${socialRows.length} posts):
- Total impressions: ${totalImpressions.toLocaleString()}
- Total reach: ${totalReach.toLocaleString()}
- Total likes: ${totalLikes.toLocaleString()}
- Total comments: ${totalComments.toLocaleString()}
- Total shares: ${totalShares.toLocaleString()}

PRE-POST CREATIVE ANALYSES (${prePostRows.length} analyses):
- Average cultural fit score: ${avgCulturalScore}/100

Based on this data, produce a monthly brand performance report for a Nigerian marketing team. Be specific, data-driven, and actionable. If data is sparse, acknowledge it and focus on the signals available.

Return ONLY this JSON, no preamble, no markdown:
{
  "month": "${month}",
  "headline_score": "string — e.g. 'Brand health is Building — sentiment up 8pts this month'",
  "executive_summary": "string — 2-3 sentences summarising the month",
  "key_wins": ["string", "string"],
  "key_concerns": ["string", "string"],
  "sentiment_narrative": "string — what the sentiment data tells us about audience mood",
  "content_performance": "string — what the social post data reveals",
  "audience_signals": "string — what survey and engagement patterns suggest about the audience",
  "next_month_priorities": [
    { "priority": "string", "rationale": "string" }
  ],
  "data_quality": "High|Medium|Low"
}`

  let result: MonthlyReportResult
  try {
    const raw = await callAi({
      tier:        'structural',
      system:      'You are a brand analytics director producing a monthly brand performance report for a Nigerian marketing team. Be specific, data-driven, and actionable. Return ONLY valid JSON.',
      messages:    [{ role: 'user', content: userPrompt }],
      maxTokens:   2500,
      temperature: 0.2,
    })

    const start   = raw.indexOf('{')
    const end     = raw.lastIndexOf('}')
    if (start === -1 || end === -1) throw new Error('No JSON object in AI response')
    result = JSON.parse(raw.slice(start, end + 1)) as MonthlyReportResult
  } catch (err) {
    console.error('[monthly-report] AI error:', err)
    return NextResponse.json({ error: 'Failed to generate report. Please try again.' }, { status: 500 })
  }

  // Send email if we have a Resend key and a recipient address
  const recipientEmail = user.email
  if (recipientEmail && process.env.RESEND_API_KEY) {
    try {
      const resend  = new Resend(process.env.RESEND_API_KEY)
      const subject = `Your monthly brand report — ${brand.name} — ${month}`

      const prioritiesText = (result.next_month_priorities ?? [])
        .map((p, i) => `${i + 1}. ${p.priority}\n   ${p.rationale}`)
        .join('\n\n')

      const emailBody = `Monthly Brand Report: ${brand.name}
${month}

${result.headline_score}

SUMMARY
${result.executive_summary}

KEY WINS
${(result.key_wins ?? []).map(w => `• ${w}`).join('\n')}

KEY CONCERNS
${(result.key_concerns ?? []).map(c => `• ${c}`).join('\n')}

NEXT MONTH PRIORITIES
${prioritiesText}

---
Generated by BrandGauge. Log in to see the full interactive report.`

      await resend.emails.send({
        from:    'BrandGauge <reports@brandgauge.app>',
        to:      recipientEmail,
        subject,
        text:    emailBody,
      })
    } catch (emailErr) {
      // Email failure is non-fatal — report is still returned
      console.error('[monthly-report] Email send failed:', emailErr)
    }
  }

  return NextResponse.json({ ...result, emailSent: !!recipientEmail && !!process.env.RESEND_API_KEY })
}
