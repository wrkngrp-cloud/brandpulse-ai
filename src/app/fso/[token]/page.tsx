import { createServiceClient } from '@/lib/supabase/server'
import { notFound }            from 'next/navigation'
import { FsoFormClient }       from './fso-form-client'

export default async function FsoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const service   = await createServiceClient()

  const { data: team } = await service
    .from('fso_teams')
    .select('id, name, brand_id, workspace_id, active, brands(name)')
    .eq('token', token)
    .single()

  if (!team) notFound()

  if (!team.active) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="text-center space-y-2 max-w-sm">
          <p className="text-base font-semibold">This link is no longer active</p>
          <p className="text-sm text-muted-foreground">Contact your team manager for a new link.</p>
        </div>
      </div>
    )
  }

  const brandsRaw = team.brands as unknown as { name: string } | { name: string }[] | null
  const brandName = (Array.isArray(brandsRaw) ? brandsRaw[0]?.name : brandsRaw?.name) ?? ''

  return (
    <FsoFormClient
      token={token}
      teamName={team.name}
      brandName={brandName}
    />
  )
}
