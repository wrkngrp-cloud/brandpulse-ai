import { createClient }   from '@/lib/supabase/server'
import { redirect }       from 'next/navigation'
import { getActiveBrand } from '@/lib/active-brand'
import { FatigueClient }  from './fatigue-client'

export const dynamic = 'force-dynamic'

export interface FatiguedAsset {
  id:           string
  title:        string
  description:  string | null
  asset_type:   string
  platform:     string | null
  status:       string
  fit_for_ads:  boolean
  performance:  Record<string, number> | null
  notes:        string | null
  tags:         string[]
  created_at:   string
  fatigue_score:  number       // 0-100
  fatigue_level:  'critical' | 'watch' | 'refresh'
  fatigue_signals: string[]
}

function calcFatigue(asset: {
  status: string
  performance: Record<string, number> | null
  created_at: string
}): { score: number; level: 'critical' | 'watch' | 'refresh' | null; signals: string[] } {
  if (asset.status !== 'active') return { score: 0, level: null, signals: [] }

  const p   = asset.performance ?? {}
  const ctr = p.ctr ?? null
  const freq = p.frequency ?? null
  const daysRunning = Math.floor((Date.now() - new Date(asset.created_at).getTime()) / 86_400_000)

  let score = 0
  const signals: string[] = []

  // Frequency signal (0-40 pts)
  if (freq !== null) {
    if (freq >= 6)      { score += 40; signals.push(`Avg frequency ${freq.toFixed(1)}× — ad seen too often`) }
    else if (freq >= 4) { score += 25; signals.push(`Avg frequency ${freq.toFixed(1)}× — approaching fatigue threshold`) }
    else if (freq >= 3) { score += 12; signals.push(`Avg frequency ${freq.toFixed(1)}× — monitor closely`) }
  }

  // CTR signal (0-35 pts)
  if (ctr !== null) {
    if (ctr < 1)       { score += 35; signals.push(`CTR ${ctr.toFixed(2)}% — critically low, audience tuning out`) }
    else if (ctr < 2)  { score += 22; signals.push(`CTR ${ctr.toFixed(2)}% — below 2% benchmark, declining engagement`) }
    else if (ctr < 3)  { score += 10; signals.push(`CTR ${ctr.toFixed(2)}% — watch for further decline`) }
  }

  // Age signal (0-25 pts)
  if (daysRunning >= 90)      { score += 25; signals.push(`Running ${daysRunning} days — creative refresh overdue`) }
  else if (daysRunning >= 60) { score += 15; signals.push(`Running ${daysRunning} days — consider scheduling a refresh`) }
  else if (daysRunning >= 45) { score += 8;  signals.push(`Running ${daysRunning} days — approaching recommended refresh window`) }

  let level: 'critical' | 'watch' | 'refresh' | null = null
  if (score >= 55)     level = 'critical'
  else if (score >= 30) level = 'watch'
  else if (score >= 12) level = 'refresh'

  return { score: Math.min(100, score), level, signals }
}

export default async function CreativeFatiguePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const brand = await getActiveBrand<{ id: string; name: string }>(supabase, 'id, name')
  if (!brand) redirect('/dashboard')

  const { data: assets } = await supabase
    .from('creative_assets')
    .select('id, title, description, asset_type, platform, status, fit_for_ads, performance, notes, tags, created_at')
    .eq('brand_id', brand.id)
    .order('created_at', { ascending: false })

  const flagged: FatiguedAsset[] = []
  for (const a of assets ?? []) {
    const { score, level, signals } = calcFatigue({
      status: a.status,
      performance: a.performance as Record<string, number> | null,
      created_at: a.created_at,
    })
    if (level) {
      flagged.push({
        ...a,
        performance: a.performance as Record<string, number> | null,
        tags: Array.isArray(a.tags) ? (a.tags as string[]) : [],
        fatigue_score: score,
        fatigue_level: level,
        fatigue_signals: signals,
      })
    }
  }

  // Sort: critical first, then by score descending
  flagged.sort((a, b) => {
    const order = { critical: 0, watch: 1, refresh: 2 }
    if (order[a.fatigue_level] !== order[b.fatigue_level]) return order[a.fatigue_level] - order[b.fatigue_level]
    return b.fatigue_score - a.fatigue_score
  })

  const totalActive = (assets ?? []).filter(a => a.status === 'active').length

  return (
    <FatigueClient
      brandName={brand.name}
      assets={flagged}
      totalActive={totalActive}
    />
  )
}
