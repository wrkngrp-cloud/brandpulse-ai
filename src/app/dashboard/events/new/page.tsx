import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { EventWizard } from '@/components/events/event-wizard'

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign_id?: string }>
}) {
  const { campaign_id } = await searchParams
  let campaignName: string | null = null

  if (campaign_id) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('campaigns')
      .select('name')
      .eq('id', campaign_id)
      .single()
    campaignName = data?.name ?? null
  }

  const backHref = campaign_id
    ? `/dashboard/campaigns/${campaign_id}?tab=events`
    : '/dashboard/events'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {campaignName ? campaignName : 'Events'}
        </Link>
        <h1 className="text-xl font-semibold">Create event</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {campaignName
            ? `This event will be linked to campaign "${campaignName}".`
            : 'Set up your activation, sponsorship, or event to start tracking ROI.'}
        </p>
      </div>
      <EventWizard campaignId={campaign_id ?? null} />
    </div>
  )
}
