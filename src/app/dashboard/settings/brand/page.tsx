import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { resolveBrandType } from '@/lib/bhi'
import { BrandSettingsForm } from './brand-settings-form'

export const dynamic = 'force-dynamic'
import { ApiKeysSection } from './api-keys-section'
import type { BrandSettingsData } from '../actions'

type BrandRow = {
  name: string | null
  website_url: string | null
  google_place_id: string | null
  g2_slug: string | null
  capterra_slug: string | null
  github_repo: string | null
  npm_package_name: string | null
  stackoverflow_tag: string | null
  category: string | null
  industry: string | null
  brand_type: string | null
  market_share_pct: number | null
  brand_values: unknown
  monitored_hashtags: unknown
  brand_aliases: unknown
  brand_voice: unknown
  cultural_profile: unknown
  target_segments: unknown
  logo_url: string | null
  brand_colors: unknown
}

export default async function BrandSettingsPage() {
  const supabase = await createClient()
  const brand = await getActiveBrand<BrandRow>(
    supabase,
    'name, website_url, google_place_id, g2_slug, capterra_slug, github_repo, npm_package_name, stackoverflow_tag, category, industry, brand_type, market_share_pct, brand_values, monitored_hashtags, brand_aliases, brand_voice, cultural_profile, target_segments, logo_url, brand_colors',
  )

  const rawVoice = (brand?.brand_voice ?? {}) as Record<string, unknown>
  const rawSegs  = (brand?.target_segments ?? []) as Record<string, unknown>[]

  const initial: BrandSettingsData = {
    brandName:         brand?.name ?? '',
    websiteUrl:        brand?.website_url ?? '',
    googlePlaceId:     brand?.google_place_id ?? '',
    g2Slug:            brand?.g2_slug ?? '',
    capterraSlug:      brand?.capterra_slug ?? '',
    githubRepo:        brand?.github_repo ?? '',
    npmPackageName:    brand?.npm_package_name ?? '',
    stackoverflowTag:  brand?.stackoverflow_tag ?? '',
    category:          brand?.category ?? '',
    brandType:         resolveBrandType(brand?.brand_type, brand?.industry) as BrandSettingsData['brandType'],
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
    <div className="space-y-6">
      <BrandSettingsForm
        initial={initial}
        logoUrl={brand?.logo_url ?? null}
        brandColors={(brand?.brand_colors as string[] | null) ?? []}
      />
      <ApiKeysSection />
    </div>
  )
}
