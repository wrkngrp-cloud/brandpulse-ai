import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const DEMO_EMAIL = 'demo@jarafoods.brandpulse.ai'

// Idempotent — safe to call multiple times. Upserts data so re-running
// extends all series up to today without duplicating rows.
export async function POST() {
  const supabase  = await createClient()
  const svc       = await createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== DEMO_EMAIL) {
    return NextResponse.json({ error: 'Demo-only endpoint' }, { status: 403 })
  }

  const { data: member } = await svc
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1).maybeSingle()

  if (!member) return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
  const wsId = member.workspace_id

  const { data: primaryBrand } = await svc
    .from('brands')
    .select('id, name')
    .eq('workspace_id', wsId)
    .order('created_at', { ascending: true })
    .limit(1).maybeSingle()

  if (!primaryBrand) return NextResponse.json({ error: 'No primary brand found' }, { status: 400 })

  const today  = new Date()
  const fmt    = (d: Date) => d.toISOString().slice(0, 10)
  const ago    = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return d }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function makeBhiRows(brandId: string, dayCount: number, baseScore: number, growthRate: number) {
    return Array.from({ length: dayCount }, (_, i) => {
      const base  = baseScore + Math.sin(i / 10) * 5 + (i / dayCount) * growthRate
      const noise = (Math.random() - 0.5) * 3
      const bhi   = Math.min(100, Math.max(20, base + noise))
      return {
        brand_id:      brandId,
        snapshot_date: fmt(ago(dayCount - 1 - i)),
        bhi,
        components: {
          sentiment: Math.min(100, Math.max(0, bhi * 0.85 + (Math.random() - 0.5) * 6)),
          sov:       Math.min(100, Math.max(0, bhi * 0.75 + (Math.random() - 0.5) * 8)),
          survey:    Math.min(100, Math.max(0, bhi * 0.9  + (Math.random() - 0.5) * 5)),
        },
      }
    })
  }

  function makeSentimentRows(brandId: string, dayCount: number, baseScore: number) {
    return Array.from({ length: dayCount }, (_, i) => {
      const base = baseScore + Math.cos(i / 12) * 7 + (i / dayCount) * 8
      const score = Math.min(100, Math.max(20, base + (Math.random() - 0.5) * 5))
      const pos   = Math.min(95, score + 8)
      const neg   = Math.max(5, 100 - pos - 22)
      const neu   = Math.max(0, 100 - pos - neg)
      return {
        brand_id:     brandId,
        day:          fmt(ago(dayCount - 1 - i)),
        social_score: score,
        positive_pct: pos,
        negative_pct: neg,
        neutral_pct:  neu,
        platform_breakdown: {
          twitter:   { volume: 60  + Math.floor(Math.random() * 50), score: score * 0.94, positive_pct: pos,     negative_pct: neg,     neutral_pct: neu     },
          instagram: { volume: 110 + Math.floor(Math.random() * 70), score: score * 1.06, positive_pct: pos + 4, negative_pct: neg - 3, neutral_pct: neu - 1 },
        },
      }
    })
  }

  function makeSovRows(brandId: string, dayCount: number, baseSov: number, compData: Record<string, number>) {
    return Array.from({ length: dayCount }, (_, i) => ({
      brand_id:        brandId,
      snapshot_date:   fmt(ago(dayCount - 1 - i)),
      social_sov:      Math.min(50, Math.max(2, baseSov + Math.sin(i / 7) * 2 + (Math.random() - 0.5))),
      competitor_data: Object.fromEntries(
        Object.entries(compData).map(([k, v]) => [k, Math.max(2, v + Math.sin(i / 9) * 2 + (Math.random() - 0.5) * 1.5)])
      ),
    }))
  }

  const results: string[] = []

  // ─────────────────────────────────────────────────────────────────────────
  // PRIMARY BRAND: Jara Foods — 180 days BHI + 180 days sentiment + 90 days SOV
  // ─────────────────────────────────────────────────────────────────────────

  const jaraFoodsBhi = makeBhiRows(primaryBrand.id, 180, 58, 12)
  const { error: jfBhiErr } = await svc
    .from('brand_health_snapshots')
    .upsert(jaraFoodsBhi, { onConflict: 'brand_id,snapshot_date', ignoreDuplicates: false })
  if (!jfBhiErr) results.push('jara_foods_bhi_180d')

  const jaraFoodsSentiment = makeSentimentRows(primaryBrand.id, 180, 60)
  const { error: jfSentErr } = await svc
    .from('sentiment_daily')
    .upsert(jaraFoodsSentiment, { onConflict: 'brand_id,day', ignoreDuplicates: false })
  if (!jfSentErr) results.push('jara_foods_sentiment_180d')

  const jaraFoodsSov = makeSovRows(primaryBrand.id, 90, 18.5, {
    'Shoprite Nigeria':  31,
    'Chicken Republic':  23,
    'Kilimanjaro':       14,
    'Dominos Nigeria':   9,
    'HealthyFood.ng':    3.5,
  })
  const { error: jfSovErr } = await svc
    .from('sov_snapshots')
    .upsert(jaraFoodsSov, { onConflict: 'brand_id,snapshot_date', ignoreDuplicates: false })
  if (!jfSovErr) results.push('jara_foods_sov_90d')

  // ─────────────────────────────────────────────────────────────────────────
  // COMPETITORS for primary brand
  // ─────────────────────────────────────────────────────────────────────────

  const { data: existingComps } = await svc
    .from('competitors')
    .select('id, name')
    .eq('brand_id', primaryBrand.id)

  if (!existingComps || existingComps.length === 0) {
    await svc.from('competitors').insert([
      { brand_id: primaryBrand.id, name: 'Shoprite Nigeria',  website_url: 'https://shoprite.com.ng',     social_handles: { twitter: '@ShopriteSA',       instagram: '@shopritenigeria'  } },
      { brand_id: primaryBrand.id, name: 'Chicken Republic',  website_url: 'https://chickenrepublic.com', social_handles: { twitter: '@ChickenRepublic',  instagram: '@chickenrepublic'  } },
      { brand_id: primaryBrand.id, name: 'Kilimanjaro',       website_url: null,                          social_handles: { twitter: '@KilimanjaroNG' } },
      { brand_id: primaryBrand.id, name: 'Dominos Nigeria',   website_url: 'https://dominos.com.ng',      social_handles: { instagram: '@dominospizzang' } },
      { brand_id: primaryBrand.id, name: 'HealthyFood.ng',    website_url: null,                          social_handles: {} },
    ])
    results.push('jara_foods_competitors')
  }

  // Fetch competitors for sightings
  const { data: comps } = await svc
    .from('competitors')
    .select('id, name')
    .eq('brand_id', primaryBrand.id)

  // Competitor sightings
  const { data: existingSightings } = await svc
    .from('competitor_sightings')
    .select('id').eq('brand_id', primaryBrand.id).limit(1).maybeSingle()

  if (!existingSightings && comps && comps.length > 0) {
    const noteTemplates = [
      '{comp} launched a loyalty programme via WhatsApp — 200+ sign-ups seen on social in 48 hrs',
      'Saw {comp} billboard at Maryland overhead bridge and Ojodu Berger. Heavy Q2 OOH push.',
      '{comp} running 50% off promo on Instagram — high engagement, 3k+ comments in first hour',
      '@foodlovers_ng (180k followers) posted a paid review of {comp}. Likely NGN 400k+ placement.',
      '{comp} paused TV spots for 3 weeks — probable budget shift to digital for the quarter',
      '{comp} receiving delivery-delay complaints on X — potential window for our operational messaging',
      '{comp} activated a mega activation at Lekki Festival — crowd sampling + influencer presence',
      '{comp} launched a new loyalty app with cashback scheme — targeting our repeat-purchase segment',
    ]
    const scaleOpts: ('major' | 'moderate' | 'small')[] = ['major', 'moderate', 'small']
    const typeOpts = ['campaign', 'pricing', 'ooh', 'influencer', 'social', 'activation', 'pr']

    const sightings = []
    for (const comp of comps.slice(0, 4)) {
      for (let i = 0; i < 3; i++) {
        const tpl = noteTemplates[Math.floor(Math.random() * noteTemplates.length)]
        sightings.push({
          brand_id:        primaryBrand.id,
          competitor_id:   comp.id,
          observation_type: typeOpts[Math.floor(Math.random() * typeOpts.length)],
          scale:           scaleOpts[Math.floor(Math.random() * scaleOpts.length)],
          notes:           tpl.replace('{comp}', comp.name),
          occurred_at:     ago(Math.floor(Math.random() * 75)).toISOString(),
        })
      }
    }
    await svc.from('competitor_sightings').insert(sightings)
    results.push('jara_foods_sightings')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECOND BRAND: Jara Express
  // ─────────────────────────────────────────────────────────────────────────

  let expressId: string
  const { data: existingExpress } = await svc
    .from('brands')
    .select('id')
    .eq('workspace_id', wsId)
    .eq('name', 'Jara Express')
    .maybeSingle()

  if (existingExpress) {
    expressId = existingExpress.id
  } else {
    const { data: newBrand, error: brandErr } = await svc
      .from('brands')
      .insert({
        workspace_id:     wsId,
        name:             'Jara Express',
        category:         'Quick-Service Restaurant',
        market_share_pct: 4.2,
        // brand_voice is jsonb — pass object directly, NOT JSON.stringify
        brand_voice: {
          adjectives:       ['Fresh', 'Fast', 'Everyday'],
          tone:             'Friendly and relatable — the food brand that feels like home delivery from mum',
          dos:              ['Use casual Lagos-friendly language', 'Celebrate Nigerian occasions', 'Lead with value and speed'],
          donts:            ['Avoid corporate jargon', 'Never promise delivery times you cannot keep', 'Do not use stock-photo food imagery'],
          signaturePhrases: ['Order in, enjoy out', 'Good food, faster', 'Your hunger sorted'],
          confidenceNote:   'Demo brand voice — update with real content samples for live accuracy',
        },
        cultural_profile: { community_corporate: 30, traditional_modern: 65, religious_secular: 50, mass_premium: 35, local_global: 25 },
      })
      .select('id').single()

    if (brandErr || !newBrand) {
      return NextResponse.json({ error: `Failed to create Jara Express: ${brandErr?.message ?? 'unknown'}` }, { status: 500 })
    }
    expressId = newBrand.id
    results.push('jara_express_brand_created')
  }

  // BHI + sentiment + SOV for Jara Express (90 days up to today)
  const expressBhi = makeBhiRows(expressId, 90, 52, 10)
  await svc.from('brand_health_snapshots')
    .upsert(expressBhi, { onConflict: 'brand_id,snapshot_date', ignoreDuplicates: false })
  results.push('jara_express_bhi_90d')

  const expressSentiment = makeSentimentRows(expressId, 90, 55)
  await svc.from('sentiment_daily')
    .upsert(expressSentiment, { onConflict: 'brand_id,day', ignoreDuplicates: false })
  results.push('jara_express_sentiment_90d')

  const expressSov = makeSovRows(expressId, 60, 8, {
    'Chicken Republic': 29,
    'Mr Biggs':         13,
    'Kilimanjaro':      19,
    'Dominos Nigeria':  9,
  })
  await svc.from('sov_snapshots')
    .upsert(expressSov, { onConflict: 'brand_id,snapshot_date', ignoreDuplicates: false })
  results.push('jara_express_sov_60d')

  // Competitors for Jara Express
  const { data: expComps } = await svc
    .from('competitors').select('id').eq('brand_id', expressId).limit(1).maybeSingle()
  if (!expComps) {
    await svc.from('competitors').insert([
      { brand_id: expressId, name: 'Chicken Republic', website_url: 'https://chickenrepublic.com', social_handles: { twitter: '@ChickenRepublic' } },
      { brand_id: expressId, name: 'Mr Biggs',         website_url: null,                          social_handles: {} },
      { brand_id: expressId, name: 'Kilimanjaro',      website_url: null,                          social_handles: { twitter: '@KilimanjaroNG' } },
      { brand_id: expressId, name: 'Dominos Nigeria',  website_url: 'https://dominos.com.ng',      social_handles: { instagram: '@dominospizzang' } },
    ])
    results.push('jara_express_competitors')
  }

  return NextResponse.json({
    ok:          true,
    primaryBrand: primaryBrand.name,
    secondBrand: 'Jara Express',
    expressId,
    seeded:      results,
  })
}
