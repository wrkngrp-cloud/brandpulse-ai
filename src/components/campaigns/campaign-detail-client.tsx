'use client'

import Link                from 'next/link'
import { useRouter }       from 'next/navigation'
import { useState, useTransition, useRef } from 'react'
import { cn, formatPlatformLabel } from '@/lib/utils'
import { buttonVariants, Button } from '@/components/ui/button'
import { MapPin, CalendarDays, DollarSign, BarChart2, Plus, ExternalLink, TrendingUp, Users, Eye, Percent, Sparkles, RefreshCw, Upload, X, Loader2, ImageIcon, ShoppingCart } from 'lucide-react'
import { CampaignOverview } from './campaign-overview'
import { LinkOohSiteDialog, LinkEventDialog } from './link-existing-dialog'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { toast } from 'sonner'
import { linkInfluencerToCampaign } from '@/app/dashboard/campaigns/[id]/link-influencer-action'
import { PostTracker } from '@/components/influencers/post-tracker'

interface Channel {
  id: string
  channel: string
  budget_allocation: number | null
  objectives: string[]
  creative_urls?: string[] | null
}

interface Campaign {
  id: string
  name: string
  description: string | null
  objectives: string[]
  start_date: string | null
  end_date: string | null
  total_budget: number | null
  currency: string
  status: string
  ai_summary: string | null
  campaign_channels: Channel[]
}

interface OohSite {
  id: string
  site_name: string
  city: string | null
  state: string | null
  format_type: string | null
  visits: number
  campaign_start: string | null
  campaign_end: string | null
  vanity_slug: string | null
  lat: number | null
  lng: number | null
  monthly_cost: number | null
  currency: string | null
  lga: string | null
}

interface Event {
  id: string
  name: string
  event_type: string | null
  activation_type: string | null
  city: string
  state: string | null
  date_start: string | null
  date_end: string | null
  status: string
  expected_attendance: number | null
  budget: number | null
  currency: string
}

interface UnlinkedSite { id: string; site_name: string; city: string | null; state: string | null; format_type: string | null; visits: number }
interface UnlinkedEvent { id: string; name: string; event_type: string | null; activation_type: string | null; city: string; date_start: string | null; status: string }

export interface CampaignInfluencer {
  id: string
  name: string
  handle: string
  platform: string
  category: string | null
  followers: number | null
  cultural_iq: number | null
  risk_score: number | null
  status: string
  campaign_id: string | null
}

interface Interaction { event_id: string; interaction_type: string }

interface SocialPost {
  impressions: number | null
  reach: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  posted_at: string | null
}

interface OohVisit {
  site_id: string
  visited_at: string
}

interface Props {
  campaign: Campaign
  oohSites: OohSite[]
  events: Event[]
  activeTab: string
  unlinkedSites?: UnlinkedSite[]
  unlinkedEvents?: UnlinkedEvent[]
  interactions?: Interaction[]
  socialPosts?: SocialPost[]
  oohVisits?: OohVisit[]
  influencers?: CampaignInfluencer[]
  unlinkedInfluencers?: CampaignInfluencer[]
  attributedRevenue?: number
}

const TABS = [
  { key: 'overview',     label: 'Overview',       icon: BarChart2    },
  { key: 'performance',  label: 'Performance',    icon: TrendingUp   },
  { key: 'ooh',          label: 'OOH Placements', icon: MapPin       },
  { key: 'events',       label: 'Events',          icon: CalendarDays },
  { key: 'influencers',  label: 'Influencers',    icon: Users        },
  { key: 'budget',       label: 'Budget',          icon: DollarSign   },
]

const OBJECTIVE_LABELS: Record<string, string> = {
  awareness:     'Brand Awareness',
  consideration: 'Consideration',
  conversion:    'Conversion',
  retention:     'Retention',
}

const OBJECTIVE_COLOR: Record<string, string> = {
  awareness:     'bg-blue-500',
  consideration: 'bg-purple-500',
  conversion:    'bg-green-500',
  retention:     'bg-amber-500',
}

const CHANNEL_META: Record<string, { label: string; color: string }> = {
  ooh:     { label: 'OOH / Outdoor',        color: 'bg-blue-400'    },
  events:  { label: 'Events & Activations',  color: 'bg-emerald-400' },
  digital: { label: 'Digital',              color: 'bg-violet-400'  },
  radio:   { label: 'Radio',                color: 'bg-orange-400'  },
  tv:      { label: 'TV',                   color: 'bg-red-400'     },
  print:   { label: 'Print',                color: 'bg-stone-400'   },
}

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-muted text-muted-foreground',
  active:    'bg-green-100 text-green-800',
  paused:    'bg-amber-100 text-amber-800',
  completed: 'bg-blue-100 text-blue-800',
}

const EVENT_STATUS: Record<string, string> = {
  planned:  'bg-blue-100 text-blue-800',
  live:     'bg-green-100 text-green-800',
  closed:   'bg-muted text-muted-foreground',
  reported: 'bg-purple-100 text-purple-800',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtMoney(amount: number | null, currency = 'NGN') {
  if (!amount) return '—'
  return `${currency} ${Number(amount).toLocaleString('en-NG')}`
}

function formatFollowers(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-800',
  tiktok:    'bg-black/10 text-black dark:bg-white/10 dark:text-white',
  youtube:   'bg-red-100 text-red-800',
  twitter:   'bg-sky-100 text-sky-800',
  facebook:  'bg-blue-100 text-blue-800',
}

const INF_STATUS_STYLES: Record<string, string> = {
  active:   'bg-green-100 text-green-800',
  paused:   'bg-amber-100 text-amber-800',
  prospect: 'bg-muted text-muted-foreground',
  rejected: 'bg-red-100 text-red-800',
}

function CulturalIQBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>
  const color = score >= 70 ? 'text-green-700 bg-green-100'
    : score >= 50 ? 'text-amber-700 bg-amber-100'
    : 'text-red-700 bg-red-100'
  return <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', color)}>{score}</span>
}

function CampaignInfluencerCard({ inf, campaignId }: { inf: CampaignInfluencer; campaignId: string }) {
  const [showTracker, setShowTracker] = useState(false)
  return (
    <div className="border rounded-xl p-4 bg-card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{inf.name}</p>
          <p className="text-xs text-muted-foreground truncate">@{inf.handle}</p>
        </div>
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full font-medium shrink-0 capitalize',
          INF_STATUS_STYLES[inf.status] ?? 'bg-muted text-muted-foreground',
        )}>
          {inf.status}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', PLATFORM_COLORS[inf.platform] ?? 'bg-muted text-muted-foreground')}>
          {formatPlatformLabel(inf.platform)}
        </span>
        {inf.category && (
          <span className="text-xs text-muted-foreground">{inf.category}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-muted/40 rounded-lg p-2 space-y-0.5">
          <p className="text-xs text-muted-foreground">Followers</p>
          <p className="text-sm font-semibold tabular-nums">{formatFollowers(inf.followers)}</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-2 space-y-0.5">
          <p className="text-xs text-muted-foreground">Cultural IQ</p>
          <div className="mt-0.5">
            <CulturalIQBadge score={inf.cultural_iq} />
          </div>
        </div>
      </div>
      <div className="border-t pt-2">
        <button
          onClick={() => setShowTracker(v => !v)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showTracker ? 'Hide post tracker' : 'Track posts for this influencer'}
        </button>
        {showTracker && (
          <div className="mt-3">
            <PostTracker
              influencerId={inf.id}
              campaignId={campaignId}
              influencerHandle={inf.handle}
              influencerPlatform={inf.platform}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function CampaignDetailClient({ campaign, oohSites, events, activeTab, unlinkedSites = [], unlinkedEvents = [], interactions = [], socialPosts = [], oohVisits = [], influencers = [], unlinkedInfluencers = [], attributedRevenue = 0 }: Props) {
  const router = useRouter()
  const [analysing, startAnalyse] = useTransition()
  const [headerSummary, setHeaderSummary] = useState<string | null>(campaign.ai_summary ?? null)
  const [linkingOpen, setLinkingOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [linking, startLinking] = useTransition()

  // Channel creative assets state: channelId → urls
  const [channelCreatives, setChannelCreatives] = useState<Record<string, string[]>>(
    Object.fromEntries((campaign.campaign_channels ?? []).map(ch => [ch.id, ch.creative_urls ?? []]))
  )
  const [uploadingChannel, setUploadingChannel] = useState<string | null>(null)
  const creativeInputRef = useRef<HTMLInputElement>(null)
  const [pendingChannelId, setPendingChannelId] = useState<string | null>(null)

  async function handleCreativeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !pendingChannelId) return
    setUploadingChannel(pendingChannelId)
    try {
      const form = new FormData()
      form.set('file', file)
      const res  = await fetch(`/api/campaigns/${campaign.id}/channels/${pendingChannelId}/creatives`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Upload failed'); return }
      setChannelCreatives(prev => ({ ...prev, [pendingChannelId]: data.creative_urls }))
      toast.success('Creative uploaded')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploadingChannel(null)
      setPendingChannelId(null)
      if (creativeInputRef.current) creativeInputRef.current.value = ''
    }
  }

  async function handleCreativeDelete(channelId: string, url: string) {
    const res  = await fetch(`/api/campaigns/${campaign.id}/channels/${channelId}/creatives`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Delete failed'); return }
    setChannelCreatives(prev => ({ ...prev, [channelId]: data.creative_urls }))
  }

  function triggerCreativeUpload(channelId: string) {
    setPendingChannelId(channelId)
    setTimeout(() => creativeInputRef.current?.click(), 0)
  }

  function runAnalysis() {
    startAnalyse(async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaign.id}/analyse`, { method: 'POST' })
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({}))
          throw new Error(error ?? 'Analysis failed')
        }
        const { summary } = await res.json()
        setHeaderSummary(summary)
        toast.success('Campaign analysis complete.')
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Analysis failed')
      }
    })
  }

  const objectives     = campaign.objectives ?? []
  const channelAlloc   = campaign.campaign_channels ?? []
  const totalAllocated = channelAlloc.reduce((s, c) => s + (Number(c.budget_allocation) || 0), 0)
  const totalOohSpend  = oohSites.reduce((s, site) => s + (Number(site.monthly_cost) || 0), 0)

  // Performance aggregates
  const totalOohVisits   = oohSites.reduce((s, site) => s + (site.visits ?? 0), 0)
  const totalEventAttendance = events.reduce((s, ev) => s + (Number(ev.expected_attendance) || 0), 0)
  const totalLeads       = interactions.filter(i => i.interaction_type === 'new_lead').length
  const totalEngaged     = interactions.filter(i => ['new_lead','new_customer','engaged'].includes(i.interaction_type)).length
  const totalSpend       = totalOohSpend
  const cpl              = totalLeads > 0 && totalSpend > 0 ? Math.round(totalSpend / totalLeads) : null
  const cpv              = totalOohVisits > 0 && totalOohSpend > 0 ? Math.round(totalOohSpend / totalOohVisits) : null

  // Social aggregates
  const totalImpressions = socialPosts.reduce((s, p) => s + (p.impressions ?? 0), 0)
  const totalReach       = socialPosts.reduce((s, p) => s + (p.reach ?? 0), 0)
  const totalEngagements = socialPosts.reduce((s, p) => s + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0), 0)

  // Weekly impressions for BarChart — group by ISO week
  const weeklyImpressions: Record<string, number> = {}
  for (const post of socialPosts) {
    if (!post.posted_at) continue
    const d    = new Date(post.posted_at)
    // week label: Mon of the ISO week
    const day  = d.getDay() === 0 ? 6 : d.getDay() - 1  // Mon=0
    const mon  = new Date(d)
    mon.setDate(d.getDate() - day)
    const key  = mon.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
    weeklyImpressions[key] = (weeklyImpressions[key] ?? 0) + (post.impressions ?? 0)
  }
  const weeklyChartData = Object.entries(weeklyImpressions).map(([week, impressions]) => ({ week, impressions }))

  // Per-event lead counts
  const leadsByEvent: Record<string, number> = {}
  for (const i of interactions) {
    if (i.interaction_type === 'new_lead') {
      leadsByEvent[i.event_id] = (leadsByEvent[i.event_id] ?? 0) + 1
    }
  }

  // Per-site visit counts from ooh_visits log
  const visitsBySite: Record<string, number> = {}
  for (const v of oohVisits) {
    visitsBySite[v.site_id] = (visitsBySite[v.site_id] ?? 0) + 1
  }

  return (
    <div className="space-y-5">
      {/* Status + objectives pills + AI Analyse button */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_STYLES[campaign.status] ?? STATUS_STYLES.draft)}>
            {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
          </span>
          {objectives.map(obj => (
            <span key={obj} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn('h-2 w-2 rounded-full', OBJECTIVE_COLOR[obj] ?? 'bg-muted-foreground')} />
              {OBJECTIVE_LABELS[obj] ?? obj}
            </span>
          ))}
          <span className="text-xs text-muted-foreground">
            {campaign.start_date ? fmtDate(campaign.start_date) : ''}
            {campaign.end_date
              ? ` – ${fmtDate(campaign.end_date)}`
              : campaign.start_date ? ' · Always On' : ''}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5 shrink-0"
          onClick={runAnalysis}
          disabled={analysing}
        >
          {analysing
            ? <><RefreshCw className="h-3 w-3 animate-spin" /> Analysing…</>
            : <><Sparkles className="h-3 w-3" /> {headerSummary ? 'Re-analyse' : 'AI Analysis'}</>
          }
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => router.push(`/dashboard/campaigns/${campaign.id}?tab=${tab.key}`, { scroll: false })}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.key
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === 'overview' && (
        <CampaignOverview
          campaign={{ ...campaign, ai_summary: headerSummary }}
          oohSites={oohSites.map(s => ({
            visits:       s.visits,
            monthly_cost: s.monthly_cost,
            currency:     s.currency,
          }))}
          events={events.map(e => ({ status: e.status }))}
          influencers={influencers.map(inf => ({
            id:          inf.id,
            name:        inf.name,
            handle:      inf.handle,
            platform:    inf.platform,
            followers:   inf.followers,
            cultural_iq: inf.cultural_iq,
          }))}
        />
      )}

      {/* ── Performance ── */}
      {activeTab === 'performance' && (
        <div className="space-y-5">

          {/* ── Summary KPI row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: 'Total Spend',
                value: fmtMoney(totalSpend || null, campaign.currency),
                icon: DollarSign,
                sub: 'OOH monthly cost',
              },
              {
                label: 'Total Impressions',
                value: totalImpressions > 0 ? totalImpressions.toLocaleString() : totalOohVisits.toLocaleString(),
                icon: Eye,
                sub: totalImpressions > 0 ? 'social posts impressions' : 'OOH vanity-link visits',
              },
              {
                label: 'Leads Captured',
                value: totalLeads.toLocaleString(),
                icon: Users,
                sub: 'captured by ambassadors',
              },
              {
                label: 'Cost per Lead',
                value: cpl !== null ? fmtMoney(cpl, campaign.currency) : '—',
                icon: Percent,
                sub: 'total spend ÷ leads',
              },
            ].map(({ label, value, icon: Icon, sub }) => (
              <div key={label} className="border rounded-xl p-4 bg-card space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
                <p className="text-2xl font-bold tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>

          {/* ── Attributed revenue row ── */}
          <div className="border rounded-xl p-4 bg-card space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShoppingCart className="h-3.5 w-3.5" />
              Attributed revenue
            </div>
            {attributedRevenue > 0 ? (
              <>
                <p className="text-2xl font-bold tabular-nums">
                  {attributedRevenue >= 1_000_000
                    ? `₦${(attributedRevenue / 1_000_000).toFixed(1)}M`
                    : `₦${attributedRevenue.toLocaleString('en-NG')}`}
                </p>
                <p className="text-xs text-muted-foreground">from sales imports linked to this campaign</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums">—</p>
                <p className="text-xs text-muted-foreground">
                  Link a sales import to track revenue ·{' '}
                  <Link href="/dashboard/connectors/ecommerce" className="underline hover:text-foreground transition-colors">
                    Import now
                  </Link>
                </p>
              </>
            )}
          </div>

          {/* ── Efficiency ratios row ── */}
          {(cpv !== null || totalEngaged > 0) && (
            <div className="grid grid-cols-2 gap-3">
              {cpv !== null && (
                <div className="border rounded-xl p-4 bg-card space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Percent className="h-3.5 w-3.5" />
                    Cost per OOH visit
                  </div>
                  <p className="text-xl font-bold tabular-nums">{fmtMoney(cpv, campaign.currency)}</p>
                  <p className="text-xs text-muted-foreground">OOH spend ÷ vanity-link visits</p>
                </div>
              )}
              {totalEngaged > 0 && (
                <div className="border rounded-xl p-4 bg-card space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Total engaged
                  </div>
                  <p className="text-xl font-bold tabular-nums">{totalEngaged.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">leads + customers + engaged across events</p>
                </div>
              )}
            </div>
          )}

          {/* ── OOH Performance table ── */}
          {oohSites.length > 0 && (
            <div className="border rounded-xl p-5 bg-card space-y-3">
              <p className="text-sm font-medium">OOH site performance</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[480px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left text-muted-foreground font-medium pb-2 pr-4">Site</th>
                      <th className="text-left text-muted-foreground font-medium pb-2 pr-4">Location</th>
                      <th className="text-right text-muted-foreground font-medium pb-2 pr-4">Est. Daily Traffic</th>
                      <th className="text-right text-muted-foreground font-medium pb-2 pr-4">Link Visits</th>
                      <th className="text-right text-muted-foreground font-medium pb-2">Monthly Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {oohSites
                      .slice()
                      .sort((a, b) => (b.visits ?? 0) - (a.visits ?? 0))
                      .map(site => {
                        const logVisits = visitsBySite[site.id] ?? site.visits ?? 0
                        return (
                          <tr key={site.id}>
                            <td className="py-2 pr-4">
                              <Link href={`/dashboard/ooh/${site.id}`} className="font-medium hover:underline">
                                {site.site_name}
                              </Link>
                              {site.format_type && (
                                <span className="ml-1.5 text-muted-foreground">{site.format_type}</span>
                              )}
                            </td>
                            <td className="py-2 pr-4 text-muted-foreground">
                              {[site.lga, site.city, site.state].filter(Boolean).join(', ') || '—'}
                            </td>
                            <td className="py-2 pr-4 text-right tabular-nums">
                              {site.visits != null ? site.visits.toLocaleString() : '—'}
                            </td>
                            <td className="py-2 pr-4 text-right tabular-nums font-medium">
                              {logVisits.toLocaleString()}
                            </td>
                            <td className="py-2 text-right tabular-nums text-muted-foreground">
                              {fmtMoney(site.monthly_cost, site.currency ?? 'NGN')}/mo
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                  {oohSites.length > 1 && (
                    <tfoot>
                      <tr className="border-t">
                        <td colSpan={3} className="pt-2 text-muted-foreground font-medium">Total</td>
                        <td className="pt-2 text-right tabular-nums font-semibold">
                          {totalOohVisits.toLocaleString()}
                        </td>
                        <td className="pt-2 text-right tabular-nums font-semibold">
                          {fmtMoney(totalOohSpend, campaign.currency)}/mo
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ── Event Performance table ── */}
          {events.length > 0 && (
            <div className="border rounded-xl p-5 bg-card space-y-3">
              <p className="text-sm font-medium">Event performance</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[440px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left text-muted-foreground font-medium pb-2 pr-4">Event</th>
                      <th className="text-right text-muted-foreground font-medium pb-2 pr-4">Leads</th>
                      <th className="text-right text-muted-foreground font-medium pb-2 pr-4">Est. Attendance</th>
                      <th className="text-right text-muted-foreground font-medium pb-2">CPL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {events.map(ev => {
                      const leads     = leadsByEvent[ev.id] ?? 0
                      return (
                        <tr key={ev.id}>
                          <td className="py-2 pr-4">
                            <Link href={`/dashboard/events/${ev.id}`} className="font-medium hover:underline">
                              {ev.name}
                            </Link>
                            <span className="ml-1.5 text-muted-foreground">
                              {ev.city}{ev.state ? `, ${ev.state}` : ''} · {fmtDate(ev.date_start)}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums font-medium">
                            {leads > 0 ? leads.toLocaleString() : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                            {ev.expected_attendance != null ? ev.expected_attendance.toLocaleString() : '—'}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            <span className="text-muted-foreground">—</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {totalLeads > 0 && (
                    <tfoot>
                      <tr className="border-t">
                        <td className="pt-2 text-muted-foreground font-medium">Total</td>
                        <td className="pt-2 text-right tabular-nums font-semibold">{totalLeads.toLocaleString()}</td>
                        <td className="pt-2 text-right tabular-nums font-semibold">{totalEventAttendance > 0 ? totalEventAttendance.toLocaleString() : '—'}</td>
                        <td className="pt-2 text-right tabular-nums font-semibold">—</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ── Social Performance ── */}
          {socialPosts.length > 0 && (
            <div className="border rounded-xl p-5 bg-card space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Social performance</p>
                <span className="text-xs text-muted-foreground">{socialPosts.length} post{socialPosts.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Social KPI row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Impressions', value: totalImpressions.toLocaleString() },
                  { label: 'Reach',       value: totalReach.toLocaleString() },
                  { label: 'Engagements', value: totalEngagements.toLocaleString() },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-muted/40 rounded-lg p-3 space-y-0.5">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg font-bold tabular-nums">{value}</p>
                  </div>
                ))}
              </div>

              {/* Weekly impressions chart */}
              {weeklyChartData.length > 1 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Impressions by week</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={weeklyChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <XAxis
                        dataKey="week"
                        tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4, fontFamily: 'var(--font-sans)' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4, fontFamily: 'var(--font-sans)' }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                        tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#14182B',
                          border: '1px solid rgba(255,255,255,0.10)',
                          borderRadius: 12,
                          fontSize: 12,
                          color: '#fff',
                        }}
                        labelStyle={{ color: 'rgba(255,255,255,0.4)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 4 }}
                        formatter={(value) => [Number(value).toLocaleString(), 'Impressions']}
                        cursor={{ fill: 'currentColor', opacity: 0.05 }}
                      />
                      <Bar dataKey="impressions" fill="#2B59FF" radius={[4, 4, 0, 0]} opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ── Event interaction breakdown ── */}
          {events.length > 0 && interactions.length > 0 && (
            <div className="border rounded-xl p-5 bg-card space-y-3">
              <p className="text-sm font-medium">Event interaction breakdown</p>
              {(() => {
                const byType: Record<string, number> = {}
                interactions.forEach(i => { byType[i.interaction_type] = (byType[i.interaction_type] ?? 0) + 1 })
                const total = Object.values(byType).reduce((a, b) => a + b, 0)
                const labels: Record<string, string> = {
                  engaged: 'Engaged', new_lead: 'New Lead', new_customer: 'New Customer',
                  existing_customer: 'Existing Customer', merch_given: 'Merch Given',
                  sample_given: 'Sample Given', prize_won: 'Prize Won', photo_moment: 'Photo Moment',
                }
                return (
                  <div className="space-y-2">
                    {Object.entries(byType)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => {
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0
                        return (
                          <div key={type} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{labels[type] ?? type}</span>
                              <span className="font-medium">{count.toLocaleString()} ({pct}%)</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-foreground rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── Empty state ── */}
          {totalOohVisits === 0 && totalLeads === 0 && socialPosts.length === 0 && (
            <div className="border rounded-xl p-10 text-center space-y-2">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No performance data yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Performance data appears once OOH vanity links receive visits, event ambassadors start capturing leads, or social posts are linked to this campaign.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── OOH Placements ── */}
      {activeTab === 'ooh' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {oohSites.length} site{oohSites.length !== 1 ? 's' : ''} · {oohSites.reduce((s, site) => s + (site.visits ?? 0), 0).toLocaleString()} total visits
            </p>
            <div className="flex items-center gap-2">
              <LinkOohSiteDialog campaignId={campaign.id} availableSites={unlinkedSites} />
              <Link
                href={`/dashboard/ooh/new?campaign_id=${campaign.id}`}
                className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'inline-flex items-center')}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                New site
              </Link>
            </div>
          </div>

          {oohSites.length === 0 ? (
            <div className="border rounded-xl p-10 text-center space-y-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto">
                <MapPin className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No OOH sites in this campaign</p>
                <p className="text-xs text-muted-foreground mt-1">Add billboard sites or outdoor placements to track attribution.</p>
              </div>
              <Link
                href={`/dashboard/ooh/new?campaign_id=${campaign.id}`}
                className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
              >
                Add OOH site
              </Link>
            </div>
          ) : (
            <div className="divide-y border rounded-xl overflow-hidden">
              {oohSites.map(site => (
                <div key={site.id} className="flex items-center gap-4 px-4 py-3 bg-card hover:bg-muted/30 transition-colors">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/dashboard/ooh/${site.id}`} className="text-sm font-medium hover:underline truncate block">
                      {site.site_name}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate">
                      {[site.city, site.state].filter(Boolean).join(', ')}
                      {site.format_type ? ` · ${site.format_type}` : ''}
                      {site.monthly_cost ? ` · ${fmtMoney(site.monthly_cost, site.currency ?? 'NGN')}/mo` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums">{(site.visits ?? 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">visits</p>
                  </div>
                  <Link href={`/dashboard/ooh/${site.id}`} className="shrink-0 text-muted-foreground hover:text-foreground">
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Events ── */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {events.length} event{events.length !== 1 ? 's' : ''} linked to this campaign
            </p>
            <div className="flex items-center gap-2">
              <LinkEventDialog campaignId={campaign.id} availableEvents={unlinkedEvents} />
              <Link
                href={`/dashboard/events/new?campaign_id=${campaign.id}`}
                className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'inline-flex items-center')}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                New event
              </Link>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="border rounded-xl p-10 text-center space-y-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No events in this campaign</p>
                <p className="text-xs text-muted-foreground mt-1">Link activations, sponsorships, or events to measure their impact.</p>
              </div>
              <Link
                href={`/dashboard/events/new?campaign_id=${campaign.id}`}
                className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
              >
                Add event
              </Link>
            </div>
          ) : (
            <>
              <div className="divide-y border rounded-xl overflow-hidden">
                {events.map(ev => {
                  const evLeads = leadsByEvent[ev.id] ?? 0
                  return (
                    <div key={ev.id} className="flex items-center gap-4 px-4 py-3 bg-card hover:bg-muted/30 transition-colors">
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/events/${ev.id}`} className="text-sm font-medium hover:underline truncate">
                            {ev.name}
                          </Link>
                          <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0', EVENT_STATUS[ev.status] ?? 'bg-muted text-muted-foreground')}>
                            {ev.status.charAt(0).toUpperCase() + ev.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {ev.city}{ev.state ? `, ${ev.state}` : ''} · {fmtDate(ev.date_start)}
                          {ev.activation_type ? ` · ${ev.activation_type.replace(/_/g, ' ')}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right space-y-0.5">
                        {ev.expected_attendance != null && (
                          <>
                            <p className="text-sm tabular-nums">{ev.expected_attendance.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">est. attendance</p>
                          </>
                        )}
                        {evLeads > 0 && (
                          <p className="text-xs text-muted-foreground">{evLeads} leads</p>
                        )}
                      </div>
                      <Link href={`/dashboard/events/${ev.id}`} className="shrink-0 text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                  )
                })}
              </div>

              {/* BTL activations rollup */}
              {(() => {
                const btlEvents = events.filter(ev => ev.activation_type && ev.activation_type !== 'event')
                if (btlEvents.length === 0) return null
                const btlTotalAttendance = btlEvents.reduce((s, ev) => s + (Number(ev.expected_attendance) || 0), 0)
                const btlTotalLeads = btlEvents.reduce((s, ev) => s + (leadsByEvent[ev.id] ?? 0), 0)
                const btlBlendedCpl = null
                return (
                  <div className="border rounded-xl p-5 bg-card space-y-4">
                    <p className="text-sm font-semibold">BTL activations</p>
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-muted/30 rounded-xl p-3 space-y-0.5">
                        <p className="text-lg font-bold tabular-nums">{btlEvents.length}</p>
                        <p className="text-xs text-muted-foreground">Activations</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3 space-y-0.5">
                        <p className="text-lg font-bold tabular-nums">{btlTotalAttendance > 0 ? btlTotalAttendance.toLocaleString() : '—'}</p>
                        <p className="text-xs text-muted-foreground">Est. attendance</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3 space-y-0.5">
                        <p className="text-lg font-bold tabular-nums">{btlTotalLeads.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Total leads</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3 space-y-0.5">
                        <p className="text-lg font-bold tabular-nums">{btlBlendedCpl != null ? fmtMoney(btlBlendedCpl, campaign.currency) : '—'}</p>
                        <p className="text-xs text-muted-foreground">Blended CPL</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs min-w-[480px]">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left font-medium text-muted-foreground pb-2 pr-4">Activation</th>
                            <th className="text-left font-medium text-muted-foreground pb-2 pr-4">Type</th>
                            <th className="text-left font-medium text-muted-foreground pb-2 pr-4">Location</th>
                            <th className="text-left font-medium text-muted-foreground pb-2 pr-4">Date</th>
                            <th className="text-right font-medium text-muted-foreground pb-2">Leads</th>
                          </tr>
                        </thead>
                        <tbody>
                          {btlEvents.map(ev => {
                            const evLeads = leadsByEvent[ev.id] ?? 0
                            return (
                              <tr key={ev.id} className="border-b last:border-0">
                                <td className="py-2 pr-4">
                                  <Link href={`/dashboard/events/${ev.id}`} className="font-medium hover:underline">
                                    {ev.name}
                                  </Link>
                                </td>
                                <td className="py-2 pr-4 text-muted-foreground capitalize">
                                  {(ev.activation_type ?? '').replace(/_/g, ' ')}
                                </td>
                                <td className="py-2 pr-4 text-muted-foreground">{ev.city}</td>
                                <td className="py-2 pr-4 text-muted-foreground">{fmtDate(ev.date_start)}</td>
                                <td className="py-2 text-right">
                                  {evLeads > 0 ? evLeads : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })()}
            </>
          )}
        </div>
      )}

      {/* ── Influencers ── */}
      {activeTab === 'influencers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {influencers.length} influencer{influencers.length !== 1 ? 's' : ''} linked to this campaign
            </p>
            {unlinkedInfluencers.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setLinkingOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Link influencer
              </Button>
            )}
          </div>

          {influencers.length === 0 ? (
            <div className="border rounded-xl p-10 text-center space-y-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No influencers linked yet</p>
                <p className="text-xs text-muted-foreground mt-1">Link influencers to this campaign to track their contribution.</p>
              </div>
              {unlinkedInfluencers.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setLinkingOpen(true)}>
                  Link influencer
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {influencers.map(inf => (
                <CampaignInfluencerCard key={inf.id} inf={inf} campaignId={campaign.id} />
              ))}
            </div>
          )}

          {/* Link influencer dialog */}
          {linkingOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setLinkingOpen(false)}>
              <div className="bg-background border rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold">Link influencer to campaign</p>
                  <button onClick={() => setLinkingOpen(false)} className="text-muted-foreground hover:text-foreground">
                    <span className="sr-only">Close</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Select one or more active influencers to link to this campaign.</p>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {unlinkedInfluencers.map(inf => (
                    <label key={inf.id} className="flex items-center gap-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/40 transition-colors">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border"
                        checked={selectedIds.has(inf.id)}
                        onChange={e => {
                          const next = new Set(selectedIds)
                          if (e.target.checked) next.add(inf.id)
                          else next.delete(inf.id)
                          setSelectedIds(next)
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{inf.name}</p>
                        <p className="text-xs text-muted-foreground">@{inf.handle} · {formatPlatformLabel(inf.platform)} · {formatFollowers(inf.followers)}</p>
                      </div>
                      <CulturalIQBadge score={inf.cultural_iq} />
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setLinkingOpen(false); setSelectedIds(new Set()) }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={selectedIds.size === 0 || linking}
                    onClick={() => {
                      startLinking(async () => {
                        try {
                          await Promise.all(
                            Array.from(selectedIds).map(id => linkInfluencerToCampaign(id, campaign.id))
                          )
                          toast.success(`${selectedIds.size} influencer${selectedIds.size !== 1 ? 's' : ''} linked.`)
                          setLinkingOpen(false)
                          setSelectedIds(new Set())
                          router.refresh()
                        } catch {
                          toast.error('Failed to link influencers. Please try again.')
                        }
                      })
                    }}
                  >
                    {linking ? 'Linking…' : `Link ${selectedIds.size > 0 ? selectedIds.size : ''}`}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Budget ── */}
      {activeTab === 'budget' && (
        <div className="space-y-4">
          {/* Budget overview table */}
          <div className="border rounded-xl p-5 bg-card space-y-4">
            <p className="text-sm font-medium">Budget overview</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm border-b pb-3">
                <span className="text-muted-foreground">Total campaign budget</span>
                <span className="font-semibold">{fmtMoney(campaign.total_budget, campaign.currency)}</span>
              </div>

              {channelAlloc.length > 0 && channelAlloc.map(ch => {
                const meta   = CHANNEL_META[ch.channel]
                const linked = ch.objectives ?? []
                return (
                  <div key={ch.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className={cn('h-2 w-2 rounded-full', meta?.color ?? 'bg-muted-foreground')} />
                        <span>{meta?.label ?? ch.channel}</span>
                      </div>
                      <span>{ch.budget_allocation ? fmtMoney(ch.budget_allocation, campaign.currency) : <span className="text-muted-foreground text-xs">Not allocated</span>}</span>
                    </div>
                    {linked.length > 0 && (
                      <div className="flex gap-1.5 pl-3.5">
                        {linked.map(obj => (
                          <span key={obj} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <span className={cn('h-1.5 w-1.5 rounded-full', OBJECTIVE_COLOR[obj] ?? 'bg-muted-foreground')} />
                            {OBJECTIVE_LABELS[obj] ?? obj}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {totalAllocated > 0 && (
                <div className="flex justify-between text-sm border-t pt-3">
                  <span className="text-muted-foreground">Total allocated</span>
                  <span className="font-semibold">{fmtMoney(totalAllocated, campaign.currency)}</span>
                </div>
              )}

              {campaign.total_budget && totalAllocated > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className={Number(campaign.total_budget) - totalAllocated < 0 ? 'text-destructive' : ''}>
                    {fmtMoney(Math.abs(Number(campaign.total_budget) - totalAllocated), campaign.currency)}
                    {Number(campaign.total_budget) - totalAllocated < 0 ? ' over' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Channel × objective attribution */}
          {channelAlloc.length > 0 && objectives.length > 0 && channelAlloc.some(ch => ch.objectives?.length > 0) && (
            <div className="border rounded-xl p-5 bg-card space-y-3">
              <p className="text-sm font-medium">Channel attribution</p>
              <p className="text-xs text-muted-foreground">Which channels are contributing to each campaign objective.</p>
              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full text-xs min-w-[480px]">
                  <thead>
                    <tr>
                      <th className="text-left text-muted-foreground font-medium pb-2 pr-4">Channel</th>
                      {objectives.map(obj => (
                        <th key={obj} className="text-center text-muted-foreground font-medium pb-2 px-2">
                          {OBJECTIVE_LABELS[obj] ?? obj}
                        </th>
                      ))}
                      <th className="text-right text-muted-foreground font-medium pb-2 pl-4">Budget</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {channelAlloc.map(ch => {
                      const meta   = CHANNEL_META[ch.channel]
                      const linked = ch.objectives ?? []
                      return (
                        <tr key={ch.id}>
                          <td className="py-2 pr-4">
                            <div className="flex items-center gap-1.5 font-medium">
                              <span className={cn('h-2 w-2 rounded-full shrink-0', meta?.color ?? 'bg-muted-foreground')} />
                              {meta?.label ?? ch.channel}
                            </div>
                          </td>
                          {objectives.map(obj => (
                            <td key={obj} className="text-center py-2 px-2">
                              {linked.includes(obj)
                                ? <span className={cn('inline-block h-3 w-3 rounded-full', OBJECTIVE_COLOR[obj] ?? 'bg-foreground')} />
                                : <span className="text-muted-foreground/30">·</span>
                              }
                            </td>
                          ))}
                          <td className="text-right py-2 pl-4 tabular-nums">
                            {ch.budget_allocation ? fmtMoney(ch.budget_allocation, campaign.currency) : <span className="text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Channel creative assets */}
          {channelAlloc.length > 0 && (
            <div className="border rounded-xl p-5 bg-card space-y-4">
              <div>
                <p className="text-sm font-medium">Channel creative assets</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Optional. Upload channel-specific creatives (posters, digital banners, activation photos) so E6 visual detection can spot this campaign&apos;s branded materials in event photos.
                </p>
              </div>
              {/* Hidden file input */}
              <input
                ref={creativeInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={handleCreativeUpload}
              />
              <div className="space-y-4">
                {channelAlloc.map(ch => {
                  const meta    = CHANNEL_META[ch.channel]
                  const urls    = channelCreatives[ch.id] ?? []
                  const loading = uploadingChannel === ch.id
                  return (
                    <div key={ch.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className={cn('h-2 w-2 rounded-full shrink-0', meta?.color ?? 'bg-muted-foreground')} />
                          <span className="font-medium">{meta?.label ?? ch.channel}</span>
                          {urls.length > 0 && (
                            <span className="text-xs text-muted-foreground">· {urls.length} asset{urls.length !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => triggerCreativeUpload(ch.id)}
                          disabled={loading || uploadingChannel !== null}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        >
                          {loading
                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Uploading…</>
                            : <><Upload className="h-3.5 w-3.5" />Add creative</>}
                        </button>
                      </div>
                      {urls.length > 0 && (
                        <div className="flex flex-wrap gap-2 pl-3.5">
                          {urls.map(url => (
                            <div key={url} className="relative group h-16 w-16 rounded-lg border overflow-hidden bg-muted">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="Creative asset" className="h-full w-full object-cover" loading="lazy" />
                              <button
                                type="button"
                                onClick={() => handleCreativeDelete(ch.id, url)}
                                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                              >
                                <X className="h-4 w-4 text-white" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {urls.length === 0 && (
                        <div className="pl-3.5">
                          <div className="h-12 rounded-lg border border-dashed flex items-center justify-center gap-2 text-xs text-muted-foreground/50">
                            <ImageIcon className="h-4 w-4" />
                            No creatives yet — add one above
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* OOH site costs */}
          {oohSites.length > 0 && (
            <div className="border rounded-xl p-5 bg-card space-y-3">
              <p className="text-sm font-medium">OOH site costs</p>
              <div className="space-y-2">
                {oohSites.map(site => (
                  <div key={site.id} className="flex justify-between text-sm">
                    <span className="truncate mr-4">{site.site_name}</span>
                    <span className="shrink-0 text-muted-foreground">{fmtMoney(site.monthly_cost, site.currency ?? 'NGN')}/mo</span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between text-sm font-medium">
                  <span>Total OOH monthly</span>
                  <span>{fmtMoney(totalOohSpend, campaign.currency)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
