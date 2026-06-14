import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar }      from '@/components/dashboard/sidebar'
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

      {/* ── Icon-rail sidebar (desktop) ─────────────────────────────── */}
      <Sidebar />

      {/* ── Right column ─────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-h-screen md:pl-[60px]">

        {/* Topbar */}
        <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/90 backdrop-blur-md flex items-center px-4 sm:px-6 gap-3 shrink-0">
          {/* Mobile brand mark + hamburger */}
          <div className="flex items-center gap-2.5 md:hidden">
            <MobileNav />
            <div className="flex items-center gap-2">
              <div
                className="h-6 w-6 rounded-md flex items-center justify-center"
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
              <span className="font-bold text-[14px] tracking-tight">BrandPulse</span>
            </div>
          </div>

          <div className="flex-1" />

          <UserDropdown name={userName} email={userEmail} brandName={brand.name} />
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      <PrePostWidget />
      <AiCommand />
    </div>
  )
}
