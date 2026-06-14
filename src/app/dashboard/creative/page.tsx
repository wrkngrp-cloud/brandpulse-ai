import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CreativeClient } from './creative-client'

export const dynamic = 'force-dynamic'

export default async function CreativePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: brand }, { data: recentAnalyses }] = await Promise.all([
    supabase
      .from('brands')
      .select('id, name, category, brand_values, primary_color, secondary_color')
      .limit(1)
      .single(),
    supabase
      .from('creative_analyses')
      .select('id, analysis_type, result, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  if (!brand) redirect('/onboarding')

  const brandValues: string[] = Array.isArray(brand.brand_values)
    ? (brand.brand_values as string[])
    : []

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Creative Analysis</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Compare creatives, check brand voice consistency, and analyse competitor content.
        </p>
      </div>

      <CreativeClient
        brandId={brand.id}
        brandName={brand.name}
        category={brand.category ?? null}
        brandValues={brandValues}
        recentAnalyses={(recentAnalyses ?? []).map(a => ({
          id: a.id,
          analysis_type: a.analysis_type,
          result: a.result as Record<string, unknown>,
          created_at: a.created_at,
        }))}
      />
    </div>
  )
}
