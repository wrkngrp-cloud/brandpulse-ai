import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { EventWizard } from '@/components/events/event-wizard'

export default function NewEventPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard/events"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Events
        </Link>
        <h1 className="text-xl font-semibold">Create event</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Set up your activation, sponsorship, or event to start tracking ROI.
        </p>
      </div>
      <EventWizard />
    </div>
  )
}
