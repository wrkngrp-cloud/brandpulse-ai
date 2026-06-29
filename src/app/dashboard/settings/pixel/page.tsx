import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { PixelSettingsClient } from './pixel-settings-client'

export const dynamic = 'force-dynamic'

export default async function PixelSettingsPage() {
  const supabase = await createClient()

  const brandId = await getActiveBrandId(supabase)

  if (!brandId) {
    return (
      <div className="border rounded-xl p-6 bg-card text-sm text-muted-foreground">
        No brand found. Complete onboarding first.
      </div>
    )
  }

  const serviceClient = await createServiceClient()

  // Fetch pixel config — may not exist yet
  const { data: pixelConfig } = await serviceClient
    .from('pixel_configs')
    .select('pixel_id')
    .eq('brand_id', brandId)
    .maybeSingle()

  // Fetch last 10 SDK events for this brand
  const { data: recentEvents } = await serviceClient
    .from('sdk_events')
    .select('id, event_type, value, page_url, occurred_at')
    .eq('brand_id', brandId)
    .order('occurred_at', { ascending: false })
    .limit(10)

  return (
    <PixelSettingsClient
      pixelId={pixelConfig?.pixel_id ?? null}
      recentEvents={recentEvents ?? []}
    />
  )
}
