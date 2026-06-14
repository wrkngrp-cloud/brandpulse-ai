'use client'

import Link           from 'next/link'
import { useRouter }  from 'next/navigation'
import { cn }         from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { MapPin, CalendarDays, DollarSign, BarChart2, Plus, ExternalLink, TrendingUp, Users, Eye, Percent } from 'lucide-react'
import { CampaignOverview } from './campaign-overview'
import { LinkOohSiteDialog, LinkEventDialog } from './link-existing-dialog'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Channel {
  id: string
  channel: string
  budget_allocation: number | null
  objectives: string[]
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
  city: string
  state: string | null
  date_start: string
  date_end: string
  status: string
  budget: number | null
  currency: string
}

interface UnlinkedSite { id: string; site_name: string; city: string | null; state: string | null; format_type: string | null; visits: number }
interface UnlinkedEvent { id: string; name: string; event_type: string | null; city: string; date_start: string; status: string }

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
}

const TABS = [
  { key: 'overview',     label: 'Overview',       icon: BarChart2    },
  { key: 'performance',  label: 'Performance',    icon: TrendingUp   },
  { key: 'ooh',          label: 'OOH Placements', icon: MapPin       },
  { key: 'events',       label: 'Events',          icon: CalendarDays },
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

export function CampaignDetailClient({ campaign, oohSites, events, activeTab, unlinkedSites = [], unlinkedEvents = [], interactions = [], socialPosts = [], oohVisits = [] }: Props) {
  const router = useRouter()

  const objectives     = campaign.objectives ?? []
  const channelAlloc   = campaign.campaign_channels ?? []
  const totalAllocated = channelAlloc.reduce((s, c) => s + (Number(c.budget_allocation) || 0), 0)
  const totalOohSpend  = oohSites.reduce((s, site) => s + (Number(site.monthly_cost) || 0), 0)

  // Performance aggregates
  const totalOohVisits   = oohSites.reduce((s, site) => s + (site.visits ?? 0), 0)
  const totalEventBudget = events.reduce((s, ev) => s + (Number(ev.budget) || 0), 0)
  const totalLeads       = interactions.filter(i => i.interaction_type === 'new_lead').length
  const totalEngaged     = interactions.filter(i => ['new_lead','new_customer','engaged'].includes(i.interaction_type)).length
  const totalSpend       = totalOohSpend + totalEventBudget
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
      {/* Status + objectives pills */}
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
          campaign={campaign}
          oohSites={oohSites.map(s => ({
            visits:       s.visits,
            monthly_cost: s.monthly_cost,
            currency:     s.currency,
          }))}
          events={events.map(e => ({ status: e.status }))}
        />
      )}

      {/* ── Performance ── */}
      {activeTab === 'performance' && (
        <div className="space-y-5">

          {/* ── Summary KPI row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Total Spend',
                value: fmtMoney(totalSpend || null, campaign.currency),
                icon: DollarSign,
                sub: 'OOH + event budgets',
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
                      <th className="text-right text-muted-foreground font-medium pb-2 pr-4">Budget</th>
                      <th className="text-right text-muted-foreground font-medium pb-2">CPL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {events.map(ev => {
                      const leads     = leadsByEvent[ev.id] ?? 0
                      const evCpl     = leads > 0 && ev.budget ? Math.round(Number(ev.budget) / leads) : null
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
                            {fmtMoney(ev.budget, ev.currency)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {evCpl !== null ? fmtMoney(evCpl, ev.currency) : <span className="text-muted-foreground">—</span>}
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
                        <td className="pt-2 text-right tabular-nums font-semibold">{fmtMoney(totalEventBudget || null, campaign.currency)}</td>
                        <td className="pt-2 text-right tabular-nums font-semibold">{cpl !== null ? fmtMoney(cpl, campaign.currency) : '—'}</td>
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
              <div className="grid grid-cols-3 gap-3">
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
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                        tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                      />
                      <Tooltip
                        contentStyle={{
                          fontSize: 12,
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                        }}
                        formatter={(value) => [Number(value).toLocaleString(), 'Impressions']}
                      />
                      <Bar dataKey="impressions" fill="hsl(var(--foreground))" radius={[3, 3, 0, 0]} />
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
            <div className="divide-y border rounded-xl overflow-hidden">
              {events.map(ev => (
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
                      {ev.event_type ? ` · ${ev.event_type}` : ''}
                    </p>
                  </div>
                  {ev.budget && (
                    <div className="shrink-0 text-right">
                      <p className="text-sm tabular-nums">{fmtMoney(ev.budget, ev.currency)}</p>
                      <p className="text-xs text-muted-foreground">budget</p>
                    </div>
                  )}
                  <Link href={`/dashboard/events/${ev.id}`} className="shrink-0 text-muted-foreground hover:text-foreground">
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              ))}
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
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
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
