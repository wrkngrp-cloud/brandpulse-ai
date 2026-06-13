import { createClient }       from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link                   from 'next/link'
import { ArrowLeft }          from 'lucide-react'
import { DebriefForm }        from '@/components/events/debrief-form'

export default async function DebriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: event } = await supabase
    .from('events')
    .select('id, name, status, debrief, city, date_start')
    .eq('id', id)
    .single()

  if (!event) notFound()
  if (event.status === 'planned' || event.status === 'live') redirect(`/dashboard/events/${id}`)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href={`/dashboard/events/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {event.name}
        </Link>
        <h1 className="text-xl font-semibold">Post-event debrief</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Capture field intelligence while it is still fresh.
        </p>
      </div>

      <DebriefForm eventId={id} existingDebrief={event.debrief as Record<string, unknown> | null} />
    </div>
  )
}
