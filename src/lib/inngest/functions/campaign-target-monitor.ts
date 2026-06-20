import { inngest } from '@/lib/inngest/client'
import { createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface Target {
  id:                   string
  brand_id:             string
  platform_campaign_id: string
  campaign_name:        string | null
  platform:             string | null
  metric:               string
  comparator:           'lte' | 'gte'
  target_value:         number
  period:               string
  last_status:          string | null
}

interface PerfRow {
  spend:       number
  impressions: number
  reach:       number
  clicks:      number
  ctr:         number | null
  cpm:         number | null
  cpc:         number | null
  cpa:         number | null
  roas:        number | null
  frequency:   number | null
  conversions: number
  actions:     Record<string, number> | null
}

function computeActual(metric: string, rows: PerfRow[]): number {
  if (rows.length === 0) return 0

  const sum = (fn: (r: PerfRow) => number) => rows.reduce((s, r) => s + fn(r), 0)
  const avg = (fn: (r: PerfRow) => number | null) => {
    const valid = rows.filter(r => fn(r) !== null && (fn(r) ?? 0) > 0)
    return valid.length > 0 ? valid.reduce((s, r) => s + (fn(r) ?? 0), 0) / valid.length : 0
  }

  const totalSpend    = sum(r => r.spend)
  const totalClicks   = sum(r => r.clicks)
  const totalConv     = sum(r => r.conversions)
  const totalLeads    = sum(r => (r.actions?.lead ?? 0) as number)
  const totalInstalls = sum(r => (r.actions?.mobile_app_install ?? 0) as number)

  switch (metric) {
    case 'spend':        return totalSpend
    case 'impressions':  return sum(r => r.impressions)
    case 'reach':        return sum(r => r.reach)
    case 'clicks':       return totalClicks
    case 'conversions':  return totalConv
    case 'leads':        return totalLeads
    case 'installs':     return totalInstalls
    case 'ctr':          return avg(r => r.ctr)
    case 'cpm':          return avg(r => r.cpm)
    case 'cpc':          return avg(r => r.cpc)
    case 'cpa':          return avg(r => r.cpa)
    case 'roas':         return avg(r => r.roas)
    case 'frequency':    return avg(r => r.frequency)
    case 'cvr':          return totalClicks > 0 ? (totalConv / totalClicks) * 100 : 0
    case 'cpl':          return totalLeads    > 0 ? totalSpend / totalLeads    : 0
    case 'cpi':          return totalInstalls > 0 ? totalSpend / totalInstalls : 0
    default:             return 0
  }
}

function isOnTrack(actual: number, comparator: 'lte' | 'gte', target: number): boolean {
  return comparator === 'gte' ? actual >= target : actual <= target
}

export const campaignTargetMonitor = inngest.createFunction(
  {
    id:   'campaign-target-monitor',
    name: 'Campaign Target Monitor (daily 6 AM Lagos)',
    triggers: [{ cron: 'TZ=Africa/Lagos 0 6 * * *' }],
  },
  async ({ step, logger }) => {
    const supabase = await createServiceClient()

    // Fetch all targets across all brands
    const { data: targets } = await supabase
      .from('campaign_targets')
      .select('id, brand_id, platform_campaign_id, campaign_name, platform, metric, comparator, target_value, period, last_status')

    if (!targets?.length) {
      logger.info('[campaign-target-monitor] No targets to evaluate')
      return { evaluated: 0, notifications: 0 }
    }

    let notifications = 0

    // Group targets by brand for batch processing
    const brandGroups = new Map<string, Target[]>()
    for (const t of targets) {
      if (!brandGroups.has(t.brand_id)) brandGroups.set(t.brand_id, [])
      brandGroups.get(t.brand_id)!.push(t as Target)
    }

    for (const [brandId, brandTargets] of brandGroups) {
      await step.run(`evaluate-brand-${brandId}`, async () => {
        // Get the campaign IDs for this brand
        const campaignIds = [...new Set(brandTargets.map(t => t.platform_campaign_id))]

        // Fetch performance data for the last 30 days
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - 30)
        const cutoffStr = cutoff.toISOString().split('T')[0]

        const { data: perfRows } = await supabase
          .from('digital_performance_daily')
          .select('campaign_id, spend, impressions, reach, clicks, ctr, cpm, cpc, cpa, roas, frequency, conversions, actions')
          .eq('brand_id', brandId)
          .in('campaign_id', campaignIds)
          .gte('date', cutoffStr)

        const rowsByCampaign = new Map<string, PerfRow[]>()
        for (const row of perfRows ?? []) {
          const key = row.campaign_id ?? ''
          if (!key) continue
          if (!rowsByCampaign.has(key)) rowsByCampaign.set(key, [])
          rowsByCampaign.get(key)!.push(row as PerfRow)
        }

        // Evaluate each target
        for (const target of brandTargets) {
          const rows   = rowsByCampaign.get(target.platform_campaign_id) ?? []
          const actual = computeActual(target.metric, rows)
          const enough = rows.length >= 3

          const newStatus = !enough
            ? 'not_enough_data'
            : isOnTrack(actual, target.comparator, target.target_value)
              ? 'on_track'
              : 'off_track'

          const statusChanged = target.last_status !== newStatus

          // Update last_status
          await supabase
            .from('campaign_targets')
            .update({ last_status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', target.id)

          // Notify on status change to off_track (not for not_enough_data → off_track noise)
          if (statusChanged && newStatus === 'off_track' && target.last_status !== 'not_enough_data') {
            const cmpLabel = target.comparator === 'gte' ? 'at least' : 'under'
            const title    = `Target missed: ${target.campaign_name ?? target.platform_campaign_id}`
            const body     = `Your ${target.metric} target of ${cmpLabel} ${target.target_value} is off track. Current value: ${actual.toFixed(2)}.`

            await supabase.from('notifications').insert({
              brand_id: brandId,
              type:     'target_off_track',
              title,
              body,
              href:     `/dashboard/digital/campaigns/${encodeURIComponent(target.platform_campaign_id)}`,
            })

            // Email
            try {
              const { data: usersData } = await supabase.auth.admin.listUsers()
              const user = usersData?.users?.find(u => u.user_metadata?.brand_id === brandId)
                ?? usersData?.users?.[0]

              if (user?.email) {
                await resend.emails.send({
                  from:    'BrandPulse AI <alerts@brandpulse.ai>',
                  to:      user.email,
                  subject: `Campaign alert: ${title}`,
                  text:    [
                    title,
                    '',
                    body,
                    '',
                    'View your campaign on BrandPulse AI to make adjustments.',
                    '',
                    '-- ',
                    'BrandPulse AI | Campaign Target Monitor',
                  ].join('\n'),
                })
              }
            } catch (emailErr) {
              logger.warn(`[campaign-target-monitor] Email failed for brand ${brandId}: ${String(emailErr)}`)
            }

            notifications++
          }

          // Also notify on recovery (off_track → on_track)
          if (statusChanged && newStatus === 'on_track' && target.last_status === 'off_track') {
            const title = `Back on track: ${target.campaign_name ?? target.platform_campaign_id}`
            const body  = `Your ${target.metric} target is now met. Keep it up!`

            await supabase.from('notifications').insert({
              brand_id: brandId,
              type:     'target_on_track',
              title,
              body,
              href:     `/dashboard/digital/campaigns/${encodeURIComponent(target.platform_campaign_id)}`,
            })
            notifications++
          }
        }
      })
    }

    return { evaluated: targets.length, notifications }
  },
)
