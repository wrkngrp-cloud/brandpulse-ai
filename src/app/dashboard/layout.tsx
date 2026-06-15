import { redirect }         from 'next/navigation'
import { createClient }      from '@/lib/supabase/server'
import { DashboardShell }    from '@/components/dashboard/dashboard-shell'
import { AiCommand }         from './ai-command'
import { PrePostWidget }     from './pre-post-widget'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: brand } = await supabase
    .from('brands')
    .select('name')
    .limit(1)
    .single()

  if (!brand?.name) redirect('/onboarding')

  const userName  = (user.user_metadata?.full_name as string | undefined) ?? ''
  const userEmail = user.email ?? ''

  return (
    <>
      <DashboardShell
        userName={userName}
        userEmail={userEmail}
        brandName={brand.name}
      >
        {children}
      </DashboardShell>

      {/* Fixed floating widgets — outside shell so they stay above content */}
      <PrePostWidget />
      <AiCommand />
    </>
  )
}
