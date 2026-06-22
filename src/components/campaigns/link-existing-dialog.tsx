'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Link2, X, Loader2, MapPin, CalendarDays, Check } from 'lucide-react'
import { linkOohSiteToCampaign, linkEventToCampaign } from '@/app/dashboard/campaigns/actions'

interface OohSiteOption {
  id: string
  site_name: string
  city: string | null
  state: string | null
  format_type: string | null
  visits: number
}

interface EventOption {
  id: string
  name: string
  city: string
  day: string | null
  status: string
  activation_type: string | null
}

interface LinkOohDialogProps {
  campaignId: string
  availableSites: OohSiteOption[]
}

interface LinkEventDialogProps {
  campaignId: string
  availableEvents: EventOption[]
}

function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function LinkOohSiteDialog({ campaignId, availableSites }: LinkOohDialogProps) {
  const [open, setOpen]     = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [done, setDone]     = useState(false)

  function handleLink() {
    if (!selected) return
    startTransition(async () => {
      const result = await linkOohSiteToCampaign(selected, campaignId)
      if (!result.error) {
        setDone(true)
        setTimeout(() => { setOpen(false); setDone(false); setSelected(null) }, 800)
      }
    })
  }

  if (availableSites.length === 0) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-lg px-2.5 py-1.5 transition-colors"
      >
        <Link2 className="h-3.5 w-3.5" />
        Link existing site
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-background border rounded-2xl shadow-xl w-full max-w-md space-y-4 p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Link an OOH site to this campaign</p>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              These are your Always On sites (not yet linked to a campaign).
            </p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {availableSites.map(site => (
                <button
                  key={site.id}
                  onClick={() => setSelected(site.id)}
                  className={cn(
                    'w-full text-left border rounded-xl px-3 py-2.5 transition-colors flex items-center gap-3',
                    selected === site.id ? 'border-foreground bg-muted' : 'hover:bg-muted/50',
                  )}
                >
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{site.site_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[site.city, site.state].filter(Boolean).join(', ')}
                      {site.format_type ? ` · ${site.format_type}` : ''}
                      {` · ${site.visits.toLocaleString()} visits`}
                    </p>
                  </div>
                  {selected === site.id && <Check className="h-4 w-4 shrink-0" />}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
              <Button size="sm" onClick={handleLink} disabled={!selected || pending || done} className="flex-1">
                {done ? <><Check className="h-3.5 w-3.5 mr-1.5" /> Linked</> :
                 pending ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Linking…</> :
                 'Link site'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function LinkEventDialog({ campaignId, availableEvents }: LinkEventDialogProps) {
  const [open, setOpen]     = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [done, setDone]     = useState(false)

  function handleLink() {
    if (!selected) return
    startTransition(async () => {
      const result = await linkEventToCampaign(selected, campaignId)
      if (!result.error) {
        setDone(true)
        setTimeout(() => { setOpen(false); setDone(false); setSelected(null) }, 800)
      }
    })
  }

  if (availableEvents.length === 0) return null

  const STATUS_COLOURS: Record<string, string> = {
    planned:  'bg-blue-100 text-blue-800',
    live:     'bg-green-100 text-green-800',
    closed:   'bg-muted text-muted-foreground',
    reported: 'bg-purple-100 text-purple-800',
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-lg px-2.5 py-1.5 transition-colors"
      >
        <Link2 className="h-3.5 w-3.5" />
        Link existing event
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-background border rounded-2xl shadow-xl w-full max-w-md space-y-4 p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Link an event to this campaign</p>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              These events are not yet linked to any campaign.
            </p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {availableEvents.map(ev => (
                <button
                  key={ev.id}
                  onClick={() => setSelected(ev.id)}
                  className={cn(
                    'w-full text-left border rounded-xl px-3 py-2.5 transition-colors flex items-center gap-3',
                    selected === ev.id ? 'border-foreground bg-muted' : 'hover:bg-muted/50',
                  )}
                >
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{ev.name}</p>
                      <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0', STATUS_COLOURS[ev.status] ?? 'bg-muted text-muted-foreground')}>
                        {ev.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {ev.city}
                      {ev.activation_type ? ` · ${ev.activation_type}` : ''}
                      {ev.day ? ` · ${fmtDate(ev.day)}` : ''}
                    </p>
                  </div>
                  {selected === ev.id && <Check className="h-4 w-4 shrink-0" />}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
              <Button size="sm" onClick={handleLink} disabled={!selected || pending || done} className="flex-1">
                {done ? <><Check className="h-3.5 w-3.5 mr-1.5" /> Linked</> :
                 pending ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Linking…</> :
                 'Link event'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
