import { createClient } from '@/lib/supabase/server'
import { BrandSettingsForm } from './brand-settings-form'
import type { BrandSettingsData } from '../actions'

export default async function BrandSettingsPage() {
  const supabase = await createClient()
  const { data: brand } = await supabase
    .from('brands')
    .select('name, website_url, category, brand_values, monitored_hashtags, brand_voice, cultural_profile, target_segments')
    .limit(1)
    .single()

  const initial: BrandSettingsData = {
    brandName:         brand?.name ?? '',
    websiteUrl:        brand?.website_url ?? '',
    category:          brand?.category ?? '',
    brandValues:       (brand?.brand_values as string[]) ?? [],
    monitoredHashtags: (brand?.monitored_hashtags as string[]) ?? [],
    brandVoice:        (brand?.brand_voice as BrandSettingsData['brandVoice']) ?? {
      adjectives: [], tone: '', dos: [], donts: [], signaturePhrases: [],
    },
    culturalProfile: (brand?.cultural_profile as BrandSettingsData['culturalProfile']) ?? {
      community_corporate: 50, traditional_modern: 50, religious_secular: 50,
      mass_premium: 50, local_global: 50,
    },
    targetSegments: (brand?.target_segments as BrandSettingsData['targetSegments']) ?? [],
  }

  return <BrandSettingsForm initial={initial} />
}
