import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardNav } from '@/components/dashboard/dashboard-nav'
import { MobileNav }    from '@/components/dashboard/mobile-nav'
import { UserDropdown } from '@/components/dashboard/user-dropdown'
import { AiCommand }    from './ai-command'
import { PrePostWidget } from './pre-post-widget'

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
    <div className="min-h-screen flex bg-background">

      {/* ── Sidebar — desktop, fixed ───────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-20 w-56 hidden md:flex flex-col bg-sidebar border-r border-sidebar-border">

        {/* Logo row — same height as topbar */}
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-sidebar-border shrink-0">
          {/* Pulse mark */}
          <div
            className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'oklch(0.55 0.25 258)' }}
          >
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden>
              <polyline
                points="2,10 6,6 9.5,13 13.5,7.5 18,10"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="font-bold text-[15px] tracking-tight text-sidebar-foreground select-none">
            BrandPulse
          </span>
        </div>

        {/* Scrollable nav */}
        <div className="flex-1 overflow-y-auto py-2 px-2">
          <DashboardNav />
        </div>
      </aside>

      {/* ── Right column ───────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-h-screen md:pl-56">

        {/* Topbar */}
        <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/90 backdrop-blur-md flex items-center px-4 sm:px-6 gap-3 shrink-0">
          {/* Mobile: hamburger + wordmark */}
          <div className="flex items-center gap-2.5 md:hidden">
            <MobileNav />
            <div className="flex items-center gap-2">
              <div
                className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
                style={{ background: 'oklch(0.55 0.25 258)' }}
              >
                <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" aria-hidden>
                  <polyline
                    points="2,10 6,6 9.5,13 13.5,7.5 18,10"
                    stroke="white"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="font-bold text-sm tracking-tight">BrandPulse</span>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right side controls */}
          <UserDropdown name={userName} email={userEmail} brandName={brand.name} />
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Floating widgets */}
      <PrePostWidget />
      <AiCommand />
    </div>
  )
}
