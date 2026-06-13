import { createServiceClient } from '@/lib/supabase/server'
import { notFound }            from 'next/navigation'
import { AmbassadorPwa }       from '@/components/events/ambassador-pwa'

export default async function AmbassadorPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const service   = await createServiceClient()

  const { data: ambassador } = await service
    .from('event_ambassadors')
    .select('id, name, event_id')
    .eq('session_token', token)
    .single()

  if (!ambassador) notFound()

  const { data: event } = await service
    .from('events')
    .select('id, name, city, status, brands(name)')
    .eq('id', ambassador.event_id)
    .single()

  if (!event || event.status === 'planned') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="text-center space-y-2">
          <p className="text-base font-medium">Event not live yet</p>
          <p className="text-sm text-muted-foreground">Ask your event manager to go live before logging interactions.</p>
        </div>
      </div>
    )
  }

  if (event.status === 'closed' || event.status === 'reported') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="text-center space-y-2">
          <p className="text-base font-medium">Event has ended</p>
          <p className="text-sm text-muted-foreground">Thank you for your work at {event.name}!</p>
        </div>
      </div>
    )
  }

  const brandsRaw = event.brands as unknown as { name: string } | { name: string }[] | null
  const brandName = (Array.isArray(brandsRaw) ? brandsRaw[0]?.name : brandsRaw?.name) ?? ''

  return (
    <AmbassadorPwa
      sessionToken={token}
      ambassadorName={ambassador.name}
      eventName={event.name}
      brandName={brandName}
      eventCity={event.city}
    />
  )
}
