import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export const competitiveWeeklyBriefing = inngest.createFunction(
  {
    id:   'competitive-weekly-briefing',
    name: 'Competitive Weekly Briefing (Monday 8am Lagos)',
    triggers: [
      { cron: 'TZ=Africa/Lagos 0 8 * * 1' },
      { event: 'brandgauge/competitive.briefing.requested' },
    ],
    retries: 2,
  },
  async ({ step, logger }) => {
    const supabase = await createServiceClient()

    const brands = await step.run('fetch-brands', async () => {
      const { data } = await supabase
        .from('brands')
        .select('id, name, category, market_share_pct')
      return data ?? []
    })

    if (!brands.length) {
      logger.info('[competitive-weekly-briefing] no brands found')
      return { brandsProcessed: 0, sent: 0 }
    }

    // Compute current Monday (week_start)
    const now       = new Date()
    const dayOfWeek = now.getUTCDay() // 0 = Sun, 1 = Mon ...
    const diff      = (dayOfWeek + 6) % 7  // days since Monday
    const monday    = new Date(now)
    monday.setUTCDate(now.getUTCDate() - diff)
    const weekStart = monday.toISOString().slice(0, 10)

    let brandsProcessed = 0
    let sent = 0

    for (const brand of brands) {
      const briefingResult = await step.run(`briefing-${brand.id}`, async () => {
        const svc = await createServiceClient()

        const [
          { data: sovSnap },
          { data: competitors },
          { data: sentimentRows },
          { data: mentions },
        ] = await Promise.all([
          svc
            .from('sov_snapshots')
            .select('snapshot_date, social_sov, competitor_data')
            .eq('brand_id', brand.id)
            .order('snapshot_date', { ascending: false })
            .limit(1)
            .maybeSingle(),
          svc
            .from('competitors')
            .select('id, name')
            .eq('brand_id', brand.id),
          svc
            .from('sentiment_daily')
            .select('day, social_score, positive_pct, neutral_pct, negative_pct')
            .eq('brand_id', brand.id)
            .order('day', { ascending: false })
            .limit(7),
          svc
            .from('mentions')
            .select('content, author_handle, platform, sentiment_label, created_at')
            .eq('brand_id', brand.id)
            .not('sentiment_label', 'is', null)
            .order('created_at', { ascending: false })
            .limit(15),
        ])

        const competitorData = sovSnap?.competitor_data as {
          brand_volume?: number
          competitor_volumes?: Record<string, number>
        } | null

        const brandVolume      = competitorData?.brand_volume ?? 0
        const competitorVolumes = competitorData?.competitor_volumes ?? {}
        const totalVolume      = brandVolume + Object.values(competitorVolumes).reduce((a, b) => a + b, 0)

        const sovLines = totalVolume > 0
          ? [
              `${brand.name}: ${brandVolume} mentions (${Math.round((brandVolume / totalVolume) * 100)}% SOV)`,
              ...Object.entries(competitorVolumes)
                .sort((a, b) => b[1] - a[1])
                .map(([name, vol]) => `${name}: ${vol} mentions (${Math.round((vol / totalVolume) * 100)}% SOV)`),
            ].join('\n')
          : 'No SOV data this week'

        const latest = sentimentRows?.[0]
        const sentimentBlock = latest
          ? `Score: ${Math.round(latest.social_score)}/100 | Positive: ${Math.round(latest.positive_pct)}% | Negative: ${Math.round(latest.negative_pct)}%`
          : 'No sentiment data'

        const trendLine = sentimentRows && sentimentRows.length > 1
          ? [...sentimentRows].reverse().map(d => `${d.day}: ${Math.round(d.social_score)}`).join(', ')
          : null

        const negativeMentions = (mentions ?? []).filter(m => m.sentiment_label === 'negative').slice(0, 3)
        const positiveMentions = (mentions ?? []).filter(m => m.sentiment_label === 'positive').slice(0, 3)
        const mentionsBlock = [
          positiveMentions.length ? `Positive:\n${positiveMentions.map(m => `  • "${m.content?.slice(0, 80)}"`).join('\n')}` : null,
          negativeMentions.length ? `Negative:\n${negativeMentions.map(m => `  • "${m.content?.slice(0, 80)}"`).join('\n')}` : null,
        ].filter(Boolean).join('\n\n')

        const competitorNames = (competitors ?? []).map(c => c.name).join(', ') || 'none'

        const dataBlock = `
BRAND: ${brand.name}
Category: ${brand.category ?? 'not set'}

SHARE OF VOICE (week of ${weekStart}):
${sovLines}

TRACKED COMPETITORS: ${competitorNames}

SENTIMENT (latest: ${latest?.day ?? 'no data'}):
${sentimentBlock}
${trendLine ? `7-day trend: ${trendLine}` : ''}

SOCIAL SIGNALS:
${mentionsBlock || 'No classified mentions yet'}
`.trim()

        const systemPrompt = `You are a senior brand strategist writing a Monday morning competitive briefing for a Nigerian / West African marketing team. Be concise and specific. Active voice only. No jargon. No em dashes.

Return ONLY valid JSON — no markdown fences — in this exact shape:
{
  "title": "string",
  "executive_summary": "string — 2-3 sentences on competitive position",
  "sov_analysis": "string",
  "sentiment_vs_market": "string",
  "brand_strengths": ["string"],
  "brand_vulnerabilities": ["string"],
  "competitor_threats": ["string"],
  "opportunities": ["string"],
  "recommendations": [
    { "action": "string", "rationale": "string", "priority": "High" | "Medium" | "Low" }
  ],
  "data_gaps": ["string"],
  "confidence": "High" | "Medium" | "Low"
}`

        const raw = await callAi({
          tier: 'structural',
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: `Generate the weekly competitive briefing for week starting ${weekStart}:\n\n${dataBlock}`,
          }],
          maxTokens: 1800,
          temperature: 0.3,
        })

        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
        const content = JSON.parse(cleaned)

        // Upsert into weekly_briefings
        await svc.from('weekly_briefings').upsert({
          brand_id:   brand.id,
          week_start: weekStart,
          content,
          created_at: new Date().toISOString(),
        }, { onConflict: 'brand_id,week_start' })

        return content
      })

      brandsProcessed++

      // Fetch user email from auth.users via service role
      await step.run(`notify-${brand.id}`, async () => {
        if (!briefingResult) return { skipped: 'no briefing content' }

        const svc = await createServiceClient()

        // Get the brand's owner email via auth admin API
        const { data: usersData } = await svc.auth.admin.listUsers()
        const userRecord = usersData?.users?.find(u =>
          u.email && u.user_metadata?.brand_id === brand.id
        ) ?? usersData?.users?.[0] ?? null

        if (!userRecord?.email) {
          logger.info(`[competitive-weekly-briefing] no email for brand ${brand.id}`)
          return { skipped: 'no user email' }
        }

        const content = briefingResult as {
          title?: string
          executive_summary?: string
          recommendations?: { action: string; rationale: string; priority: string }[]
        }

        const top3 = (content.recommendations ?? [])
          .slice(0, 3)
          .map((r, i) => `${i + 1}. ${r.action}\n   ${r.rationale}`)
          .join('\n\n')

        const emailBody = [
          `${content.title ?? 'Weekly Competitive Briefing'}`,
          `Week starting ${weekStart}`,
          '',
          'EXECUTIVE SUMMARY',
          content.executive_summary ?? '',
          '',
          'TOP RECOMMENDATIONS',
          top3 || 'No recommendations generated.',
          '',
          '-- ',
          'BrandGauge | View full briefing at your dashboard',
        ].join('\n')

        await resend.emails.send({
          from:    'BrandGauge <briefings@brandgauge.app>',
          to:      userRecord.email,
          subject: `Your weekly competitive briefing — ${brand.name}`,
          text:    emailBody,
        })

        logger.info(`[competitive-weekly-briefing] email sent to ${userRecord.email} for brand ${brand.name}`)
        return { sent: true, email: userRecord.email }
      }).then(result => {
        if ((result as { sent?: boolean })?.sent) sent++
      }).catch(err => {
        logger.warn(`[competitive-weekly-briefing] email step failed for brand ${brand.id}:`, err)
      })
    }

    return { brandsProcessed, sent }
  },
)
