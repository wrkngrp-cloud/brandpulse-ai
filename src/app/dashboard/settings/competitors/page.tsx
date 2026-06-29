import { createClient } from '@/lib/supabase/server'
import { CompetitorsClient } from './competitors-client'

export const dynamic = 'force-dynamic'

export default async function CompetitorsSettingsPage() {
  const supabase = await createClient()

  const { data: competitors } = await supabase
    .from('competitors')
    .select('id, name, created_at')
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Tracked competitors</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Competitors you add here appear in your Competitive Intelligence briefings and Share of Voice calculations.
        </p>
      </div>

      <CompetitorsClient
        initialCompetitors={competitors ?? []}
      />

      <div className="border rounded-xl p-5 bg-card space-y-2">
        <p className="text-sm font-semibold">How this works</p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>BrandPulse crawls public data (social profiles, Google Trends, Meta Ad Library, press) for each competitor weekly.</li>
          <li>Your weekly Competitive Briefing includes a "what they did, what it means, how to respond" summary for each.</li>
          <li>Competitor names feed the SOV engine to compute your share of category mentions.</li>
          <li>Add 3 to 6 competitors for the most useful comparison. More than 10 reduces briefing quality.</li>
        </ul>
      </div>
    </div>
  )
}
