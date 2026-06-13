import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CompetitiveClient } from './competitive-client'

export default async function CompetitivePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: brand }, { data: sovSnap }, { data: competitors }] = await Promise.all([
    supabase.from('brands').select('id, name').limit(1).single(),
    supabase.from('sov_snapshots').select('social_sov').order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('competitors').select('name').limit(10),
  ])

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Competitive Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          AI-generated briefing · share of voice, sentiment, threats, and opportunities
        </p>
      </div>

      <CompetitiveClient
        hasSovData={sovSnap?.social_sov != null}
        brandName={brand?.name ?? 'Your brand'}
        competitorNames={(competitors ?? []).map(c => c.name)}
      />
    </div>
  )
}
