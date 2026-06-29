import { createClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { SocialConnectCard } from '@/components/dashboard/social-connect-card'
import { GA4ConnectCard, type GA4ConnectionData } from '@/components/dashboard/ga4-connect-card'
import { PaymentConnectCard, type PaymentConfigStatus } from '@/components/dashboard/payment-connect-card'
import { AppStoreConnectCard, type AppStoreConfigData } from '@/components/dashboard/app-store-connect-card'
import { EmailConnectCard, type EmailConnectorStatus } from '@/components/dashboard/email-connect-card'

export const dynamic = 'force-dynamic'

export default async function ConnectionsSettingsPage() {
  const supabase = await createClient()

  const { data: connections } = await supabase
    .from('social_connections')
    .select('platform, account_name, sync_status, last_synced_at')

  const brandId = await getActiveBrandId(supabase)

  let ga4Connection: GA4ConnectionData | null = null
  let paymentStatus: PaymentConfigStatus = { paystack: false, flutterwave: false }
  let appStoreConfig: AppStoreConfigData | null = null
  let emailStatus: EmailConnectorStatus = { mailchimp: false, brevo: false }

  if (brandId) {
    const { data: ga4Data } = await supabase
      .from('ga4_connections')
      .select('id, property_id, property_name, last_synced_at')
      .eq('brand_id', brandId)
      .maybeSingle()
    ga4Connection = ga4Data ?? null

    const { data: webhookConfigs } = await supabase
      .from('webhook_configs')
      .select('provider')
      .eq('brand_id', brandId)

    if (webhookConfigs) {
      paymentStatus = {
        paystack:    webhookConfigs.some(c => c.provider === 'paystack'),
        flutterwave: webhookConfigs.some(c => c.provider === 'flutterwave'),
      }
    }

    const [{ data: appCfg }, { data: reviewStats }, { data: emailRows }] = await Promise.all([
      supabase
        .from('app_store_configs')
        .select('apple_app_id, google_pkg_name')
        .eq('brand_id', brandId)
        .maybeSingle(),
      supabase
        .from('app_reviews')
        .select('rating')
        .eq('brand_id', brandId)
        .order('reviewed_at', { ascending: false })
        .limit(30),
      supabase
        .from('email_connectors')
        .select('provider, last_synced_at')
        .eq('brand_id', brandId),
    ])

    if (appCfg) {
      const ratings = (reviewStats ?? [])
        .map((r: { rating: number }) => r.rating)
        .filter(Boolean)
      const avgRating = ratings.length
        ? ratings.reduce((s: number, v: number) => s + v, 0) / ratings.length
        : null
      appStoreConfig = {
        apple_app_id:    appCfg.apple_app_id ?? null,
        google_pkg_name: appCfg.google_pkg_name ?? null,
        avg_rating:      avgRating,
        review_count:    reviewStats?.length ?? 0,
      }
    }

    if (emailRows) {
      emailStatus = {
        mailchimp:     emailRows.some(r => r.provider === 'mailchimp'),
        brevo:         emailRows.some(r => r.provider === 'brevo'),
        last_synced_at: emailRows[0]?.last_synced_at ?? null,
      }
    }
  }

  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <div className="space-y-6">
      <SocialConnectCard connections={connections ?? []} />

      <GA4ConnectCard connection={ga4Connection} />

      <PaymentConnectCard status={paymentStatus} appUrl={appUrl} />

      <AppStoreConnectCard config={appStoreConfig} />

      <EmailConnectCard status={emailStatus} />

      <div className="border rounded-xl p-5 bg-card space-y-2">
        <p className="text-sm font-semibold">About connections</p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>X captures direct @mentions and keyword mentions of your brand name.</li>
          <li>Instagram captures posts where your account is @tagged and posts using your brand hashtags.</li>
          <li>Mentions are collected every night at 4 AM Lagos time, or you can trigger a crawl manually from the Sentiment page.</li>
          <li>Reconnecting a platform refreshes the OAuth credentials without losing existing data.</li>
          <li>GA4 data syncs daily at 6 AM Lagos time. Use Sync now to pull the latest 30-day totals on demand.</li>
          <li>Payment webhooks fire in real time. Each successful charge adds an Action signal to the funnel; ten or more purchases from the same customer count toward Loyalty.</li>
          <li>App Store reviews sync every Sunday at 7 AM Lagos time. Apple reviews are fetched automatically. Google Play reviews need the official Publisher API.</li>
          <li>Email campaign metrics (open rate, click rate) sync daily at 7 AM Lagos time and feed the Loyalty stage in the Brand Funnel.</li>
        </ul>
      </div>
    </div>
  )
}
