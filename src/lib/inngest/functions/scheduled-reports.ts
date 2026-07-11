import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'
import { Resend } from 'resend'

const resend  = new Resend(process.env.RESEND_API_KEY)
const APP_URL = process.env.APP_URL ?? 'https://brandpulse-ai-tau.vercel.app'

function thirtyDaysAgo() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString()
}

function sevenDaysAgo() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString()
}

// ── Monthly report — 1st of month, 7am Lagos ─────────────────────────────────
export const monthlyReportCron = inngest.createFunction(
  {
    id: 'monthly-report-cron',
    name: 'Monthly Brand Report (auto)',
    triggers: [{ cron: 'TZ=Africa/Lagos 0 7 1 * *' }],
  },
  async () => {
    const supabase = await createServiceClient()
    const since = thirtyDaysAgo()
    const month = new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' })

    // Find all workspaces with at least one brand
    const { data: brands } = await supabase
      .from('brands')
      .select('id, name, category, workspace_id')

    if (!brands?.length) return { sent: 0 }

    let sent = 0
    for (const brand of brands) {
      // Collect metrics
      const [sentRes, sovRes, socialRes] = await Promise.all([
        supabase.from('sentiment_daily').select('social_score, positive_pct, negative_pct')
          .eq('brand_id', brand.id).gte('day', since.slice(0, 10)),
        supabase.from('sov_snapshots').select('social_sov')
          .eq('brand_id', brand.id).gte('created_at', since).order('created_at', { ascending: false }).limit(10),
        supabase.from('social_posts').select('impressions, reach, likes, comments, shares')
          .eq('brand_id', brand.id).gte('posted_at', since),
      ])

      const sentRows  = sentRes.data ?? []
      const sovRows   = sovRes.data ?? []
      const posts     = socialRes.data ?? []

      const avgSentiment = sentRows.length
        ? (sentRows.reduce((s, r) => s + (r.social_score ?? 0), 0) / sentRows.length).toFixed(1)
        : 'no data'
      const avgSov = sovRows.length
        ? (sovRows.reduce((s, r) => s + (r.social_sov ?? 0), 0) / sovRows.length).toFixed(1)
        : 'no data'
      const totalImpressions = posts.reduce((s, p) => s + (p.impressions ?? 0), 0)
      const totalEng         = posts.reduce((s, p) => s + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0), 0)

      const prompt = `Brand: ${brand.name} (${brand.category ?? 'unspecified'})
Report period: Last 30 days (${month})
Average social sentiment: ${avgSentiment}/100
Average SOV: ${avgSov}%
Total impressions: ${totalImpressions.toLocaleString()}
Total engagements: ${totalEng.toLocaleString()}

Return JSON only:
{
  "headline": "string — one-sentence brand health headline",
  "summary": "string — 2-sentence executive summary",
  "top_priority": "string — single most important action for next month",
  "data_quality": "High|Medium|Low"
}`

      const raw = await callAi({
        tier: 'structural',
        system: 'Brand analytics director. Nigerian market. Return ONLY valid JSON.',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 600,
        temperature: 0.2,
      }).catch(() => null)

      if (!raw) continue

      let result: { headline?: string; summary?: string; top_priority?: string; data_quality?: string }
      try {
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
        result = JSON.parse(cleaned)
      } catch { continue }

      // Find workspace admin to email
      const { data: members } = await supabase
        .from('workspace_members')
        .select('user_id, role')
        .eq('workspace_id', brand.workspace_id)
        .in('role', ['owner', 'admin'])

      if (!members?.length) continue

      const userIds = members.map(m => m.user_id)
      const { data: { users } } = await supabase.auth.admin.listUsers()
      const adminEmails = users
        .filter(u => userIds.includes(u.id) && u.email)
        .map(u => u.email!)

      if (!adminEmails.length || !process.env.RESEND_API_KEY) continue

      await resend.emails.send({
        from:    'BrandGauge <reports@brandgauge.app>',
        to:      adminEmails,
        subject: `Monthly brand report — ${brand.name} — ${month}`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
          <h2 style="font-size:20px;margin-bottom:4px;">${brand.name} — ${month}</h2>
          <p style="font-size:14px;color:#666;margin-top:0;">${result.data_quality ?? ''} data quality</p>
          <h3 style="font-size:16px;">${result.headline ?? ''}</h3>
          <p style="font-size:14px;line-height:1.6;">${result.summary ?? ''}</p>
          <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:20px 0;">
            <p style="margin:0;font-size:13px;font-weight:600;color:#555;">TOP PRIORITY FOR NEXT MONTH</p>
            <p style="margin:8px 0 0;font-size:14px;">${result.top_priority ?? ''}</p>
          </div>
          <p style="margin:28px 0;"><a href="${APP_URL}/dashboard/brand-equity" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">View full report</a></p>
          <p style="font-size:12px;color:#aaa;border-top:1px solid #eee;padding-top:16px;">BrandGauge · Unsubscribe from monthly reports in Settings</p>
        </div>`,
      }).catch(() => null)

      sent++
    }

    return { sent }
  },
)

// ── Monday digest — every Monday, 7am Lagos ──────────────────────────────────
export const weeklyDigestCron = inngest.createFunction(
  {
    id: 'weekly-brand-digest',
    name: 'Monday Brand Digest',
    triggers: [{ cron: 'TZ=Africa/Lagos 0 7 * * 1' }],
  },
  async () => {
    const supabase = await createServiceClient()
    const since    = sevenDaysAgo()

    const { data: brands } = await supabase
      .from('brands')
      .select('id, name, workspace_id')

    if (!brands?.length) return { sent: 0 }

    let sent = 0
    for (const brand of brands) {
      const [sentRes, sovRes, mentionsRes, alertsRes] = await Promise.all([
        // Last 7d sentiment vs prev 7d
        supabase.from('sentiment_daily').select('social_score, day')
          .eq('brand_id', brand.id)
          .gte('day', since.slice(0, 10))
          .order('day', { ascending: false }),
        supabase.from('sov_snapshots').select('social_sov')
          .eq('brand_id', brand.id).gte('created_at', since).order('created_at', { ascending: false }).limit(1),
        supabase.from('mentions').select('content, platform, sentiment_label, author_handle')
          .eq('brand_id', brand.id).gte('created_at', since)
          .in('sentiment_label', ['positive', 'negative'])
          .order('created_at', { ascending: false }).limit(5),
        supabase.from('monitoring_alerts').select('alert_type, message, triggered_at')
          .eq('brand_id', brand.id).gte('triggered_at', since)
          .order('triggered_at', { ascending: false }).limit(5),
      ])

      const sentRows  = sentRes.data ?? []
      const latestSov = sovRes.data?.[0]?.social_sov ?? null
      const mentions  = mentionsRes.data ?? []
      const alerts    = alertsRes.data ?? []

      const avgSent = sentRows.length
        ? (sentRows.reduce((s, r) => s + (r.social_score ?? 0), 0) / sentRows.length).toFixed(1)
        : null

      if (!avgSent && !latestSov && !mentions.length && !alerts.length) continue

      const topMentionsHtml = mentions.slice(0, 3).map(m =>
        `<li style="margin-bottom:8px;"><strong style="color:${m.sentiment_label === 'positive' ? '#16a34a' : '#dc2626'}">${m.sentiment_label === 'positive' ? '↑' : '↓'}</strong> ${m.content?.slice(0, 100) ?? ''}… <span style="color:#888;font-size:12px;">@${m.author_handle ?? m.platform}</span></li>`
      ).join('')

      const alertsHtml = alerts.slice(0, 3).map(a =>
        `<li style="margin-bottom:6px;font-size:13px;">${a.message ?? a.alert_type}</li>`
      ).join('')

      const { data: members } = await supabase
        .from('workspace_members')
        .select('user_id, role')
        .eq('workspace_id', brand.workspace_id)

      if (!members?.length) continue

      const userIds = members.map(m => m.user_id)
      const { data: { users } } = await supabase.auth.admin.listUsers()
      const emails = users
        .filter(u => userIds.includes(u.id) && u.email)
        .map(u => u.email!)

      if (!emails.length || !process.env.RESEND_API_KEY) continue

      await resend.emails.send({
        from:    'BrandGauge <digest@brandgauge.app>',
        to:      emails,
        subject: `Your week in brand — ${brand.name}`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
          <h2 style="font-size:18px;margin-bottom:4px;">Good Monday — here's your brand digest</h2>
          <p style="color:#666;font-size:13px;margin-top:0;">${brand.name} · Last 7 days</p>

          <div style="display:flex;gap:16px;margin:20px 0;">
            <div style="flex:1;background:#f5f5f5;border-radius:8px;padding:14px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.05em;">Sentiment</p>
              <p style="margin:4px 0 0;font-size:22px;font-weight:700;">${avgSent ? `${avgSent}/100` : '—'}</p>
            </div>
            <div style="flex:1;background:#f5f5f5;border-radius:8px;padding:14px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.05em;">SOV</p>
              <p style="margin:4px 0 0;font-size:22px;font-weight:700;">${latestSov != null ? `${latestSov}%` : '—'}</p>
            </div>
          </div>

          ${topMentionsHtml ? `<h3 style="font-size:14px;margin-bottom:8px;">Notable mentions</h3><ul style="padding-left:0;list-style:none;margin:0 0 20px;">${topMentionsHtml}</ul>` : ''}
          ${alertsHtml ? `<h3 style="font-size:14px;margin-bottom:8px;">Alerts this week</h3><ul style="padding-left:16px;margin:0 0 20px;">${alertsHtml}</ul>` : ''}

          <p style="margin:24px 0;"><a href="${APP_URL}/dashboard" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">Open dashboard</a></p>
          <p style="font-size:12px;color:#aaa;border-top:1px solid #eee;padding-top:16px;">BrandGauge · Manage digest preferences in Settings</p>
        </div>`,
      }).catch(() => null)

      sent++
    }

    return { sent }
  },
)
