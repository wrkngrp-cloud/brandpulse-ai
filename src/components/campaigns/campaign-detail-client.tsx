'use client'

import Link           from 'next/link'
import { useRouter }  from 'next/navigation'
import { cn }         from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { MapPin, CalendarDays, DollarSign, BarChart2, Plus, ExternalLink } from 'lucide-react'

interface Channel { id: string; channel: string; budget_allocation: number | null }

interface Campaign {
  id: string; name: string; description: string | null; objective: string | null
  start_date: string | null; end_date: string | null
  total_budget: number | null; currency: string; status: string; ai_summary: string | null
  campaign_channels: Channel[]
}

interface OohSite {
  id: string; site_name: string; city: string | null; state: string | null
  format_type: string | null; visits: number; campaign_start: string | null
  campaign_end: string | null; vanity_slug: string | null; lat: number | null; lng: number | null
  monthly_cost: number | null; currency: string | null; lga: string | null
}

interface Event {
  id: string; name: string; event_type: string | null; city: string; state: string | null
  date_start: string; date_end: string; status: string; budget: number | null; currency: string
}

interface Props {
  campaign: Campaign
  oohSites: OohSite[]
  events: Event[]
  activeTab: string
}

const TABS = [
  { key: 'overview', label: 'Overview',        icon: BarChart2 },
  { key: 'ooh',      label: 'OOH Placements',  icon: MapPin },
  { key: 'events',   label: 'Events',           icon: CalendarDays },
  { key: 'budget',   label: 'Budget',           icon: DollarSign },
]

const OBJECTIVE_LABELS: Record<string, string> = {
  awareness: 'Brand Awareness', consideration: 'Consideration',
  conversion: 'Conversion',     retention: 'Retention',
}

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-muted text-muted-foreground',
  active:    'bg-green-100 text-green-800',
  paused:    'bg-amber-100 text-amber-800',
  completed: 'bg-blue-100 text-blue-800',
}

const EVENT_STATUS: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-800',
  live:    'bg-green-100 text-green-800',
  closed:  'bg-muted text-muted-foreground',
  reported:'bg-purple-100 text-purple-800',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtMoney(amount: number | null, currency = 'NGN') {
  if (!amount) return '—'
  return `${currency} ${Number(amount).toLocaleString('en-NG')}`
}

export function CampaignDetailClient({ campaign, oohSites, events, activeTab }: Props) {
  const router = useRouter()

  const totalVisits       = oohSites.reduce((s, site) => s + (site.visits ?? 0), 0)
  const totalOohSpend     = oohSites.reduce((s, site) => s + (site.monthly_cost ?? 0), 0)
  const channelAlloc      = campaign.campaign_channels ?? []
  const totalAllocated    = channelAlloc.reduce((s, c) => s + (c.budget_allocation ?? 0), 0)

  return (
    <div className="space-y-5">
      {/* Status + meta */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_STYLES[campaign.status] ?? STATUS_STYLES.draft)}>
          {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
        </span>
        {campaign.objective && (
          <span className="text-xs text-muted-foreground">{OBJECTIVE_LABELS[campaign.objective] ?? campaign.objective}</span>
        )}
        <span className="text-xs text-muted-foreground">
          {campaign.start_date ? fmtDate(campaign.start_date) : ''}
          {campaign.end_date ? ` – ${fmtDate(campaign.end_date)}` : campaign.start_date ? ' · Always On' : ''}
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
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'OOH sites',        value: oohSites.length.toString() },
              { label: 'Total visits',      value: totalVisits.toLocaleString() },
              { label: 'Events',            value: events.length.toString() },
              { label: 'Total budget',      value: fmtMoney(campaign.total_budget, campaign.currency) },
            ].map(m => (
              <div key={m.label} className="border rounded-xl p-4 bg-card space-y-1">
                <p className="text-lg font-semibold tabular-nums">{m.value}</p>
                <p className="text-xs text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Campaign details */}
          <div className="border rounded-xl p-5 bg-card space-y-3">
            <p className="text-sm font-medium">Campaign details</p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {campaign.objective && (<><dt className="text-muted-foreground">Objective</dt><dd>{OBJECTIVE_LABELS[campaign.objective] ?? campaign.objective}</dd></>)}
              {campaign.start_date && (<><dt className="text-muted-foreground">Start date</dt><dd>{fmtDate(campaign.start_date)}</dd></>)}
              {campaign.end_date && (<><dt className="text-muted-foreground">End date</dt><dd>{fmtDate(campaign.end_date)}</dd></>)}
              {!campaign.end_date && campaign.start_date && (<><dt className="text-muted-foreground">End date</dt><dd className="text-muted-foreground italic">Always On</dd></>)}
              {campaign.total_budget && (<><dt className="text-muted-foreground">Total budget</dt><dd>{fmtMoney(campaign.total_budget, campaign.currency)}</dd></>)}
            </dl>
          </div>

          {/* Channels */}
          {channelAlloc.length > 0 && (
            <div className="border rounded-xl p-5 bg-card space-y-3">
              <p className="text-sm font-medium">Active channels</p>
              <div className="flex flex-wrap gap-2">
                {channelAlloc.map(c => (
                  <span key={c.id} className="text-xs bg-muted px-2.5 py-1 rounded-lg font-medium uppercase">
                    {c.channel}
                    {c.budget_allocation ? ` · ${fmtMoney(c.budget_allocation, campaign.currency)}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* AI summary placeholder */}
          <div className="border rounded-xl p-5 bg-card space-y-3">
            <p className="text-sm font-medium">AI campaign summary</p>
            {campaign.ai_summary ? (
              <p className="text-sm text-muted-foreground leading-relaxed">{campaign.ai_summary}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                AI analysis will appear here once your OOH sites start collecting visit data or your events start logging interactions.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── OOH Placements ── */}
      {activeTab === 'ooh' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {oohSites.length} site{oohSites.length !== 1 ? 's' : ''} · {totalVisits.toLocaleString()} total visits
            </p>
            <Link
              href={`/dashboard/ooh/new?campaign_id=${campaign.id}`}
              className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'inline-flex items-center')}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add OOH site
            </Link>
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
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {events.length} event{events.length !== 1 ? 's' : ''} linked to this campaign
            </p>
            <Link
              href={`/dashboard/events/new?campaign_id=${campaign.id}`}
              className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'inline-flex items-center')}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add event
            </Link>
          </div>

          {events.length === 0 ? (
            <div className="border rounded-xl p-10 text-center space-y-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No events in this campaign</p>
                <p className="text-xs text-muted-foreground mt-1">Link activations, sponsorships, or events to measure their impact as part of this campaign.</p>
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
                      <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', EVENT_STATUS[ev.status] ?? 'bg-muted text-muted-foreground')}>
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
          <div className="border rounded-xl p-5 bg-card space-y-4">
            <p className="text-sm font-medium">Budget overview</p>
            <div className="space-y-3">
              <div className="flex justify-between text-sm border-b pb-3">
                <span className="text-muted-foreground">Total campaign budget</span>
                <span className="font-semibold">{fmtMoney(campaign.total_budget, campaign.currency)}</span>
              </div>
              {channelAlloc.length > 0 && channelAlloc.map(ch => (
                <div key={ch.id} className="flex justify-between text-sm">
                  <span className="capitalize">{ch.channel}</span>
                  <span>{ch.budget_allocation ? fmtMoney(ch.budget_allocation, campaign.currency) : <span className="text-muted-foreground">Not allocated</span>}</span>
                </div>
              ))}
              {totalAllocated > 0 && (
                <div className="flex justify-between text-sm border-t pt-3">
                  <span className="text-muted-foreground">Total allocated</span>
                  <span className="font-semibold">{fmtMoney(totalAllocated, campaign.currency)}</span>
                </div>
              )}
            </div>
          </div>

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
