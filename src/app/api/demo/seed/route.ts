import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const DEMO_EMAIL = 'demo@jarafoods.brandgauge.app'

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

  function makeSovRows(brandId: string, dayCount: number, brandBaseVolume: number, compVolumes: Record<string, number>) {
    return Array.from({ length: dayCount }, (_, i) => {
      const brandVol = Math.round(Math.max(100, brandBaseVolume + Math.sin(i / 7) * brandBaseVolume * 0.1 + (Math.random() - 0.5) * brandBaseVolume * 0.05))
      const competitorVolumes: Record<string, number> = {}
      for (const [name, baseVol] of Object.entries(compVolumes)) {
        competitorVolumes[name] = Math.round(Math.max(100, baseVol + Math.sin(i / 9) * baseVol * 0.08 + (Math.random() - 0.5) * baseVol * 0.06))
      }
      const totalVol = brandVol + Object.values(competitorVolumes).reduce((a, b) => a + b, 0)
      return {
        brand_id:        brandId,
        snapshot_date:   fmt(ago(dayCount - 1 - i)),
        social_sov:      Number(((brandVol / totalVol) * 100).toFixed(1)),
        competitor_data: {
          brand_volume:       brandVol,
          competitor_volumes: competitorVolumes,
        },
      }
    })
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

  const jaraFoodsSov = makeSovRows(primaryBrand.id, 90, 6500, {
    'Shoprite Nigeria':  10700,
    'Chicken Republic':  8000,
    'Kilimanjaro':       4800,
    'Dominos Nigeria':   3100,
    'HealthyFood.ng':    1200,
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
    const descTemplates = [
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
    const typeOpts = ['billboard', 'event', 'digital', 'print', 'tv', 'radio', 'activation', 'pr']
    const cities = ['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan']
    const states = ['Lagos State', 'FCT', 'Rivers State', 'Oyo State']

    const sightings = []
    for (const comp of comps.slice(0, 4)) {
      for (let i = 0; i < 3; i++) {
        const cityIdx = Math.floor(Math.random() * cities.length)
        const tpl = descTemplates[Math.floor(Math.random() * descTemplates.length)]
        sightings.push({
          brand_id:       primaryBrand.id,
          competitor_name: comp.name,
          sighting_type:  typeOpts[Math.floor(Math.random() * typeOpts.length)],
          scale:          scaleOpts[Math.floor(Math.random() * scaleOpts.length)],
          description:    tpl.replace('{comp}', comp.name),
          city:           cities[cityIdx],
          state:          states[cityIdx],
          spotted_at:     ago(Math.floor(Math.random() * 75)).toISOString().slice(0, 10),
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

  const expressSov = makeSovRows(expressId, 60, 3800, {
    'Chicken Republic': 14500,
    'Mr Biggs':          6500,
    'Kilimanjaro':       9500,
    'Dominos Nigeria':   4500,
  })
  await svc.from('sov_snapshots')
    .upsert(expressSov, { onConflict: 'brand_id,snapshot_date', ignoreDuplicates: false })
  results.push('jara_express_sov_60d')

  // Competitors for Jara Express
  const { data: expComps } = await svc
    .from('competitors').select('id, name').eq('brand_id', expressId).limit(1).maybeSingle()
  if (!expComps) {
    await svc.from('competitors').insert([
      { brand_id: expressId, name: 'Chicken Republic', website_url: 'https://chickenrepublic.com', social_handles: { twitter: '@ChickenRepublic' } },
      { brand_id: expressId, name: 'Mr Biggs',         website_url: null,                          social_handles: {} },
      { brand_id: expressId, name: 'Kilimanjaro',      website_url: null,                          social_handles: { twitter: '@KilimanjaroNG' } },
      { brand_id: expressId, name: 'Dominos Nigeria',  website_url: 'https://dominos.com.ng',      social_handles: { instagram: '@dominospizzang' } },
    ])
    results.push('jara_express_competitors')
  }

  // Competitor sightings for Jara Express
  const { data: expSightings } = await svc
    .from('competitor_sightings').select('id').eq('brand_id', expressId).limit(1).maybeSingle()
  if (!expSightings) {
    const expCompNames = ['Chicken Republic', 'Mr Biggs', 'Kilimanjaro', 'Dominos Nigeria']
    const expDescTemplates = [
      '{comp} running a "buy 2 get 1 free" promo at major Lagos branches — heavy foot traffic on social',
      'Spotted {comp} OOH campaign on Lekki-Epe Expressway — 4 consecutive boards, strong visual presence',
      '{comp} partnered with @FoodieNaija for a sponsored taste-test reel — 280k views in 24 hours',
      '{comp} opened a new drive-through branch in Ikeja GRA — grand opening event with live band',
      '{comp} launching an app-based loyalty scheme — push notifications visible on several brand monitors',
      '{comp} running aggressive pricing on combo meals — ₦2,500 lunch deal targeting office workers',
      '{comp} received a wave of complaints on X about cold deliveries — competitor vulnerability window',
    ]
    const exSightingRows = expCompNames.flatMap((name, ci) =>
      [0, 1, 2].map(i => ({
        brand_id:       expressId,
        competitor_name: name,
        sighting_type:  ['billboard', 'event', 'digital', 'activation', 'pr'][( ci * 3 + i) % 5],
        scale:          (['major', 'moderate', 'small'] as const)[(ci + i) % 3],
        description:    expDescTemplates[(ci * 3 + i) % expDescTemplates.length].replace('{comp}', name),
        city:           ['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan'][(ci + i) % 4],
        state:          ['Lagos State', 'FCT', 'Rivers State', 'Oyo State'][(ci + i) % 4],
        spotted_at:     ago(10 + (ci * 3 + i) * 8).toISOString().slice(0, 10),
      }))
    )
    await svc.from('competitor_sightings').insert(exSightingRows)
    results.push('jara_express_sightings')
  }

  // Weekly briefings for Jara Express
  const { data: expBriefings } = await svc
    .from('weekly_briefings').select('id').eq('brand_id', expressId).limit(1).maybeSingle()
  if (!expBriefings) {
    const expressBriefings = [
      {
        daysBack: 21,
        content: {
          title: 'Jara Express Competitive Briefing — Q2 Landscape',
          executive_summary: 'Jara Express holds 10.3% share of voice among tracked QSR competitors — growing but still significantly behind Chicken Republic (40.8%) and Kilimanjaro (26.6%). The primary opportunity is speed-of-service positioning, where competitor complaint volumes are rising on X.',
          sov_analysis: 'In the tracked QSR conversation, Chicken Republic dominates at 40.8% SOV, followed by Kilimanjaro (26.6%), Mr Biggs (18.1%), Dominos Nigeria (12.6%), and Jara Express at 10.3%. Jara Express ESOV of -6.1% reflects the gap between brand awareness investment and market presence — closing this gap is the central strategic challenge.',
          sentiment_vs_market: 'Jara Express sentiment (68.4/100) trails the tracked QSR average by an estimated 4 points. Chicken Republic commands strong sentiment driven by its loyalty programme. However, Jara Express outperforms on "speed" and "value" sub-themes in positive mentions.',
          porter_forces: {
            competitive_rivalry: 'VERY HIGH. The Lagos QSR market is saturated with well-funded incumbents. Chicken Republic and Kilimanjaro together hold 67% of tracked SOV.',
            threat_of_new_entrants: 'MEDIUM. Ghost kitchen operators and cloud restaurants are growing via Jumia Food and Bolt Food — they have low fixed costs and can undercut on pricing.',
            bargaining_power_buyers: 'HIGH. QSR customers have very low switching costs — proximity, speed, and price are the primary drivers. Loyalty is brand-built, not structural.',
            threat_of_substitutes: 'HIGH. Home cooking, bole and fish vendors, and mama-put restaurants all compete for the same lunch and dinner occasions.',
            overall_intensity: 'High',
          },
          brand_strengths: [
            'Strong "speed" and "value" mentions in positive UGC — outperforms category on these sub-themes',
            'Growing SOV — up 2.1 points over the past 60 days',
            'Untapped Northern Nigeria market where Chicken Republic has lower penetration',
          ],
          brand_vulnerabilities: [
            'SOV of 10.3% against Chicken Republic\'s 40.8% — significant awareness gap',
            'No loyalty programme — Chicken Republic\'s app-based scheme is driving repeat visits',
            'Limited social content output vs. Kilimanjaro which posts 2x per day on Instagram',
          ],
          competitor_threats: [
            'Chicken Republic loyalty app driving repeat purchase among Jara Express\'s core demographic',
            'Mr Biggs repositioning as a "modern Nigerian QSR" with revamped menu and store design',
            'Dominos Nigeria targeting office-delivery segment with lunchtime promotions — overlapping target',
          ],
          opportunities: [
            'Speed-of-service positioning: competitors are receiving delivery complaints — this is a direct opening',
            'Breakfast daypart: underserved by all tracked competitors — early morning commuter opportunity',
            'WhatsApp ordering: lower friction than app download, better retention for price-sensitive customers',
          ],
          recommendations: [
            { action: 'Launch "Faster than you think" positioning across Instagram and X', rationale: 'Competitor delivery complaints are peaking. Speed is the category pain point Jara Express can own authentically.', priority: 'High' as const },
            { action: 'Pilot WhatsApp ordering in 2 Lagos branches before app investment', rationale: 'WhatsApp penetration in Nigeria is near-universal. Lower friction than app download and faster to market than a loyalty app.', priority: 'High' as const },
            { action: 'Brief a micro-influencer (30-80k, food niche) for an unboxing series', rationale: 'Jara Express UGC is sparse. A 4-week influencer series at ₦150k total cost would triple organic content volume.', priority: 'Medium' as const },
          ],
          data_gaps: [
            'No TikTok listening — Kilimanjaro is growing there and Jara Express is absent',
            'No delivery-time data — hard to validate speed positioning without internal benchmarks',
            'Competitor market share figures are estimates — ESOV calculation indicative only',
          ],
          confidence: 'Medium' as const,
        },
      },
      {
        daysBack: 14,
        content: {
          title: 'Jara Express Competitive Briefing — Speed Positioning Week',
          executive_summary: 'Jara Express SOV climbed to 11.2% this week after a positive X thread about delivery speed went semi-viral. Chicken Republic\'s complaint volume rose 34% — a competitive window that should be captured before it closes.',
          sov_analysis: 'Jara Express SOV reached 11.2%, up 0.9 points. Chicken Republic dipped to 39.1% due to complaint-driven negative mentions. Kilimanjaro holds at 26.4%, Mr Biggs at 17.8%, Dominos Nigeria at 12.4%. The Chicken Republic complaint cycle typically lasts 7-10 days — act fast.',
          sentiment_vs_market: 'Jara Express sentiment improved to 70.1/100. The speed-related positive thread generated 180+ responses, most positive. Chicken Republic sentiment dropped to an estimated 58/100 on the back of delivery complaints. This is the largest sentiment gap in favour of Jara Express in 90 days.',
          porter_forces: {
            competitive_rivalry: 'HIGH but with a temporary opening. Chicken Republic complaint cycle creates a 7-10 day window for Jara Express to capture consideration.',
            threat_of_new_entrants: 'MEDIUM. Ghost kitchens continue to grow but are not yet converting Jara Express\'s core audience.',
            bargaining_power_buyers: 'HIGH. The complaint cycle proves buyers switch quickly when service quality dips — Jara Express needs to lock in switchers now.',
            threat_of_substitutes: 'MEDIUM this week. The speed narrative positions Jara Express above street food alternatives.',
            overall_intensity: 'High',
          },
          brand_strengths: [
            'Speed narrative gaining organic traction — semi-viral thread at 180k impressions',
            'SOV growing for the 3rd consecutive week',
            'Sentiment at 70.1/100, highest in 60 days',
          ],
          brand_vulnerabilities: [
            'No paid amplification behind the viral speed thread — organic momentum could stall',
            'Chicken Republic\'s complaint cycle will resolve in 7-10 days — window is narrow',
            'No loyalty mechanism to retain switchers once Chicken Republic recovers',
          ],
          competitor_threats: [
            'Chicken Republic will likely run a recovery promotion (discount or loyalty bonus) next week',
            'Kilimanjaro stable — could become the default beneficiary if Jara Express misses this window',
          ],
          opportunities: [
            'Boost the speed thread as a paid post immediately — capture consideration while Chicken Republic is down',
            'Run a "Switch and save" promotion this week targeting Chicken Republic\'s complaining audience on X',
            'Collect and publish delivery time data to own the speed claim with evidence',
          ],
          recommendations: [
            { action: 'Boost the speed thread as paid social (₦80k, 72-hour burst)', rationale: 'Organic reach is 180k — paid can 4x that for ₦80k. This is the highest-ROI spend available this week.', priority: 'High' as const },
            { action: 'DM 20 Chicken Republic complainers on X with a trial offer', rationale: 'These are actively dissatisfied, switcher-ready customers. Outreach has near-zero cost and high conversion potential.', priority: 'High' as const },
            { action: 'Begin tracking internal delivery times by branch to validate speed claim', rationale: 'The speed narrative will face scrutiny. Evidence protects the claim and creates a sustainable positioning asset.', priority: 'Medium' as const },
          ],
          data_gaps: [
            'Internal delivery time data not yet captured',
            'No Instagram listening for Kilimanjaro — second-largest competitor is partially blind',
          ],
          confidence: 'High' as const,
        },
      },
      {
        daysBack: 7,
        content: {
          title: 'Jara Express Competitive Briefing — Post-Speed Push',
          executive_summary: 'Jara Express SOV reached 11.8% — highest on record. The paid speed boost drove 740k impressions and 3.2k link clicks. Chicken Republic has launched a "Sorry for the wait" recovery promotion. Window is closing but retention of acquired consideration is the priority.',
          sov_analysis: 'Jara Express SOV: 11.8% (up 0.6 points). Chicken Republic recovering to 40.2% on the back of recovery promotion. Kilimanjaro 26.1%, Mr Biggs 17.4%, Dominos 12.3%. The speed window has narrowed but the SOV gain is holding — Jara Express needs to sustain content output to defend its new position.',
          sentiment_vs_market: 'Jara Express sentiment (71.3/100) is at its 90-day high. Chicken Republic has recovered to an estimated 63/100 following its apology promotion. The sentiment gap has narrowed but Jara Express is still ahead. Positive "value" mentions rising alongside speed mentions for the first time.',
          porter_forces: {
            competitive_rivalry: 'HIGH. Chicken Republic recovery promotion is effective — the complaint cycle is closing. Jara Express needs to hold ground through consistent content and service quality.',
            threat_of_new_entrants: 'MEDIUM. No significant new entrant activity this week.',
            bargaining_power_buyers: 'HIGH. Chicken Republic\'s apology promotion (10% off) is recapturing switchers. Price sensitivity remains a key driver.',
            threat_of_substitutes: 'MEDIUM. Stable.',
            overall_intensity: 'High',
          },
          brand_strengths: [
            'SOV at 11.8% — a new record for Jara Express',
            'Sentiment at 71.3/100, 90-day high — positive "value" theme emerging alongside speed',
            'Paid boost delivered 740k impressions, 3.2k clicks at ₦108 CPC — strong efficiency',
          ],
          brand_vulnerabilities: [
            'Chicken Republic recovery promotion is effective — switchers may return',
            'No loyalty mechanism to retain newly acquired customers',
            'Content cadence dropped after the boost — SOV may retrace without sustained output',
          ],
          competitor_threats: [
            'Chicken Republic "Sorry for the wait" promo offering 10% off — actively recapturing switchers',
            'Mr Biggs relaunching revamped stores in Yaba and Ikeja — brand refresh incoming',
          ],
          opportunities: [
            'Launch a simple WhatsApp loyalty stamp — 5 orders, 1 free — to lock in switchers before Chicken Republic recovers',
            'Double content frequency for the next 2 weeks to defend the SOV gain',
            'Target the breakfast daypart: none of the top 4 competitors are actively owning early morning',
          ],
          recommendations: [
            { action: 'Launch WhatsApp loyalty stamp programme within 72 hours', rationale: 'Switchers are still warm. A simple "5 stamps, 1 free" scheme has been proven to lift repeat purchase by 28% in Lagos QSR pilots. App not needed — WhatsApp number works.', priority: 'High' as const },
            { action: 'Post 1 piece of original content per day for the next 14 days', rationale: 'SOV gains decay without content. At Jara Express\'s current size, 1 daily post sustains SOV better than burst-and-pause.', priority: 'High' as const },
            { action: 'Test a breakfast combo promoted post targeting Lagos Island office workers', rationale: 'No competitor is owning breakfast. A ₦50k test post would reveal demand with minimal risk.', priority: 'Medium' as const },
          ],
          data_gaps: [
            'WhatsApp loyalty data not yet captured — launching this week will create first baseline',
            'Breakfast daypart demand unquantified — needs a test before full commitment',
            'No TikTok measurement — Kilimanjaro\'s Gen-Z traction on the platform remains a blind spot',
          ],
          confidence: 'High' as const,
        },
      },
    ]

    for (const b of expressBriefings) {
      await svc.from('weekly_briefings').insert({
        brand_id:   expressId,
        week_start: ago(b.daysBack).toISOString().slice(0, 10),
        content:    b.content,
        sent_at:    ago(b.daysBack - 1).toISOString(),
      })
    }
    results.push('jara_express_briefings')
  }

  return NextResponse.json({
    ok:          true,
    primaryBrand: primaryBrand.name,
    secondBrand: 'Jara Express',
    expressId,
    seeded:      results,
  })
}
