import { createClient } from '@/lib/supabase/server'
import { SocialConnectCard } from '@/components/dashboard/social-connect-card'
import { InstagramPageIdForm } from '@/components/dashboard/instagram-page-id-form'

export default async function ConnectionsSettingsPage() {
  const supabase = await createClient()

  const { data: connections } = await supabase
    .from('social_connections')
    .select('platform, account_name, sync_status, last_synced_at')

  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .limit(1)
    .single()

  const igConnection = connections?.find(
    c => c.platform === 'instagram' && c.sync_status === 'active'
  )

  return (
    <div className="space-y-6">
      <SocialConnectCard connections={connections ?? []} />

      {igConnection && (
        <InstagramPageIdForm pendingKey={igConnection.account_name ?? 'instagram'} />
      )}

      <div className="border rounded-xl p-5 bg-card space-y-2">
        <p className="text-sm font-semibold">About connections</p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>X captures direct @mentions and keyword mentions of your brand name.</li>
          <li>Instagram captures posts where your account is @tagged and posts using your brand hashtags.</li>
          <li>Mentions are collected every night at 4 AM Lagos time, or you can trigger a crawl manually from the Sentiment page.</li>
          <li>Reconnecting a platform refreshes the OAuth credentials without losing existing data.</li>
        </ul>
      </div>
    </div>
  )
}
