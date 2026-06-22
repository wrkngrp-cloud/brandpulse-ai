'use client'

import { useRouter }  from 'next/navigation'
import { useTransition } from 'react'
import { toast }      from 'sonner'
import Link           from 'next/link'
import { Badge }      from '@/components/ui/badge'
import { ItemActions, type ItemAction } from '@/components/ui/item-actions'
import { goLive, closeEvent, deleteEvent } from '@/app/dashboard/events/actions'
import {
  CalendarDays, MapPin, Radio, Square,
  ClipboardEdit, Trash2, ExternalLink,
} from 'lucide-react'
import { formatNGN } from '@/lib/utils'

interface Event {
  id:         string
  name:       string
  event_type: string | null
  city:       string
  state:      string | null
  date_start: string
  date_end:   string
  status:     string
  budget:     number | string | null
  currency:   string | null
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  planned:  { label: 'Planned',  variant: 'secondary' },
  live:     { label: 'Live',     variant: 'default'   },
  closed:   { label: 'Closed',   variant: 'outline'   },
  reported: { label: 'Reported', variant: 'outline'   },
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function EventRow({ ev }: { ev: Event }) {
  const router = useRouter()
  const [, start] = useTransition()

  const badge = STATUS_BADGE[ev.status] ?? STATUS_BADGE.planned

  const actions: ItemAction[] = [
    {
      label:   'View event',
      icon:    ExternalLink,
      onClick: () => router.push(`/dashboard/events/${ev.id}`),
    },
    // Status-specific actions
    ...(ev.status === 'planned' ? [{
      label:   'Go live',
      icon:    Radio,
      onClick: () => start(async () => {
        const r = await goLive(ev.id)
        if (r?.error) toast.error(r.error)
        else toast.success('Event is now live!')
      }),
    }] : []),
    ...(ev.status === 'live' ? [{
      label:   'Close event',
      icon:    Square,
      onClick: () => start(async () => {
        const r = await closeEvent(ev.id)
        if (r?.error) toast.error(r.error)
        else toast.success('Event closed — ROI report generating…')
      }),
    }] : []),
    ...(['closed', 'reported'].includes(ev.status) ? [{
      label:   ev.status === 'reported' ? 'Edit debrief' : 'Fill debrief',
      icon:    ClipboardEdit,
      onClick: () => router.push(`/dashboard/events/${ev.id}/debrief`),
    }] : []),
    // Destructive
    {
      label:             'Delete event',
      icon:              Trash2,
      variant:           'destructive' as const,
      separator:         true,
      requireConfirm:    true,
      confirmTitle:      'Delete event',
      confirmDescription: `"${ev.name}" and all its interactions, leads, and reports will be permanently deleted.`,
      onClick: () => start(async () => {
        const r = await deleteEvent(ev.id)
        if (r?.error) toast.error(r.error)
        else toast.success('Event deleted.')
      }),
    },
  ]

  return (
    <div className="group relative flex items-center border rounded-xl hover:bg-muted/40 transition-colors">
      <Link
        href={`/dashboard/events/${ev.id}`}
        className="flex-1 p-4 min-w-0 block"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm truncate">{ev.name}</p>
              <Badge variant={badge.variant} className="text-xs shrink-0">{badge.label}</Badge>
            </div>
            {ev.event_type && (
              <p className="text-xs text-muted-foreground capitalize">{ev.event_type}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {fmtDate(ev.date_start)}{ev.date_end !== ev.date_start && ` – ${fmtDate(ev.date_end)}`}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {ev.city}{ev.state ? `, ${ev.state}` : ''}
              </span>
            </div>
          </div>
          {ev.budget && (
            <div className="text-right shrink-0 pr-8">
              <p className="text-xs text-muted-foreground">Budget</p>
              <p className="text-sm font-medium">
                {ev.currency === 'NGN' ? formatNGN(Number(ev.budget)) : `${ev.currency} ${Number(ev.budget).toLocaleString('en-NG')}`}
              </p>
            </div>
          )}
        </div>
      </Link>

      {/* Three-dot menu */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        <ItemActions actions={actions} />
      </div>
    </div>
  )
}

export function EventsList({ events }: { events: Event[] }) {
  return (
    <div className="space-y-3">
      {events.map(ev => <EventRow key={ev.id} ev={ev} />)}
    </div>
  )
}
