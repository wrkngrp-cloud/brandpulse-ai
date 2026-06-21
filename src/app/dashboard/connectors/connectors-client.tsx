'use client'

import { useState } from 'react'
import {
  AtSign, ImageIcon, Users2, Briefcase, Video,
  BarChart3, ShoppingCart, Star, Mail, Plug,
  CheckCircle2, AlertCircle, ExternalLink, Code2, Webhook,
  MessageCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Brand { id: string; name: string; connected_channels?: string[] | null; ga4_property_id?: string | null }

interface ConnectorDef {
  id:       string
  name:     string
  icon:     React.ElementType
  color:    string
  category: string
  desc:     string
  docsHref: string
  checkFn:  (b: Brand) => boolean
  settingsHref?: string
}

const CONNECTORS: ConnectorDef[] = [
  // Social
  {
    id: 'twitter', name: 'X (Twitter)', icon: AtSign, color: 'bg-black', category: 'Social Listening',
    desc: 'Pulls direct @mentions via the free-tier user-context API. No paid access needed.',
    docsHref: '/dashboard/settings/connections', settingsHref: '/dashboard/settings/connections',
    checkFn: (b) => (b.connected_channels ?? []).includes('twitter'),
  },
  {
    id: 'instagram', name: 'Instagram', icon: ImageIcon, color: 'bg-gradient-to-br from-pink-500 to-orange-400', category: 'Social Listening',
    desc: 'Hashtag monitoring + tagged media via Instagram Business Graph API.',
    docsHref: '/dashboard/settings/connections', settingsHref: '/dashboard/settings/connections',
    checkFn: (b) => (b.connected_channels ?? []).includes('instagram'),
  },
  {
    id: 'facebook', name: 'Facebook', icon: Users2, color: 'bg-blue-600', category: 'Social Listening',
    desc: 'Page mentions and audience insights (requires Business Manager access).',
    docsHref: '/dashboard/settings/connections',
    checkFn: (b) => (b.connected_channels ?? []).includes('facebook'),
  },
  {
    id: 'linkedin', name: 'LinkedIn', icon: Briefcase, color: 'bg-[#0077B5]', category: 'Social Listening',
    desc: 'Brand mentions and share-of-voice on LinkedIn (Company Page required).',
    docsHref: '/dashboard/settings/connections',
    checkFn: (b) => (b.connected_channels ?? []).includes('linkedin'),
  },
  {
    id: 'youtube', name: 'YouTube', icon: Video, color: 'bg-red-600', category: 'Social Listening',
    desc: 'Video ad comments, view counts, and sentiment from your brand channel.',
    docsHref: '/dashboard/settings/connections',
    checkFn: (b) => (b.connected_channels ?? []).includes('youtube'),
  },
  // Analytics
  {
    id: 'ga4', name: 'Google Analytics 4', icon: BarChart3, color: 'bg-orange-500', category: 'Analytics',
    desc: 'Links campaign UTMs to on-site conversion events for Media Mix attribution.',
    docsHref: '/dashboard/settings/connections', settingsHref: '/dashboard/settings/connections',
    checkFn: (b) => !!b.ga4_property_id,
  },
  // Website
  {
    id: 'pixel', name: 'BrandPulse Pixel', icon: Code2, color: 'bg-primary', category: 'Website',
    desc: 'Lightweight JS snippet capturing UTM attribution and page-level conversion signals.',
    docsHref: '/dashboard/settings/pixel', settingsHref: '/dashboard/settings/pixel',
    checkFn: () => false,
  },
  {
    id: 'sdk', name: 'Mobile SDK', icon: Plug, color: 'bg-purple-600', category: 'Website',
    desc: 'React Native + Flutter SDK for in-app event tracking and NPS triggers.',
    docsHref: '/dashboard/settings/pixel',
    checkFn: () => false,
  },
  // Commerce
  {
    id: 'paystack', name: 'Paystack', icon: ShoppingCart, color: 'bg-[#00C3F7]', category: 'Payments & Commerce',
    desc: 'Pulls transaction counts and revenue data to correlate with campaign spend.',
    docsHref: '/dashboard/settings/connections',
    checkFn: (b) => (b.connected_channels ?? []).includes('paystack'),
  },
  {
    id: 'flutterwave', name: 'Flutterwave', icon: ShoppingCart, color: 'bg-[#F5A623]', category: 'Payments & Commerce',
    desc: 'Links Flutterwave payment flows to active campaign UTMs.',
    docsHref: '/dashboard/settings/connections',
    checkFn: (b) => (b.connected_channels ?? []).includes('flutterwave'),
  },
  // Reviews
  {
    id: 'google_reviews', name: 'Google Business Reviews', icon: Star, color: 'bg-yellow-500', category: 'Reviews',
    desc: 'Ingests Google Maps reviews for sentiment and NPS enrichment.',
    docsHref: '/dashboard/settings/connections',
    checkFn: (b) => (b.connected_channels ?? []).includes('google_reviews'),
  },
  {
    id: 'trustpilot', name: 'Trustpilot', icon: Star, color: 'bg-green-600', category: 'Reviews',
    desc: 'Pulls Trustpilot review text and star ratings into the sentiment engine.',
    docsHref: '/dashboard/settings/connections',
    checkFn: (b) => (b.connected_channels ?? []).includes('trustpilot'),
  },
  // Email Marketing
  {
    id: 'mailchimp', name: 'Mailchimp', icon: Mail, color: 'bg-[#FFE01B] text-black', category: 'Email Marketing',
    desc: 'Syncs email open/click rates to campaign performance as a channel signal.',
    docsHref: '/dashboard/settings/connections',
    checkFn: (b) => (b.connected_channels ?? []).includes('mailchimp'),
  },
  {
    id: 'brevo', name: 'Brevo', icon: Mail, color: 'bg-[#0B996E]', category: 'Email Marketing',
    desc: 'Sync Brevo (Sendinblue) campaign metrics for cross-channel performance.',
    docsHref: '/dashboard/settings/connections',
    checkFn: (b) => (b.connected_channels ?? []).includes('brevo'),
  },
  // Webhooks
  {
    id: 'whatsapp', name: 'WhatsApp Business (AT)', icon: MessageCircle, color: 'bg-green-600', category: 'Messaging',
    desc: "Africa's Talking WhatsApp channel for NPS surveys and inbound reply tracking.",
    docsHref: '/dashboard/surveys/nps',
    checkFn: () => !!process.env.NEXT_PUBLIC_AT_API_KEY,
  },
]

const CATEGORIES = ['Social Listening', 'Analytics', 'Website', 'Payments & Commerce', 'Reviews', 'Email Marketing', 'Messaging']

export function ConnectorsClient({ brands, workspacePlan }: { brands: Brand[]; workspacePlan: string }) {
  const [activeBrand, setActiveBrand] = useState(brands[0]?.id ?? '')
  const brand = brands.find(b => b.id === activeBrand) ?? brands[0]

  const connectedCount = CONNECTORS.filter(c => brand && c.checkFn(brand)).length

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <p className="eyebrow mb-1">Platform</p>
        <h1 className="h-display text-[26px] leading-none">Connectors</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground/70 max-w-xl">
          All data sources, integrations, and tracking endpoints in one place.
          Connect a source once — every BrandPulse module reads from it automatically.
        </p>
      </div>

      {/* Brand selector + stats */}
      <div className="flex items-center gap-4 flex-wrap">
        {brands.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-muted-foreground">Showing for:</span>
            <div className="flex gap-1">
              {brands.map(b => (
                <button
                  key={b.id}
                  onClick={() => setActiveBrand(b.id)}
                  className={cn(
                    'px-3 py-1 rounded-full text-[12px] font-medium border transition-all',
                    activeBrand === b.id
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-border text-muted-foreground hover:border-foreground/40'
                  )}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span className="text-[13px] font-medium">{connectedCount} of {CONNECTORS.length} connected</span>
        </div>
      </div>

      {/* Connector grid by category */}
      {CATEGORIES.map(cat => {
        const items = CONNECTORS.filter(c => c.category === cat)
        return (
          <section key={cat}>
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">{cat}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map(connector => {
                const connected = brand ? connector.checkFn(brand) : false
                const Icon = connector.icon
                return (
                  <div key={connector.id} className={cn(
                    'rounded-2xl border bg-card p-4 flex items-start gap-3 transition-all',
                    connected ? 'border-emerald-200 dark:border-emerald-900/60' : ''
                  )}>
                    {/* Icon */}
                    <div className={cn('h-9 w-9 rounded-xl shrink-0 grid place-items-center text-white', connector.color)}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-[13.5px] font-semibold leading-tight">{connector.name}</p>
                        {connected
                          ? <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-400 text-emerald-600">Connected</Badge>
                          : <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">Not connected</Badge>
                        }
                      </div>
                      <p className="text-[12px] text-muted-foreground leading-relaxed">{connector.desc}</p>
                    </div>

                    {/* Action */}
                    <div className="shrink-0 flex flex-col gap-1.5 items-end">
                      {connected ? (
                        <div className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                      ) : (
                        <AlertCircle className="h-4 w-4 text-muted-foreground/40" />
                      )}
                      {connector.settingsHref && (
                        <a
                          href={connector.settingsHref}
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                        >
                          {connected ? 'Manage' : 'Connect'}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      <div className="rounded-2xl border border-dashed p-5 text-center">
        <p className="text-[13px] font-medium mb-1">Need a different integration?</p>
        <p className="text-[12px] text-muted-foreground mb-3">We add connectors on request. Tell us which data source you need.</p>
        <Button variant="outline" size="sm" onClick={() => window.open('mailto:hello@brandpulse.ai?subject=Connector request', '_blank')}>
          Request a connector
        </Button>
      </div>
    </div>
  )
}
