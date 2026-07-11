import { createClient } from '@/lib/supabase/server'
import { PortalTokensClient } from './portal-tokens-client'

export default async function PortalSettingsPage() {
  const supabase = await createClient()

  const [{ data: tokens }, { data: brands }, { data: workspace }] = await Promise.all([
    supabase.from('portal_tokens')
      .select('id, token, label, sections, expires_at, last_accessed, created_at, brands(name)')
      .order('created_at', { ascending: false }),
    supabase.from('brands').select('id, name').order('created_at', { ascending: true }),
    supabase.from('workspaces').select('plan').limit(1).maybeSingle(),
  ])

  const { data: planRow } = await supabase
    .from('plan_limits').select('portal_links').eq('plan', workspace?.plan ?? 'starter').maybeSingle()

  return (
    <PortalTokensClient
      tokens={(tokens ?? []) as unknown as Parameters<typeof PortalTokensClient>[0]['tokens']}
      brands={brands ?? []}
      plan={workspace?.plan ?? 'starter'}
      portalLimit={planRow?.portal_links ?? 0}
      appUrl={process.env.APP_URL ?? 'https://brandpulse-ai-tau.vercel.app'}
    />
  )
}
