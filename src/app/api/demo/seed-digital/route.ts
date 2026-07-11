import { NextRequest, NextResponse } from 'next/server'
import { createClient }               from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// Gated by the shared ADMIN_SECRET env var (fail closed if unset).
const SEED_SECRET = process.env.ADMIN_SECRET

type Platform = 'meta' | 'google'
type Campaign = { id: string; name: string }

const META_CAMPAIGNS: Campaign[] = [
  { id: 'meta_camp_001', name: 'Jara Foods — Awareness Q2' },
  { id: 'meta_camp_002', name: 'Jara Foods — Conversion Drive' },
  { id: 'meta_camp_003', name: 'Jara Foods — Retargeting' },
]

const GOOGLE_CAMPAIGNS: Campaign[] = [
  { id: 'goog_camp_001', name: 'Jara Foods — Search Awareness' },
  { id: 'goog_camp_002', name: 'Jara Foods — Shopping Conversion' },
  { id: 'goog_camp_003', name: 'Jara Foods — Display Retargeting' },
]

const META_ADSETS: Record<string, string[]> = {
  meta_camp_001: ['Lagos Awareness 25-34', 'Abuja Awareness 25-44'],
  meta_camp_002: ['Lagos Converters', 'Abuja Converters'],
  meta_camp_003: ['Website Retarget 7d', 'App Retarget 14d'],
}

const GOOGLE_ADSETS: Record<string, string[]> = {
  goog_camp_001: ['Brand Search Terms', 'Generic Food Search'],
  goog_camp_002: ['Shopping — All Products', 'Shopping — Bestsellers'],
  goog_camp_003: ['GDN Retarget — 7d', 'YouTube Retarget — 14d'],
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max))
}

interface DailyRow {
  brand_id:      string
  platform:      Platform
  date:          string
  campaign_id:   string
  campaign_name: string
  adset_id:      string
  adset_name:    string
  spend:         number
  impressions:   number
  reach:         number
  clicks:        number
  ctr:           number
  cpm:           number
  cpc:           number
  cpa:           number | null
  roas:          number | null
  frequency:     number
  video_views:   number | null
  video_view_rate: number | null
  conversions:   number
  currency:      string
}

function generateDays(brandId: string): DailyRow[] {
  const rows: DailyRow[] = []
  const today = new Date()

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().slice(0, 10)

    // Meta rows
    for (const campaign of META_CAMPAIGNS) {
      const adsetNames = META_ADSETS[campaign.id] ?? []
      for (let ai = 0; ai < adsetNames.length; ai++) {
        const adsetName = adsetNames[ai]
        const adsetId   = `${campaign.id}_adset_${ai}`

        // Realistic Nigerian Meta Ads metrics
        const spend       = parseFloat(rand(24000, 35000).toFixed(2)) / META_CAMPAIGNS.length / adsetNames.length
        const impressions = Math.floor(randInt(50000, 80000) / META_CAMPAIGNS.length / adsetNames.length)
        const ctr         = parseFloat(rand(0.018, 0.028).toFixed(4))
        const clicks      = Math.floor(impressions * ctr)
        const cpm         = parseFloat(rand(380, 520).toFixed(2))
        const cpc         = clicks > 0 ? parseFloat((spend / clicks).toFixed(2)) : 0
        const reach       = Math.floor(impressions * rand(0.75, 0.92))
        const frequency   = parseFloat(rand(1.1, 2.4).toFixed(2))
        const conversions = randInt(0, 8)
        const cpa         = conversions > 0 ? parseFloat((spend / conversions).toFixed(2)) : null
        const roas        = conversions > 0 ? parseFloat(rand(1.8, 4.2).toFixed(4)) : null
        const videoViews  = campaign.name.includes('Awareness') ? randInt(8000, 25000) : null
        const videoViewRate = videoViews !== null ? parseFloat((videoViews / impressions).toFixed(4)) : null

        rows.push({
          brand_id:      brandId,
          platform:      'meta',
          date:          dateStr,
          campaign_id:   campaign.id,
          campaign_name: campaign.name,
          adset_id:      adsetId,
          adset_name:    adsetName,
          spend,
          impressions,
          reach,
          clicks,
          ctr,
          cpm,
          cpc,
          cpa,
          roas,
          frequency,
          video_views:   videoViews,
          video_view_rate: videoViewRate,
          conversions,
          currency:      'NGN',
        })
      }
    }

    // Google rows
    for (const campaign of GOOGLE_CAMPAIGNS) {
      const adsetNames = GOOGLE_ADSETS[campaign.id] ?? []
      for (let ai = 0; ai < adsetNames.length; ai++) {
        const adsetName = adsetNames[ai]
        const adsetId   = `${campaign.id}_adset_${ai}`

        const spend       = parseFloat(rand(15000, 22000).toFixed(2)) / GOOGLE_CAMPAIGNS.length / adsetNames.length
        const impressions = Math.floor(randInt(30000, 50000) / GOOGLE_CAMPAIGNS.length / adsetNames.length)
        const ctr         = parseFloat(rand(0.021, 0.032).toFixed(4))
        const clicks      = Math.floor(impressions * ctr)
        const cpm         = parseFloat(rand(320, 450).toFixed(2))
        const cpc         = clicks > 0 ? parseFloat((spend / clicks).toFixed(2)) : 0
        const reach       = Math.floor(impressions * rand(0.70, 0.88))
        const frequency   = parseFloat(rand(1.0, 1.8).toFixed(2))
        const conversions = randInt(0, 6)
        const cpa         = conversions > 0 ? parseFloat((spend / conversions).toFixed(2)) : null
        const roas        = conversions > 0 ? parseFloat(rand(2.0, 5.1).toFixed(4)) : null

        rows.push({
          brand_id:      brandId,
          platform:      'google',
          date:          dateStr,
          campaign_id:   campaign.id,
          campaign_name: campaign.name,
          adset_id:      adsetId,
          adset_name:    adsetName,
          spend,
          impressions,
          reach,
          clicks,
          ctr,
          cpm,
          cpc,
          cpa,
          roas,
          frequency,
          video_views:   null,
          video_view_rate: null,
          conversions,
          currency:      'NGN',
        })
      }
    }
  }

  return rows
}

const DEMO_EMAIL = 'demo@jarafoods.brandgauge.app'

export async function POST(req: NextRequest) {
  const isAdminSeed = !!SEED_SECRET && req.headers.get('x-seed-secret') === SEED_SECRET

  let brandId: string

  if (isAdminSeed) {
    // Secret-based path: use service role to find the demo brand directly
    const sb = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const { data: users } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 })
    const demoUser = users?.users?.find(u => u.email === DEMO_EMAIL)
    if (!demoUser) return NextResponse.json({ error: 'Demo user not found' }, { status: 404 })

    const { data: member } = await sb
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', demoUser.id)
      .limit(1)
      .single()
    if (!member) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

    const { data: brand } = await sb
      .from('brands')
      .select('id')
      .eq('workspace_id', member.workspace_id)
      .limit(1)
      .single()
    if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

    brandId = brand.id

    // Always wipe and reseed when called with the secret
    await sb.from('digital_performance_daily').delete().eq('brand_id', brandId)

    const rows = generateDays(brandId)
    const { error: insertErr } = await sb.from('digital_performance_daily').insert(rows)
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

    return NextResponse.json({ success: true, inserted: rows.length, brand_id: brandId })
  }

  // Session-based path: user must be logged in as the demo account
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.email !== DEMO_EMAIL) return NextResponse.json({ error: 'Not a demo account' }, { status: 403 })

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  brandId = brand.id

  // Skip if data already exists for the last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const { data: existing } = await supabase
    .from('digital_performance_daily')
    .select('id')
    .eq('brand_id', brandId)
    .gte('date', thirtyDaysAgo.toISOString().slice(0, 10))
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ success: true, skipped: true, message: 'Demo data already exists' })
  }

  const rows = generateDays(brandId)
  const { error: insertErr } = await supabase.from('digital_performance_daily').insert(rows)
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  return NextResponse.json({ success: true, inserted: rows.length, brand_id: brandId })
}
