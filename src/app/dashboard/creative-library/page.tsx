import { createClient }    from '@/lib/supabase/server'
import { redirect }         from 'next/navigation'
import { getActiveBrand }   from '@/lib/active-brand'
import { CreativeLibraryClient } from './creative-library-client'

export const dynamic = 'force-dynamic'

export interface CreativeAsset {
  id:                   string
  title:                string
  description:          string | null
  asset_type:           'image' | 'video' | 'copy' | 'carousel' | 'audio'
  format:               string | null
  platform:             string | null
  asset_url:            string | null
  thumbnail_url:        string | null
  status:               'draft' | 'active' | 'vetted' | 'archived'
  fit_for_ads:          boolean
  performance:          Record<string, number> | null
  notes:                string | null
  replication_elements: string[]
  tags:                 string[]
  campaign_id:          string | null
  created_at:           string
}

export default async function CreativeLibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const brand = await getActiveBrand<{ id: string; name: string }>(supabase, 'id, name')
  if (!brand) redirect('/dashboard')

  const { data: assets } = await supabase
    .from('creative_assets')
    .select('id, title, description, asset_type, format, platform, asset_url, thumbnail_url, status, fit_for_ads, performance, notes, replication_elements, tags, campaign_id, created_at')
    .eq('brand_id', brand.id)
    .order('created_at', { ascending: false })

  return (
    <CreativeLibraryClient
      brandId={brand.id}
      brandName={brand.name}
      assets={(assets ?? []) as CreativeAsset[]}
    />
  )
}
