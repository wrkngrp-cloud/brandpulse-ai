'use client'

import Link           from 'next/link'
import { useRouter }  from 'next/navigation'
import { cn }         from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { MapPin, CalendarDays, DollarSign, BarChart2, Plus, ExternalLink } from 'lucide-react'
import { CampaignOverview } from './campaign-overview'
import { LinkOohSiteDialog, LinkEventDialog } from './link-existing-dialog'

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

interface Props {
  campaign: Campaign
  oohSites: OohSite[]
  events: Event[]
  activeTab: string
  unlinkedSites?: UnlinkedSite[]
  unlinkedEvents?: UnlinkedEvent[]
}

const TABS = [
  { key: 'overview', label: 'Overview',       icon: BarChart2    },
  { key: 'ooh',      label: 'OOH Placements', icon: MapPin       },
  { key: 'events',   label: 'Events',          icon: CalendarDays },
  { key: 'budget',   label: 'Budget',          icon: DollarSign   },
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

export function CampaignDetailClient({ campaign, oohSites, events, activeTab, unlinkedSites = [], unlinkedEvents = [] }: Props) {
  const router = useRouter()

  const objectives    = campaign.objectives ?? []
  const channelAlloc  = campaign.campaign_channels ?? []
  const totalAllocated = channelAlloc.reduce((s, c) => s + (Number(c.budget_allocation) || 0), 0)
  const totalOohSpend  = oohSites.reduce((s, site) => s + (Number(site.monthly_cost) || 0), 0)

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
