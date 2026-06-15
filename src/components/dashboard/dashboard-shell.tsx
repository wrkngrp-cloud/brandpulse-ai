'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Menu, X, Sparkles, Search } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sidebar }            from './sidebar'
import { BreadcrumbNav }      from './breadcrumb-nav'
import { ThemeToggle }        from './theme-toggle'
import { NotificationBell }   from './notification-bell'
import { UserDropdown }       from './user-dropdown'
import { MobileNav }          from './mobile-nav'
import { DashboardNav }       from './dashboard-nav'
import { cn }                 from '@/lib/utils'

const LS_KEY = 'bp-sidebar'

interface DashboardShellProps {
  children:   React.ReactNode
  userName:   string
  userEmail:  string
  brandName:  string
}

export function DashboardShell({ children, userName, userEmail, brandName }: DashboardShellProps) {
  // Default pinned=true (expanded sidebar), hydrate from localStorage
  const [pinned, setPinned] = useState(true)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY)
    if (saved === 'collapsed') setPinned(false)
    setHydrated(true)
  }, [])

  const toggleSidebar = useCallback(() => {
    setPinned(prev => {
      const next = !prev
      localStorage.setItem(LS_KEY, next ? 'expanded' : 'collapsed')
      return next
    })
  }, [])

  // Content left padding reacts to pinned state
  // Collapsed: 72px (icon rail), Expanded: 256px
  const contentPad = pinned ? 256 : 72

  return (
    <div className="min-h-screen flex bg-background">

      {/* Desktop sidebar */}
      <Sidebar
        pinned={pinned}
        onToggle={toggleSidebar}
        userName={userName}
        userEmail={userEmail}
        brandName={brandName}
      />

      {/* Content column */}
      <div
        className={cn(
          'flex flex-col flex-1 min-h-screen min-w-0',
          'md:transition-[padding-left] md:duration-200 md:ease-out',
        )}
        style={{ paddingLeft: hydrated ? `${contentPad}px` : '256px' }}
      >
        {/* Topbar */}
        <header className="sticky top-0 z-30 h-14 border-b border-border/60 flex items-center gap-3 px-4 sm:px-5 shrink-0 bg-background/92 backdrop-blur-xl backdrop-saturate-150">

          {/* Mobile: hamburger + brand mark */}
          <div className="flex items-center gap-2.5 md:hidden">
            <MobileNav userName={userName} userEmail={userEmail} brandName={brandName} />
            <div className="flex items-center gap-2">
              <div
                className="h-6 w-6 rounded-lg grid place-items-center"
                style={{ background: 'linear-gradient(135deg, #6B8FFF 0%, #2B59FF 100%)' }}
              >
                <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" aria-hidden>
                  <polyline points="2,10 6,6 9.5,13 13.5,7.5 18,10" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="font-bold text-[14px] tracking-tight text-gradient-blue">BrandPulse</span>
            </div>
          </div>

          {/* Desktop: Breadcrumb */}
          <div className="hidden md:flex items-center min-w-0 flex-1">
            <BreadcrumbNav />
          </div>

          {/* Center search trigger (desktop) */}
          <div className="hidden md:flex flex-1 max-w-[340px] mx-4">
            <button
              className="search-trigger w-full flex items-center gap-2 h-9 rounded-xl px-3 cursor-pointer"
              aria-label="Search"
            >
              <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
              <span className="text-[13px] text-muted-foreground/50 flex-1 text-left">Search or ask anything…</span>
              <kbd className="text-[10px] font-mono bg-background/70 border border-border rounded-md px-1.5 py-0.5 text-muted-foreground/50 leading-none shrink-0">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex-1 md:flex-none" />

          {/* Right actions */}
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
            {/* Divider */}
            <div className="hidden sm:block h-4 w-px bg-border mx-1" />
            {/* User dropdown — mobile only (desktop shows in sidebar) */}
            <div className="md:hidden">
              <UserDropdown name={userName} email={userEmail} brandName={brandName} />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-7">
          {children}
        </main>
      </div>
    </div>
  )
}
