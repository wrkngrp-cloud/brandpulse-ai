'use client'

import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import { DashboardNav } from './dashboard-nav'
import { usePathname } from 'next/navigation'

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden p-2 -ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/15 backdrop-blur-[2px] md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 w-64 flex flex-col md:hidden',
          'bg-sidebar border-r border-sidebar-border',
          'transition-transform duration-250 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-2.5">
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
            <span className="font-bold text-[14.5px] tracking-tight text-sidebar-foreground">BrandPulse</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav — always fully expanded in mobile drawer */}
        <div className="flex-1 overflow-y-auto py-2 px-[10px]">
          <DashboardNav expanded={true} />
        </div>
      </aside>
    </>
  )
}
