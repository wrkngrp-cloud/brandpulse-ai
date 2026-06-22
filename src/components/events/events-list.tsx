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
import { formatNGN, cn } from '@/lib/utils'

interface Event {
  id:                   string
  name:                 string
  activation_type:      string | null
  city:                 string
  state:                string | null
  day:                  string
  status:               string
  estimated_attendance: number | null
  actual_attendance:    number | null
  currency:             string | null
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  planned:  { label: 'Planned',  variant: 'secondary' },
  live:     { label: 'Live',     variant: 'default'   },
  closed:   { label: 'Closed',   variant: 'outline'   },
  reported: { label: 'Reported', variant: 'outline'   },
}

const ACTIVATION_LABELS: Record<string, string> = {
  event:              'Branded Event',
  sampling:           'Sampling',
  roadshow:           'Roadshow',
  church_mosque:      'Church / Mosque',
  school_contact:     'School Contact',
  estate_community:   'Estate / Community',
  market_activation:  'Market Activation',
  branded_truck:      'Branded Truck',
  sports_sponsorship: 'Sports Sponsorship',
  concert_festival:   'Concert / Festival',
}

function activationBadgeClass(type: string): string {
  if (['sampling', 'roadshow', 'market_activation'].includes(type)) {
    return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
  }
  if (['church_mosque', 'estate_community', 'school_contact'].includes(type)) {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
  }
  if (['branded_truck', 'sports_sponsorship', 'concert_festival'].includes(type)) {
    return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
  }
  return 'bg-muted text-muted-foreground'
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function EventRow({ ev }: { ev: Event }) {
  const router = useRouter()
  const [, start] = useTransition()

  const badge = STATUS_BADGE[ev.status] ?? STATUS_BADGE.planned
  const activationType = ev.activation_type

  const actions: ItemAction[] = [
    {
      label:   'View event',
      icon:    ExternalLink,
      onClick: () => router.push(`/dashboard/events/${ev.id}`),
    },
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
    {
      label:              'Delete event',
      icon:               Trash2,
      variant:            'destructive' as const,
      separator:          true,
      requireConfirm:     true,
      confirmTitle:       'Delete event',
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
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm truncate">{ev.name}</p>
              <Badge variant={badge.variant} className="text-xs shrink-0">{badge.label}</Badge>
              {activationType && (
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
                  activationBadgeClass(activationType),
                )}>
                  {ACTIVATION_LABELS[activationType] ?? activationType}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {fmtDate(ev.day)}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {ev.city}{ev.state ? `, ${ev.state}` : ''}
              </span>
            </div>
          </div>
          {ev.estimated_attendance != null && (
            <div className="text-right shrink-0 pr-8">
              <p className="text-xs text-muted-foreground">Est. Attendance</p>
              <p className="text-sm font-medium">{ev.estimated_attendance.toLocaleString()}</p>
            </div>
          )}
        </div>
      </Link>

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
