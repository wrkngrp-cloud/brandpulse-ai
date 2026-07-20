import { createClient }        from '@/lib/supabase/server'
import { redirect }            from 'next/navigation'
import { getActiveBrand }      from '@/lib/active-brand'
import Link                   from 'next/link'
import { getIndustryFromCategory, SUGGESTED_CONNECTORS_BY_INDUSTRY, INDUSTRY_META, type IndustryId } from '@/lib/industry-config'
import { SocialConnectCard }   from '@/components/dashboard/social-connect-card'
import { GA4ConnectCard, type GA4ConnectionData }           from '@/components/dashboard/ga4-connect-card'
import { MetaAdsConnectCard, type MetaAdsAccountData }      from '@/components/dashboard/meta-ads-connect-card'
import { ComingSoonConnectorCard }                           from '@/components/dashboard/coming-soon-connector-card'
import { PaymentConnectCard, type PaymentConfigStatus }     from '@/components/dashboard/payment-connect-card'
import { AppStoreConnectCard, type AppStoreConfigData }     from '@/components/dashboard/app-store-connect-card'
import { EmailConnectCard, type EmailConnectorStatus }      from '@/components/dashboard/email-connect-card'
// WhatsAppConnectCard hidden until dedicated number is configured
import { PixelCard } from './pixel-card'
import { ShoppingCart, ArrowRight, Search, Users, Music2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TourTrigger } from '@/components/tours/tour-trigger'

export const dynamic = 'force-dynamic'

export default async function ConnectorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const brand = await getActiveBrand<{ id: string; name: string; category: string | null; industry: string | null }>(supabase, 'id, name, category, industry')

  const { data: connections } = await supabase
    .from('social_connections')
    .select('platform, account_name, sync_status, last_synced_at')

  let ga4Connection:    GA4ConnectionData | null  = null
  let metaAdsAccount:  MetaAdsAccountData | null  = null
  let paymentStatus:   PaymentConfigStatus        = { paystack: false, flutterwave: false }
  let appStoreConfig:  AppStoreConfigData | null  = null
  let emailStatus:     EmailConnectorStatus       = { mailchimp: false, brevo: false }

  let ecommerceStats: { sources: string[]; totalOrders: number; lastImportAt: string | null } = {
    sources: [], totalOrders: 0, lastImportAt: null,
  }
  // whatsappStats removed — WhatsApp connector hidden during beta

  if (brand?.id) {
    const [ga4Res, metaAdsRes, webhookRes, appRes, reviewRes, emailRes, ecomRes] = await Promise.all([
      supabase.from('ga4_connections').select('id, property_id, property_name, last_synced_at').eq('brand_id', brand.id).maybeSingle(),
      supabase.from('digital_ad_accounts').select('id, account_name, ad_account_id, sync_status, last_synced_at').eq('brand_id', brand.id).eq('platform', 'meta').maybeSingle(),
      supabase.from('webhook_configs').select('provider').eq('brand_id', brand.id),
      supabase.from('app_store_configs').select('apple_app_id, google_pkg_name').eq('brand_id', brand.id).maybeSingle(),
      supabase.from('app_reviews').select('rating').eq('brand_id', brand.id).order('reviewed_at', { ascending: false }).limit(30),
      supabase.from('email_connectors').select('provider, last_synced_at').eq('brand_id', brand.id),
      supabase.from('ecommerce_sales').select('source, imported_at').eq('brand_id', brand.id).order('imported_at', { ascending: false }).limit(200),
    ])

    ga4Connection     = ga4Res.data ?? null
    metaAdsAccount    = metaAdsRes.data ?? null

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

    if (ecomRes.data && ecomRes.data.length > 0) {
      const sources = [...new Set(ecomRes.data.map((r: { source: string }) => r.source))]
      ecommerceStats = {
        sources,
        totalOrders:  ecomRes.data.length,
        lastImportAt: ecomRes.data[0]?.imported_at ?? null,
      }
    }
  }

  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ''

  const industry = brand?.industry || getIndustryFromCategory(brand?.category ?? '') as IndustryId
  const industryMeta   = INDUSTRY_META[industry as IndustryId]
  const suggestedConns = SUGGESTED_CONNECTORS_BY_INDUSTRY[industry as IndustryId] ?? []
  const hidePayments   = ['fintech', 'b2b_saas', 'media', 'telco', 'insurance', 'healthcare', 'real_estate'].includes(industry)

  const CONNECTOR_LABEL: Record<string, string> = {
    meta_ads: 'Meta Ads', google_ads: 'Google Ads', ga4: 'GA4', firebase: 'Firebase',
    appsflyer: 'AppsFlyer', hubspot: 'HubSpot', csv: 'CSV Upload', paystack: 'Paystack',
    flutterwave: 'Flutterwave', mailchimp: 'Mailchimp', brevo: 'Brevo',
    jumia: 'Jumia', konga: 'Konga', instagram: 'Instagram', twitter: 'X (Twitter)',
  }

  return (
    <div className="max-w-3xl space-y-8 pb-12">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">Platform</p>
          <h1 className="h-display text-[26px] leading-none">All Connectors</h1>
          <p className="mt-2 text-[13px] text-muted-foreground/70 max-w-xl">
            Connect your data sources here. Every module in BrandGauge reads from these connections automatically.
            Connect once. Every module updates automatically.
          </p>
        </div>
        <TourTrigger module="connectors" autoStart />
      </div>

      {/* Context note */}
      <div className="rounded-xl border bg-muted/20 px-4 py-3 text-[12.5px] text-muted-foreground leading-relaxed">
        Social and GA4 connections require OAuth. Payment and email connectors use API keys or webhooks. Your keys are stored encrypted and never exposed in the UI.
      </div>

      {/* Recommended for industry */}
      {industryMeta && suggestedConns.length > 0 && (
        <div className="rounded-xl border bg-card px-4 py-4 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {industryMeta.icon} Recommended for {industryMeta.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestedConns.map(key => (
              <span key={key} className="text-xs border rounded-full px-3 py-1 bg-muted/40 text-muted-foreground font-medium">
                {CONNECTOR_LABEL[key] ?? key}
              </span>
            ))}
          </div>
          <p className="text-[12px] text-muted-foreground/70 leading-relaxed">
            These are the data sources that matter most for {industryMeta.label} brands. Others are still available below.
          </p>
        </div>
      )}

      {/* Social Listening */}
      <section data-tour="social-connectors">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Social Listening</h2>
        <SocialConnectCard connections={connections ?? []} />
      </section>

      {/* Analytics */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Web Analytics</h2>
        <GA4ConnectCard connection={ga4Connection} />
      </section>

      {/* Paid Media */}
      <section data-tour="paid-connectors">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Paid Media</h2>
        <div className="space-y-3">
          <MetaAdsConnectCard account={metaAdsAccount} />
          {/* Google Ads is built (see google-ads-connect-card.tsx) but needs a
              Google Ads developer token before it can go live — see
              docs/connector-setup-guide.md. */}
          <ComingSoonConnectorCard
            icon={<Search className="h-5 w-5 text-[#4285F4]" />}
            iconBg="bg-[#4285F4]/10"
            label="Google Ads"
            description="Sync search and display campaign performance."
          />
          {/* TikTok has OAuth routes but no sync job or dashboard UI yet —
              see docs/connector-setup-guide.md. */}
          <ComingSoonConnectorCard
            icon={<Music2 className="h-5 w-5 text-foreground" />}
            iconBg="bg-foreground/10"
            label="TikTok Ads"
            description="Sync campaign, ad group, and creative performance."
          />
        </div>
      </section>

      {/* CRM */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">CRM</h2>
        {/* HubSpot is built (see hubspot-connect-card.tsx) but needs a HubSpot
            developer app registered before it can go live — see
            docs/connector-setup-guide.md. */}
        <ComingSoonConnectorCard
          icon={<Users className="h-5 w-5 text-[#FF7A59]" />}
          iconBg="bg-[#FF7A59]/10"
          label="HubSpot"
          description="Read your marketing qualified lead count from HubSpot."
        />
      </section>

      {/* Website Pixel */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Website & App Tracking</h2>
        <PixelCard />
      </section>

      {/* Payments & Commerce — hidden for industries that are payment platforms themselves */}
      {!hidePayments && (
        <section data-tour="payments-connectors">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Payments & Commerce</h2>
          <PaymentConnectCard status={paymentStatus} appUrl={appUrl} />
        </section>
      )}

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

      {/* WhatsApp connector hidden until dedicated number is configured */}

      {/* E-commerce */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">E-commerce Sales</h2>
        <div className="border rounded-xl p-5 bg-card space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">Sales Import</p>
                {ecommerceStats.totalOrders > 0 ? (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ecommerceStats.totalOrders.toLocaleString()} orders · sources: {ecommerceStats.sources.join(', ')}
                    {ecommerceStats.lastImportAt && (
                      <> · last import {new Date(ecommerceStats.lastImportAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' })}</>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">No sales imported yet. Connect Jumia or Konga to start tracking revenue.</p>
                )}
              </div>
            </div>
            <Link
              href="/dashboard/connectors/ecommerce"
              className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'shrink-0 inline-flex items-center gap-1.5')}
            >
              Import sales data
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Info notes */}
      <div className="border rounded-xl p-5 bg-card space-y-2">
        <p className="text-[13px] font-semibold">How connections work</p>
        <ul className="text-[12px] text-muted-foreground space-y-1 list-disc list-inside">
          <li>X captures direct @mentions via the free-tier user-context API. No paid bearer token needed.</li>
          <li>Instagram captures posts where your account is tagged and posts using your brand hashtags.</li>
          <li>Mentions are collected nightly at 4 AM Lagos time, or trigger a manual crawl from the Sentiment page.</li>
          <li>GA4 syncs daily at 6 AM Lagos time. Use Sync now for on-demand 30-day totals.</li>
          <li>Meta Ads syncs campaign performance daily at 6 AM Lagos time. The connection also enables geo-retargeting audiences from OOH sites.</li>
          <li>Payment webhooks fire in real time and link purchases to the brand funnel.</li>
          <li>App Store reviews sync every Sunday at 7 AM Lagos time.</li>
          <li>Email campaign metrics sync daily at 7 AM Lagos time and feed the Loyalty funnel stage.</li>
        </ul>
      </div>
    </div>
  )
}
