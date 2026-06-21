import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CompetitiveClient } from './competitive-client'
import { getActiveBrand } from '@/lib/active-brand'

export default async function CompetitivePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const brand = await getActiveBrand<{ id: string; name: string; category: string | null; market_share_pct: number | null }>(supabase, 'id, name, category, market_share_pct')

  if (!brand) redirect('/dashboard')

  const service = await createServiceClient()

  const [
    { data: competitors },
    { data: sovSnap },
    { data: sightings },
    { data: sentimentRows },
    { data: lastBriefing },
  ] = await Promise.all([
    service
      .from('competitors')
      .select('id, name')
      .eq('brand_id', brand.id),
    service
      .from('sov_snapshots')
      .select('social_sov, competitor_data, snapshot_date')
      .eq('brand_id', brand.id)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    service
      .from('competitor_sightings')
      .select('id, competitor_name, sighting_type, city, state, description, spotted_at, lat, lng')
      .eq('brand_id', brand.id)
      .order('spotted_at', { ascending: false })
      .limit(50),
    service
      .from('sentiment_daily')
      .select('social_score')
      .eq('brand_id', brand.id)
      .order('day', { ascending: false })
      .limit(14),
    service
      .from('weekly_briefings')
      .select('content, created_at')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const brandSov: number | null = sovSnap?.social_sov ?? null
  const marketShare: number | null = brand.market_share_pct ?? null

  const competitorData = sovSnap?.competitor_data as {
    brand_volume?: number
    competitor_volumes?: Record<string, number>
  } | null

  const brandVolume = competitorData?.brand_volume ?? 0
  const competitorVolumes = competitorData?.competitor_volumes ?? {}
  const totalVolume = brandVolume + Object.values(competitorVolumes).reduce((a, b) => a + b, 0)

  const brandSovPct = totalVolume > 0
    ? Number(((brandVolume / totalVolume) * 100).toFixed(1))
    : (brandSov ?? null)

  const esovLeague: { name: string; sov: number | null; isOurBrand: boolean }[] = [
    { name: brand.name, sov: brandSovPct, isOurBrand: true },
    ...(competitors ?? []).map(c => {
      const vol = competitorVolumes[c.name] ?? null
      const sov = vol !== null && totalVolume > 0
        ? Number(((vol / totalVolume) * 100).toFixed(1))
        : null
      return { name: c.name, sov, isOurBrand: false }
    }),
  ]

  const avgSentiment: number | null =
    sentimentRows && sentimentRows.length > 0
      ? Number(
          (sentimentRows.reduce((sum, r) => sum + r.social_score, 0) / sentimentRows.length).toFixed(1)
        )
      : null

  const competitorNames = (competitors ?? []).map(c => c.name)

  const sightingsData = (sightings ?? []).map(s => ({
    id: s.id as string,
    competitor_name: s.competitor_name as string,
    sighting_type: s.sighting_type as string,
    city: s.city as string | null,
    state: s.state as string | null,
    description: s.description as string | null,
    spotted_at: s.spotted_at as string,
    lat: (s as { lat?: number | null }).lat ?? null,
    lng: (s as { lng?: number | null }).lng ?? null,
  }))

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Competitive Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Share of voice, competitor sightings, and AI-generated briefings in one place.
        </p>
      </div>

      <CompetitiveClient
        brandName={brand.name}
        brandSov={brandSovPct}
        marketShare={marketShare}
        competitorNames={competitorNames}
        esovLeague={esovLeague}
        sightings={sightingsData}
        avgSentiment={avgSentiment}
        lastBriefing={lastBriefing ? {
          content: lastBriefing.content as Record<string, unknown>,
          created_at: lastBriefing.created_at as string,
        } : null}
      />
    </div>
  )
}
