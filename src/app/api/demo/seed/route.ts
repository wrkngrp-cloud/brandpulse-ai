import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const DEMO_EMAIL = 'demo@jarafoods.brandpulse.ai'

// All seed data is scoped to the demo workspace only.
// This endpoint is idempotent — safe to call multiple times.
export async function POST() {
  const supabase   = await createClient()
  const svcClient  = await createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== DEMO_EMAIL) {
    return NextResponse.json({ error: 'Demo-only endpoint' }, { status: 403 })
  }

  // Resolve demo workspace
  const { data: member } = await svcClient
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1).maybeSingle()

  if (!member) return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
  const wsId = member.workspace_id

  // Resolve primary brand (Jara Foods)
  const { data: primaryBrand } = await svcClient
    .from('brands')
    .select('id, name')
    .eq('workspace_id', wsId)
    .order('created_at', { ascending: true })
    .limit(1).maybeSingle()

  if (!primaryBrand) return NextResponse.json({ error: 'No primary brand found' }, { status: 400 })

  // ── Second brand: Jara Express ──────────────────────────────────────────
  let expressId: string
  const { data: existingExpress } = await svcClient
    .from('brands')
    .select('id')
    .eq('workspace_id', wsId)
    .eq('name', 'Jara Express')
    .maybeSingle()

  if (existingExpress) {
    expressId = existingExpress.id
  } else {
    const { data: newBrand, error: brandErr } = await svcClient
      .from('brands')
      .insert({
        workspace_id:      wsId,
        name:              'Jara Express',
        category:          'Quick-Service Restaurant',
        market_share_pct:  4.2,
        brand_voice: JSON.stringify({
          adjectives:        ['Fresh', 'Fast', 'Everyday'],
          tone:              'Friendly and relatable — the food brand that feels like home delivery from mum',
          dos:               ['Use casual Lagos-friendly language', 'Celebrate Nigerian occasions', 'Lead with value and speed'],
          donts:             ['Avoid corporate jargon', 'Never promise delivery times you cannot keep', 'Do not use stock-photo food imagery'],
          signaturePhrases:  ['Order in, enjoy out', 'Good food, faster', 'Your hunger sorted'],
          confidenceNote:    'Demo brand voice — update with real content samples for live accuracy',
        }),
        connected_channels: ['instagram', 'twitter'],
      })
      .select('id').single()

    if (brandErr || !newBrand) return NextResponse.json({ error: 'Failed to create second brand' }, { status: 500 })
    expressId = newBrand.id
  }

  const today = new Date()
  const fmt   = (d: Date) => d.toISOString().slice(0, 10)

  // Helper to generate a date n days ago
  const daysAgo = (n: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() - n)
    return d
  }

  // ── Seed BHI snapshots for Jara Express ────────────────────────────────
  const { data: existingBhi } = await svcClient
    .from('brand_health_snapshots')
    .select('id').eq('brand_id', expressId).limit(1).maybeSingle()

  if (!existingBhi) {
    const bhiRows = Array.from({ length: 90 }, (_, i) => {
      const base = 52 + Math.sin(i / 8) * 6 + (i / 90) * 10
      const noise = (Math.random() - 0.5) * 4
      const bhi = Math.min(100, Math.max(0, base + noise))
      return {
        brand_id:      expressId,
        snapshot_date: fmt(daysAgo(89 - i)),
        bhi,
        components:    { sentiment: bhi * 0.9, sov: 8 + Math.random() * 4, reach: 12000 + Math.floor(Math.random() * 5000) },
      }
    })
    await svcClient.from('brand_health_snapshots').insert(bhiRows)
  }

  // ── Seed sentiment daily for Jara Express ──────────────────────────────
  const { data: existingSentiment } = await svcClient
    .from('sentiment_daily')
    .select('id').eq('brand_id', expressId).limit(1).maybeSingle()

  if (!existingSentiment) {
    const sentRows = Array.from({ length: 90 }, (_, i) => {
      const base = 58 + Math.cos(i / 12) * 8 + (i / 90) * 7
      const pos  = Math.min(95, base + 10)
      const neg  = Math.max(5, 100 - pos - 20)
      const neu  = Math.max(0, 100 - pos - neg)
      return {
        brand_id:     expressId,
        day:          fmt(daysAgo(89 - i)),
        social_score: Math.min(100, Math.max(0, base + (Math.random() - 0.5) * 5)),
        positive_pct: pos,
        negative_pct: neg,
        neutral_pct:  neu,
        platform_breakdown: {
          twitter:   { volume: 80 + Math.floor(Math.random() * 40),  score: base * 0.95, positive_pct: pos,     negative_pct: neg,     neutral_pct: neu     },
          instagram: { volume: 120 + Math.floor(Math.random() * 60), score: base * 1.05, positive_pct: pos + 3, negative_pct: neg - 2, neutral_pct: neu - 1 },
        },
      }
    })
    await svcClient.from('sentiment_daily').insert(sentRows)
  }

  // ── Seed SOV snapshots for Jara Express ────────────────────────────────
  const { data: existingSov } = await svcClient
    .from('sov_snapshots')
    .select('id').eq('brand_id', expressId).limit(1).maybeSingle()

  if (!existingSov) {
    const sovRows = Array.from({ length: 30 }, (_, i) => ({
      brand_id:      expressId,
      snapshot_date: fmt(daysAgo(29 - i)),
      social_sov:    7 + Math.sin(i / 5) * 2 + (Math.random() - 0.5),
      competitor_data: {
        'Chicken Republic': 28 + Math.random() * 3,
        'Kilimanjaro':      18 + Math.random() * 4,
        'Mr Biggs':         12 + Math.random() * 3,
        'Dominos Nigeria':  8  + Math.random() * 2,
      },
    }))
    await svcClient.from('sov_snapshots').insert(sovRows)
  }

  // ── Seed competitors for primary brand (Jara Foods) ────────────────────
  const { data: existingComp } = await svcClient
    .from('competitors')
    .select('id').eq('brand_id', primaryBrand.id).limit(1).maybeSingle()

  if (!existingComp) {
    await svcClient.from('competitors').insert([
      { brand_id: primaryBrand.id, name: 'Shoprite Nigeria',  website_url: 'https://shoprite.com.ng',     social_handles: { twitter: '@ShopriteSA', instagram: '@shopritenigeria' } },
      { brand_id: primaryBrand.id, name: 'Chicken Republic',  website_url: 'https://chickenrepublic.com', social_handles: { twitter: '@ChickenRepublic', instagram: '@chickenrepublic' } },
      { brand_id: primaryBrand.id, name: 'Kilimanjaro',       website_url: null,                          social_handles: { twitter: '@KilimanjaroNG' } },
      { brand_id: primaryBrand.id, name: 'Dominos Nigeria',   website_url: 'https://dominos.com.ng',      social_handles: { instagram: '@dominospizzang' } },
      { brand_id: primaryBrand.id, name: 'HealthyFood.ng',    website_url: null,                          social_handles: {} },
    ])
  }

  // ── Seed competitors for Jara Express ─────────────────────────────────
  const { data: existingExpressComp } = await svcClient
    .from('competitors')
    .select('id').eq('brand_id', expressId).limit(1).maybeSingle()

  if (!existingExpressComp) {
    await svcClient.from('competitors').insert([
      { brand_id: expressId, name: 'Chicken Republic', website_url: 'https://chickenrepublic.com', social_handles: { twitter: '@ChickenRepublic' } },
      { brand_id: expressId, name: 'Mr Biggs',         website_url: null,                          social_handles: {} },
      { brand_id: expressId, name: 'Kilimanjaro',      website_url: null,                          social_handles: { twitter: '@KilimanjaroNG' } },
      { brand_id: expressId, name: 'Dominos Nigeria',  website_url: 'https://dominos.com.ng',      social_handles: { instagram: '@dominospizzang' } },
    ])
  }

  // ── Seed competitive sightings for primary brand ───────────────────────
  const { data: primaryComps } = await svcClient
    .from('competitors').select('id, name').eq('brand_id', primaryBrand.id)

  if (primaryComps && primaryComps.length > 0) {
    const { data: existingSightings } = await svcClient
      .from('competitor_sightings')
      .select('id').eq('brand_id', primaryBrand.id).limit(1).maybeSingle()

    if (!existingSightings) {
      const noteTemplates = [
        '{comp} launched a loyalty rewards programme targeting Lagos Island — push notification + WhatsApp blast observed',
        'Saw {comp} billboard at Maryland overhead bridge. Heavy OOH spend this quarter.',
        '{comp} ran 50% off promo via WhatsApp broadcast. ~200 leads in 48 hours based on social noise.',
        '@foodlovers_ng (180k) posted a positive review of {comp}. Likely paid placement.',
        '{comp} appears to have paused TV ads this month — possible budget reallocation to digital.',
        '{comp} received multiple delivery-delay complaints on Twitter. Window of opportunity for service differentiation.',
      ]

      const scaleOptions: ('major' | 'moderate' | 'small')[] = ['major', 'moderate', 'small']
      const typeOptions = ['campaign', 'pricing', 'ooh', 'influencer', 'social', 'pr']

      const sightings = []
      for (const comp of primaryComps.slice(0, 3)) {
        for (let i = 0; i < 2; i++) {
          const noteTemplate = noteTemplates[Math.floor(Math.random() * noteTemplates.length)]
          sightings.push({
            brand_id:        primaryBrand.id,
            competitor_id:   comp.id,
            observation_type: typeOptions[Math.floor(Math.random() * typeOptions.length)],
            scale:           scaleOptions[Math.floor(Math.random() * scaleOptions.length)],
            notes:           noteTemplate.replace('{comp}', comp.name),
            occurred_at:     daysAgo(Math.floor(Math.random() * 60)).toISOString(),
          })
        }
      }
      await svcClient.from('competitor_sightings').insert(sightings)
    }
  }

  // ── Seed SOV for primary brand if missing ─────────────────────────────
  const { data: primarySov } = await svcClient
    .from('sov_snapshots').select('id').eq('brand_id', primaryBrand.id).limit(1).maybeSingle()

  if (!primarySov) {
    const primarySovRows = Array.from({ length: 30 }, (_, i) => ({
      brand_id:      primaryBrand.id,
      snapshot_date: fmt(daysAgo(29 - i)),
      social_sov:    18 + Math.sin(i / 5) * 3 + (Math.random() - 0.5) * 2,
      competitor_data: {
        'Shoprite Nigeria':  32 + Math.random() * 4,
        'Chicken Republic':  22 + Math.random() * 5,
        'Kilimanjaro':       14 + Math.random() * 3,
        'Dominos Nigeria':   10 + Math.random() * 2,
        'HealthyFood.ng':    3  + Math.random(),
      },
    }))
    await svcClient.from('sov_snapshots').insert(primarySovRows)
  }

  return NextResponse.json({
    ok:          true,
    primaryBrand: primaryBrand.name,
    secondBrand: 'Jara Express',
    expressId,
    seeded:      ['bhi_snapshots', 'sentiment_daily', 'sov_snapshots', 'competitors', 'competitor_sightings'],
  })
}
