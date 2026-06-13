import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import Link             from 'next/link'
import { Badge }        from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { CalendarDays, MapPin, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  planned:  { label: 'Planned',   variant: 'secondary' },
  live:     { label: 'Live',      variant: 'default'   },
  closed:   { label: 'Closed',    variant: 'outline'   },
  reported: { label: 'Reported',  variant: 'outline'   },
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function EventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) redirect('/onboarding')

  const { data: events } = await supabase
    .from('events')
    .select('id, name, event_type, city, state, date_start, date_end, status, budget, currency')
    .eq('brand_id', brand.id)
    .order('date_start', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Events & Activations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track ROI from field activations, sponsorships, and events.</p>
        </div>
        <Link href="/dashboard/events/new" className={cn(buttonVariants({ size: 'sm' }), 'inline-flex items-center')}>
          <Plus className="h-4 w-4 mr-1.5" />
          Create event
        </Link>
      </div>

      {!events?.length ? (
        <div className="border rounded-xl p-12 text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto">
            <CalendarDays className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm">No events yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create your first event to start tracking activations and ROI.
            </p>
          </div>
          <Link href="/dashboard/events/new" className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
            Create event
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(ev => {
            const badge = STATUS_BADGE[ev.status] ?? STATUS_BADGE.planned
            return (
              <Link
                key={ev.id}
                href={`/dashboard/events/${ev.id}`}
                className="block border rounded-xl p-4 hover:bg-muted/40 transition-colors"
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
                        {fmtDate(ev.date_start)}
                        {ev.date_end !== ev.date_start && ` – ${fmtDate(ev.date_end)}`}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {ev.city}{ev.state ? `, ${ev.state}` : ''}
                      </span>
                    </div>
                  </div>
                  {ev.budget && (
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">Budget</p>
                      <p className="text-sm font-medium">
                        {ev.currency} {Number(ev.budget).toLocaleString('en-NG')}
                      </p>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
