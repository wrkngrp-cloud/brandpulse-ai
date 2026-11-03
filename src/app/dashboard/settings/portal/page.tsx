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


  return (
    <PortalTokensClient
      tokens={(tokens ?? []) as unknown as Parameters<typeof PortalTokensClient>[0]['tokens']}
      brands={brands ?? []}
      plan={workspace?.plan ?? 'starter'}
      // Beta is free and has no limits. The starter plan row said 0, which
      // made the portal unusable behind an "Upgrade" button. Plans come back
      // with billing, after the beta.
      portalLimit={-1}
      appUrl={process.env.APP_URL || 'https://brandpulse-ai-tau.vercel.app'}
    />
  )
}
