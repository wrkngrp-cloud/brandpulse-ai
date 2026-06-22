import { createClient } from '@/lib/supabase/server'
import { BrandSettingsForm } from './brand-settings-form'
import type { BrandSettingsData } from '../actions'

export default async function BrandSettingsPage() {
  const supabase = await createClient()
  const { data: brand } = await supabase
    .from('brands')
    .select('name, website_url, category, market_share_pct, brand_values, monitored_hashtags, brand_aliases, brand_voice, cultural_profile, target_segments, logo_url, brand_colors')
    .limit(1)
    .single()

  const rawVoice = (brand?.brand_voice ?? {}) as Record<string, unknown>
  const rawSegs  = (brand?.target_segments ?? []) as Record<string, unknown>[]

  const initial: BrandSettingsData = {
    brandName:         brand?.name ?? '',
    websiteUrl:        brand?.website_url ?? '',
    category:          brand?.category ?? '',
    marketSharePct:    brand?.market_share_pct ?? null,
    brandValues:       (brand?.brand_values as string[]) ?? [],
    monitoredHashtags: (brand?.monitored_hashtags as string[]) ?? [],
    brandAliases:      (brand?.brand_aliases as string[]) ?? [],
    brandVoice: {
      adjectives:       Array.isArray(rawVoice.adjectives)       ? rawVoice.adjectives as string[]       : [],
      tone:             typeof rawVoice.tone === 'string'         ? rawVoice.tone                          : '',
      dos:              Array.isArray(rawVoice.dos)               ? rawVoice.dos as string[]               : [],
      donts:            Array.isArray(rawVoice.donts)             ? rawVoice.donts as string[]             : [],
      signaturePhrases: Array.isArray(rawVoice.signaturePhrases)  ? rawVoice.signaturePhrases as string[]  : [],
    },
    culturalProfile: (brand?.cultural_profile as BrandSettingsData['culturalProfile']) ?? {
      community_corporate: 50, traditional_modern: 50, religious_secular: 50,
      mass_premium: 50, local_global: 50,
    },
    targetSegments: rawSegs.map(s => ({
      name:         typeof s.name === 'string'         ? s.name         : '',
      demographics: typeof s.demographics === 'string' ? s.demographics
                  : typeof s.age_range   === 'string'  ? s.age_range    : '',
      geography:    typeof s.geography === 'string'    ? s.geography
                  : typeof s.location   === 'string'   ? s.location     : '',
    })),
  }

  return (
    <BrandSettingsForm
      initial={initial}
      logoUrl={brand?.logo_url ?? null}
      brandColors={(brand?.brand_colors as string[] | null) ?? []}
    />
  )
}
