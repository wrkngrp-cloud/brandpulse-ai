import { createClient } from '@/lib/supabase/server'
import { FieldTeamsClient } from './field-teams-client'

export const dynamic = 'force-dynamic'

export default async function FieldTeamsPage() {
  const supabase = await createClient()

  const { data: teams } = await supabase
    .from('fso_teams')
    .select('id, name, token, active, notes, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Field teams</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Each team gets a unique link your FSOs open on their phones — no login, no app download.
        </p>
      </div>

      <FieldTeamsClient initialTeams={teams ?? []} />

      <div className="border rounded-xl p-5 bg-card space-y-2">
        <p className="text-sm font-semibold">How field teams work</p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>Create a team for each region, channel, or group of FSOs.</li>
          <li>Share the team link via WhatsApp or SMS — no app download needed.</li>
          <li>FSOs submit daily route reports from their phone: outlets visited, product availability, pricing, POSM compliance, and competitor activity.</li>
          <li>Reports appear in Field Intelligence within seconds of submission.</li>
          <li>Deactivate a team to disable its link without losing historical data.</li>
        </ul>
      </div>
    </div>
  )
}
