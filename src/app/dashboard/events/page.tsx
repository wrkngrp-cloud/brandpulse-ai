import { createClient }  from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import Link              from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { EventsList }    from '@/components/events/events-list'
import { CalendarDays, Plus } from 'lucide-react'
import { cn }            from '@/lib/utils'

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
        <EventsList events={events} />
      )}
    </div>
  )
}
