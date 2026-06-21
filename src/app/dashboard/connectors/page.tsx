import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ConnectorsClient } from './connectors-client'

export const dynamic = 'force-dynamic'

export default async function ConnectorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, connected_channels, ga4_property_id')
    .limit(20)

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, plan')
    .limit(1).maybeSingle()

  return (
    <ConnectorsClient
      brands={brands ?? []}
      workspacePlan={workspace?.plan ?? 'starter'}
    />
  )
}
