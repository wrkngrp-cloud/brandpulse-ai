import { redirect }         from 'next/navigation'
import { cookies }           from 'next/headers'
import { createClient }      from '@/lib/supabase/server'
import { DashboardShell }    from '@/components/dashboard/dashboard-shell'
import { AiCommand }         from './ai-command'
import { PrePostWidget }     from './pre-post-widget'
import type { BrandOption }  from '@/components/dashboard/brand-switcher'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, category, industry, logo_url')
    .order('created_at', { ascending: true })

  if (!brands?.length) redirect('/onboarding')

  // Resolve active brand (cookie → first brand)
  const cookieStore = await cookies()
  const storedId = cookieStore.get('active_brand_id')?.value
  const activeBrand = (storedId ? brands.find(b => b.id === storedId) : null) ?? brands[0]

  const userName  = (user.user_metadata?.full_name as string | undefined) ?? ''
  const userEmail = user.email ?? ''

  // Derive industry: prefer explicit industry field, fall back to category mapping
  const { getIndustryFromCategory } = await import('@/lib/industry-config')
  const industry = (activeBrand as { industry?: string | null }).industry
    || getIndustryFromCategory((activeBrand as { category?: string | null }).category ?? '')

  return (
    <>
      <DashboardShell
        userName={userName}
        userEmail={userEmail}
        brandName={activeBrand.name}
        brands={brands as BrandOption[]}
        activeBrandId={activeBrand.id}
        industry={industry}
      >
        {children}
      </DashboardShell>

      {/* Fixed floating widgets — outside shell so they stay above content */}
      <PrePostWidget />
      <AiCommand />
    </>
  )
}
