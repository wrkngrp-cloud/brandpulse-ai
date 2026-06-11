import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardNav } from '@/components/dashboard/dashboard-nav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // If brand has no name the user hasn't finished onboarding
  const { data: brand } = await supabase
    .from('brands')
    .select('name')
    .limit(1)
    .single()

  if (!brand?.name) redirect('/onboarding')

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Topbar */}
      <header className="border-b px-6 h-14 flex items-center justify-between shrink-0">
        <span className="font-semibold text-sm tracking-tight">BrandPulse</span>
        <span className="text-xs text-muted-foreground">{brand.name}</span>
      </header>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar placeholder — will be built out in later items */}
        <nav className="w-56 border-r shrink-0 p-4 hidden md:block">
          <DashboardNav />
        </nav>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
