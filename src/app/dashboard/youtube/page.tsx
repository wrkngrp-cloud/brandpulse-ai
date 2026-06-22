import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveBrandId } from '@/lib/active-brand'
import { YoutubeClient } from './youtube-client'

export const dynamic = 'force-dynamic'

export default async function YoutubePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const brandId = await getActiveBrandId(supabase)
  const bid = brandId ?? ''

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [
    { data: mentions },
    { data: deals },
    { data: campaigns },
    { data: apiConfig },
  ] = await Promise.all([
    bid
      ? supabase
          .from('youtube_mentions')
          .select('id, video_id, video_title, channel_name, view_count, like_count, comment_count, published_at, sentiment_score, comment_sample, is_partnership, found_at')
          .eq('brand_id', bid)
          .gte('found_at', thirtyDaysAgo.toISOString())
          .order('view_count', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
    bid
      ? supabase
          .from('youtube_creator_deals')
          .select('id, channel_name, channel_url, video_url, video_id, deliverables, fee_ngn, promo_code, view_guarantee, actual_views, linked_campaign_id, deal_date, created_at')
          .eq('brand_id', bid)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    bid
      ? supabase
          .from('campaigns')
          .select('id, name')
          .order('name')
          .limit(50)
      : Promise.resolve({ data: [] }),
    bid
      ? supabase
          .from('youtube_api_configs')
          .select('last_synced_at, updated_at')
          .eq('brand_id', bid)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">YouTube Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Track brand mentions on YouTube and manage creator partnerships.
        </p>
      </div>

      <YoutubeClient
        mentions={mentions ?? []}
        deals={deals ?? []}
        campaigns={campaigns ?? []}
        isConnected={!!apiConfig}
        lastSyncedAt={apiConfig?.last_synced_at ?? null}
        brandId={bid}
      />
    </div>
  )
}
