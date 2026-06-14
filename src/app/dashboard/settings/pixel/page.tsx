import { createClient, createServiceClient } from '@/lib/supabase/server'
import { PixelSettingsClient } from './pixel-settings-client'

export default async function PixelSettingsPage() {
  const supabase = await createClient()

  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .limit(1)
    .single()

  if (!brand) {
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
    .eq('brand_id', brand.id)
    .maybeSingle()

  // Fetch last 10 SDK events for this brand
  const { data: recentEvents } = await serviceClient
    .from('sdk_events')
    .select('id, event_type, value, page_url, occurred_at')
    .eq('brand_id', brand.id)
    .order('occurred_at', { ascending: false })
    .limit(10)

  return (
    <PixelSettingsClient
      pixelId={pixelConfig?.pixel_id ?? null}
      recentEvents={recentEvents ?? []}
    />
  )
}
