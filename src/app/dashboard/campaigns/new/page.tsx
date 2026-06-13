import Link               from 'next/link'
import { ArrowLeft }      from 'lucide-react'
import { CampaignForm }   from '@/components/campaigns/campaign-form'
import { createCampaign } from '../actions'

export default function NewCampaignPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/dashboard/campaigns"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Campaigns
        </Link>
        <h1 className="text-xl font-semibold">Create campaign</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Define your campaign brief and select the media channels it will run across.
        </p>
      </div>

      <CampaignForm action={createCampaign} />
    </div>
  )
}
