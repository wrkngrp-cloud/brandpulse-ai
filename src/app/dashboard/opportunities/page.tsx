import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { PageHeader } from '@/components/dashboard/page-header'
import { TourTrigger } from '@/components/tours/tour-trigger'
import { MarketIcon } from '@/components/brand/icon'
import { OpportunitiesClient } from './opportunities-client'

export const dynamic = 'force-dynamic'

/**
 * The acquisition opportunity workspace.
 *
 * Where the free Market Demand Gap Finder continues: the three opportunities
 * it found arrive here with their evidence, and become a backlog with a
 * status per row rather than a report nobody acts on.
 */
export default async function OpportunitiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const brand = await getActiveBrand<{ id: string; name: string; website_url: string | null }>(
    supabase, 'id, name, website_url',
  )
  if (!brand) redirect('/dashboard')

  const { data: opportunities } = await supabase
    .from('acquisition_opportunities')
    .select('id, title, customer_problem, intent_stage, evidence_kind, evidence, competitors_visible, recommended_action, priority, status, created_at')
    .eq('brand_id', brand.id)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Brand health"
        title="Acquisition opportunities"
        subtitle="Customer demand your brand is not capturing, each one carrying the evidence it rests on. Prioritise them, mark what is planned, and track what you finish."
        icon={MarketIcon}
        actions={<TourTrigger module="opportunities" />}
      />
      <OpportunitiesClient
        brandName={brand.name}
        brandWebsite={brand.website_url}
        opportunities={opportunities ?? []}
      />
    </div>
  )
}
