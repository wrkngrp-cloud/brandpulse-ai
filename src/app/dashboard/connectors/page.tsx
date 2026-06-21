import { createClient }        from '@/lib/supabase/server'
import { redirect }            from 'next/navigation'
import { SocialConnectCard }   from '@/components/dashboard/social-connect-card'
import { GA4ConnectCard, type GA4ConnectionData }      from '@/components/dashboard/ga4-connect-card'
import { PaymentConnectCard, type PaymentConfigStatus } from '@/components/dashboard/payment-connect-card'
import { AppStoreConnectCard, type AppStoreConfigData } from '@/components/dashboard/app-store-connect-card'
import { EmailConnectCard, type EmailConnectorStatus }  from '@/components/dashboard/email-connect-card'
import { PixelCard } from './pixel-card'

export const dynamic = 'force-dynamic'

export default async function ConnectorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name')
    .limit(1).maybeSingle()

  const { data: connections } = await supabase
    .from('social_connections')
    .select('platform, account_name, sync_status, last_synced_at')

  let ga4Connection:   GA4ConnectionData | null = null
  let paymentStatus:   PaymentConfigStatus      = { paystack: false, flutterwave: false }
  let appStoreConfig:  AppStoreConfigData | null = null
  let emailStatus:     EmailConnectorStatus      = { mailchimp: false, brevo: false }

  if (brand) {
    const [ga4Res, webhookRes, appRes, reviewRes, emailRes] = await Promise.all([
      supabase.from('ga4_connections').select('id, property_id, property_name, last_synced_at').eq('brand_id', brand.id).maybeSingle(),
      supabase.from('webhook_configs').select('provider').eq('brand_id', brand.id),
      supabase.from('app_store_configs').select('apple_app_id, google_pkg_name').eq('brand_id', brand.id).maybeSingle(),
      supabase.from('app_reviews').select('rating').eq('brand_id', brand.id).order('reviewed_at', { ascending: false }).limit(30),
      supabase.from('email_connectors').select('provider, last_synced_at').eq('brand_id', brand.id),
    ])

    ga4Connection = ga4Res.data ?? null

    if (webhookRes.data) {
      paymentStatus = {
        paystack:    webhookRes.data.some(c => c.provider === 'paystack'),
        flutterwave: webhookRes.data.some(c => c.provider === 'flutterwave'),
      }
    }

    if (appRes.data) {
      const ratings = (reviewRes.data ?? []).map((r: { rating: number }) => r.rating).filter(Boolean)
      appStoreConfig = {
        apple_app_id:    appRes.data.apple_app_id ?? null,
        google_pkg_name: appRes.data.google_pkg_name ?? null,
        avg_rating:      ratings.length ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : null,
        review_count:    reviewRes.data?.length ?? 0,
      }
    }

    if (emailRes.data) {
      emailStatus = {
        mailchimp:     emailRes.data.some(r => r.provider === 'mailchimp'),
        brevo:         emailRes.data.some(r => r.provider === 'brevo'),
        last_synced_at: emailRes.data[0]?.last_synced_at ?? null,
      }
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <div className="max-w-3xl space-y-8 pb-12">

      {/* Header */}
      <div>
        <p className="eyebrow mb-1">Platform</p>
        <h1 className="h-display text-[26px] leading-none">All Connectors</h1>
        <p className="mt-2 text-[13px] text-muted-foreground/70 max-w-xl">
          Connect your data sources here. Every module in BrandPulse reads from these connections automatically.
          Connect once — all insights update.
        </p>
      </div>

      {/* Context note */}
      <div className="rounded-xl border bg-muted/20 px-4 py-3 text-[12.5px] text-muted-foreground leading-relaxed">
        Social and GA4 connections require OAuth. Payment and email connectors use API keys or webhooks — your keys are stored encrypted and never exposed in the UI.
      </div>

      {/* Social Listening */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Social Listening</h2>
        <SocialConnectCard connections={connections ?? []} />
      </section>

      {/* Analytics */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Web Analytics</h2>
        <GA4ConnectCard connection={ga4Connection} />
      </section>

      {/* Website Pixel */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Website & App Tracking</h2>
        <PixelCard />
      </section>

      {/* Payments & Commerce */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Payments & Commerce</h2>
        <PaymentConnectCard status={paymentStatus} appUrl={appUrl} />
      </section>

      {/* App Stores & Reviews */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">App Stores & Reviews</h2>
        <AppStoreConnectCard config={appStoreConfig} />
      </section>

      {/* Email Marketing */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Email Marketing</h2>
        <EmailConnectCard status={emailStatus} />
      </section>

      {/* Info notes */}
      <div className="border rounded-xl p-5 bg-card space-y-2">
        <p className="text-[13px] font-semibold">How connections work</p>
        <ul className="text-[12px] text-muted-foreground space-y-1 list-disc list-inside">
          <li>X captures direct @mentions via the free-tier user-context API. No paid bearer token needed.</li>
          <li>Instagram captures posts where your account is tagged and posts using your brand hashtags.</li>
          <li>Mentions are collected nightly at 4 AM Lagos time, or trigger a manual crawl from the Sentiment page.</li>
          <li>GA4 syncs daily at 6 AM Lagos time — use Sync now for on-demand 30-day totals.</li>
          <li>Payment webhooks fire in real time and link purchases to the brand funnel.</li>
          <li>App Store reviews sync every Sunday at 7 AM Lagos time.</li>
          <li>Email campaign metrics sync daily at 7 AM Lagos time and feed the Loyalty funnel stage.</li>
        </ul>
      </div>
    </div>
  )
}
