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
    .from('radio_schedules')
    .select('station_name, daypart, duration_sec, spots_planned, spots_aired, net_cost, status, radio_stations(reach_am, reach_pm, reach_day)')
    .eq('brand_id', brand.id)
    .gte('spot_date', cutoff.toISOString().slice(0, 10))

  if (!schedules?.length) {
    return NextResponse.json({ error: 'No radio schedule data for this period.' }, { status: 400 })
  }

  // Aggregate by station + daypart
  const stationMap: Record<string, { spots_planned: number; spots_aired: number; spend: number; reach: number; dayparts: Set<string> }> = {}
  const daypartMap: Record<string, { spots_planned: number; spots_aired: number; spend: number; reach: number }> = {}

  const REACH_COL: Record<string, 'reach_am' | 'reach_pm' | 'reach_day'> = {
    morning_drive: 'reach_am', early_morning: 'reach_am',
    evening: 'reach_pm', afternoon_drive: 'reach_pm',
    daytime: 'reach_day', late_night: 'reach_day',
  }

  for (const s of schedules) {
    const station = s.station_name
    if (!stationMap[station]) stationMap[station] = { spots_planned: 0, spots_aired: 0, spend: 0, reach: 0, dayparts: new Set() }
    stationMap[station].spots_planned += s.spots_planned
    stationMap[station].spots_aired   += s.spots_aired ?? 0
    stationMap[station].spend         += Number(s.net_cost ?? 0)
    stationMap[station].dayparts.add(s.daypart)

    const dp = s.daypart
    if (!daypartMap[dp]) daypartMap[dp] = { spots_planned: 0, spots_aired: 0, spend: 0, reach: 0 }
    daypartMap[dp].spots_planned += s.spots_planned
    daypartMap[dp].spots_aired   += s.spots_aired ?? 0
    daypartMap[dp].spend         += Number(s.net_cost ?? 0)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stationData = (s as any).radio_stations as { reach_am: number | null; reach_pm: number | null; reach_day: number | null } | null
    if (stationData) {
      const col = REACH_COL[dp] ?? 'reach_day'
      const reach = (stationData[col] ?? 0) * s.spots_planned
      stationMap[station].reach += reach
      daypartMap[dp].reach      += reach
    }
  }

  const stationLines = Object.entries(stationMap).map(([name, d]) => {
    const delivery = d.spots_planned > 0 ? Math.round(d.spots_aired / d.spots_planned * 100) : 0
    const cpt = d.reach > 0 ? (d.spend / (d.reach / 1000)).toFixed(0) : 'n/a'
    return `${name}: ${d.spots_aired}/${d.spots_planned} spots aired (${delivery}% delivery), ₦${d.spend.toLocaleString()} spend, CPT ₦${cpt}, dayparts: ${[...d.dayparts].join('/')}`
  }).join('\n')

  const daypartLines = Object.entries(daypartMap).map(([dp, d]) => {
    const delivery = d.spots_planned > 0 ? Math.round(d.spots_aired / d.spots_planned * 100) : 0
    const cpt = d.reach > 0 ? (d.spend / (d.reach / 1000)).toFixed(0) : 'n/a'
    return `${dp}: ${d.spots_aired}/${d.spots_planned} spots (${delivery}% delivery), ₦${d.spend.toLocaleString()} spend, CPT ₦${cpt}`
  }).join('\n')

  const text = await callAi({
    tier: 'structural',
    system: `You are a media expert specialising in Nigerian radio advertising.
Be specific and actionable. Reference actual station names and dayparts from the data.
Respond in plain text with section headers using ##. Keep each section to 2-3 sentences max.`,
    messages: [{
      role: 'user',
      content: `Analyse this radio campaign data for ${brandName} over the last ${days} days.

STATION PERFORMANCE:
${stationLines}

DAYPART PERFORMANCE:
${daypartLines}

Provide:
## Daypart Efficiency Ranking
Rank the dayparts from most to least cost-efficient (by CPT) and explain what this means for ${brandName}'s reach goals.

## Delivery Alerts
Identify any stations or dayparts with underdelivery (below 80%). Suggest specific make-good strategies to recover the missed spots.

## Budget Reallocation
Based on CPT and delivery rates, recommend where to shift spend for better ROI. Be specific about which stations and dayparts.

## Key Recommendation
One clear, actionable next step for this radio campaign.`,
    }],
    maxTokens: 700,
  })

  return NextResponse.json({ analysis: text })
}
