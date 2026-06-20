import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'
import { z } from 'zod'

const Body = z.object({
  days:      z.number().int().min(7).max(180).default(30),
  brandName: z.string(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { days, brandName } = parsed.data

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const { data: schedules } = await supabase
    .from('tv_schedules')
    .select('channel_name, programme, daypart, duration_sec, spots_planned, spots_aired, grp_planned, grp_delivered, net_cost, status, tv_channels(reach_prime, reach_day)')
    .eq('brand_id', brand.id)
    .gte('spot_date', cutoff.toISOString().slice(0, 10))

  if (!schedules?.length) {
    return NextResponse.json({ error: 'No TV schedule data for this period.' }, { status: 400 })
  }

  // Aggregate by channel
  const channelMap: Record<string, {
    spots_planned: number; spots_aired: number; grp_planned: number; grp_delivered: number
    spend: number; reach: number; dayparts: Set<string>; programmes: Set<string>
  }> = {}

  for (const s of schedules) {
    const ch = s.channel_name
    if (!channelMap[ch]) channelMap[ch] = {
      spots_planned: 0, spots_aired: 0, grp_planned: 0, grp_delivered: 0,
      spend: 0, reach: 0, dayparts: new Set(), programmes: new Set(),
    }
    channelMap[ch].spots_planned  += s.spots_planned
    channelMap[ch].spots_aired    += s.spots_aired ?? 0
    channelMap[ch].grp_planned    += Number(s.grp_planned ?? 0)
    channelMap[ch].grp_delivered  += Number(s.grp_delivered ?? 0)
    channelMap[ch].spend          += Number(s.net_cost ?? 0)
    channelMap[ch].dayparts.add(s.daypart)
    if (s.programme) channelMap[ch].programmes.add(s.programme)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chData = (s as any).tv_channels as { reach_prime: number | null; reach_day: number | null } | null
    if (chData) {
      const reach = (s.daypart === 'prime_time' ? chData.reach_prime : chData.reach_day) ?? 0
      channelMap[ch].reach += reach * s.spots_planned
    }
  }

  const channelLines = Object.entries(channelMap).map(([name, d]) => {
    const delivery = d.spots_planned > 0 ? Math.round(d.spots_aired / d.spots_planned * 100) : 0
    const grpDel = d.grp_planned > 0 ? `${d.grp_delivered.toFixed(1)}/${d.grp_planned.toFixed(1)} GRPs (${Math.round(d.grp_delivered / d.grp_planned * 100)}%)` : 'GRP n/a'
    const cprp = d.grp_delivered > 0 ? `₦${(d.spend / d.grp_delivered).toFixed(0)}` : 'n/a'
    const cpt = d.reach > 0 ? `₦${(d.spend / (d.reach / 1000)).toFixed(0)}` : 'n/a'
    const programmes = [...d.programmes].slice(0, 3).join(', ')
    return `${name}: ${delivery}% spot delivery, ${grpDel}, CPRP ${cprp}, CPT ${cpt}, dayparts: ${[...d.dayparts].join('/')}, programmes: ${programmes || 'various'}`
  }).join('\n')

  const totalSpend = Object.values(channelMap).reduce((s, d) => s + d.spend, 0)
  const totalGrpPlanned = Object.values(channelMap).reduce((s, d) => s + d.grp_planned, 0)
  const totalGrpDelivered = Object.values(channelMap).reduce((s, d) => s + d.grp_delivered, 0)

  const text = await callAi({
    tier: 'structural',
    system: `You are a media expert specialising in Nigerian TV advertising.
Be specific and actionable. Reference actual channel and programme names from the data.
Respond in plain text with section headers using ##. Keep each section to 2-3 sentences.`,
    messages: [{
      role: 'user',
      content: `Analyse this TV campaign data for ${brandName} over the last ${days} days.

Total spend: ₦${totalSpend.toLocaleString()}
Total GRPs: ${totalGrpDelivered.toFixed(1)} delivered vs ${totalGrpPlanned.toFixed(1)} planned

CHANNEL PERFORMANCE:
${channelLines}

Provide:
## Programme Performance Ranking
Rank channels by CPT and CPRP efficiency. Which channels are delivering the best reach for the spend?

## GRP Delivery Alerts
Identify any channels underdelivering on GRP targets. Suggest specific make-good spots to negotiate with the channels.

## Prime Time vs Fringe Analysis
Comment on the daypart mix — is the brand over-indexed on expensive prime time relative to its GRP delivery?

## Key Recommendation
One clear, actionable next step to improve this TV campaign's performance.`,
    }],
    maxTokens: 700,
  })

  return NextResponse.json({ analysis: text })
}
