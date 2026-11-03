import { redirect }         from 'next/navigation'
import { cookies }           from 'next/headers'
import { createClient }      from '@/lib/supabase/server'
import { DashboardShell }    from '@/components/dashboard/dashboard-shell'
import { ImpersonationBanner } from '@/components/dashboard/impersonation-banner'
import { AiCommand }         from './ai-command'
import { PrePostWidget }     from './pre-post-widget'
import type { BrandOption }  from '@/components/dashboard/brand-switcher'
import { focusFrom }          from '@/lib/goals'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: initialBrands, error: brandsError } = await supabase
    .from('brands')
    .select('id, name, category, industry, logo_url')
    .order('created_at', { ascending: true })
  let brands = initialBrands

  if (brandsError) {
    // 'industry' can go missing from PostgREST's schema cache after a
    // migration until it's reloaded server-side — don't let that silently
    // bounce every signed-in user to onboarding. Retry without it; industry
    // still resolves below via getIndustryFromCategory.
    const fallback = await supabase
      .from('brands')
      .select('id, name, category, logo_url')
      .order('created_at', { ascending: true })
    brands = fallback.data as typeof brands
  }

  const namedBrands = (brands ?? []).filter(b => b.name && b.name.trim() !== '')
  if (!namedBrands.length) redirect('/onboarding')

  // Resolve active brand (cookie → first brand)
  const cookieStore = await cookies()
  const storedId = cookieStore.get('active_brand_id')?.value
  const activeBrand = (storedId ? namedBrands.find(b => b.id === storedId) : null) ?? namedBrands[0]

  const userName  = (user.user_metadata?.full_name as string | undefined) ?? ''
  const userEmail = user.email ?? ''

  // Derive industry: prefer explicit industry field, fall back to category mapping
  const { getIndustryFromCategory } = await import('@/lib/industry-config')
  const industry = (activeBrand as { industry?: string | null }).industry
    || getIndustryFromCategory((activeBrand as { category?: string | null }).category ?? '')

  // Which modules this brand chose to see. Read on its own so that, before
  // the focus migration is applied, a missing column costs the filter and
  // nothing else: the error leaves focus null, which is the full sidebar.
  const { data: focusRow } = await supabase
    .from('brands')
    .select('focus_goals, show_all_modules')
    .eq('id', activeBrand.id)
    .maybeSingle()
  const focus = focusFrom(focusRow as { focus_goals?: unknown; show_all_modules?: unknown } | null)

  return (
    <>
      {/* Runs for the whole of a read-only session, on both sides. Renders
          nothing the rest of the time. */}
      <ImpersonationBanner />

      <DashboardShell
        userName={userName}
        userEmail={userEmail}
        brandName={activeBrand.name}
        brands={namedBrands as BrandOption[]}
        activeBrandId={activeBrand.id}
        industry={industry}
        focus={focus}
      >
        {children}
      </DashboardShell>

      {/* Fixed floating widgets — outside shell so they stay above content */}
      <PrePostWidget />
      <AiCommand />
    </>
  )
}
