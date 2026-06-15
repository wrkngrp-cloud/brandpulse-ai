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
        <div className="space-y-4">
          {/* Demo preview card */}
          <div className="border rounded-xl p-5 bg-card space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                Demo preview
              </span>
              <p className="text-xs text-muted-foreground">
                This is how your event dashboard looks — create your first event to get started.
              </p>
            </div>
            <div className="border rounded-xl p-4 bg-muted/30 space-y-3 opacity-80 pointer-events-none">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="font-medium text-sm">Jara Foods Lagos Consumer Fair</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> 14 Jun 2025 — 16 Jun 2025</span>
                    <span>Lagos, Lagos State</span>
                    <span>Product Activation</span>
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 shrink-0">
                  Live
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-2 border-t">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Ambassadors</p>
                  <p className="text-sm font-semibold">8</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Interactions</p>
                  <p className="text-sm font-semibold">247</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Leads captured</p>
                  <p className="text-sm font-semibold">63</p>
                </div>
              </div>
            </div>
          </div>

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
        </div>
      ) : (
        <EventsList events={events} />
      )}
    </div>
  )
}
