'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Menu, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { DashboardNav } from './dashboard-nav'
import { cn } from '@/lib/utils'

interface MobileNavProps {
  userName?:  string
  userEmail?: string
  brandName?: string
}

export function MobileNav({ userName = '', userEmail = '', brandName = '' }: MobileNavProps) {
  const [open, setOpen]         = useState(false)
  const [mounted, setMounted]   = useState(false)
  const pathname                = usePathname()

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { setOpen(false) }, [pathname])

  // The drawer and backdrop are portalled to document.body so they escape
  // the header's backdrop-blur stacking context and always render on top.
  const overlay = mounted ? createPortal(
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[9998] bg-foreground/15 backdrop-blur-[3px]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-[9999] w-[260px] flex flex-col',
          'bg-sidebar border-r border-sidebar-border',
          'transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="h-8 w-8 rounded-xl grid place-items-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #6B8FFF 0%, #2B59FF 100%)', boxShadow: '0 4px 14px -4px oklch(0.485 0.25 258 / 0.55)' }}
            >
              <svg viewBox="0 0 20 20" className="h-[14px] w-[14px]" fill="none" aria-hidden>
                <polyline points="2,10 6,6 9.5,13 13.5,7.5 18,10" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-bold text-[15px] tracking-tight text-gradient-blue">BrandGauge</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors cursor-pointer"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto py-2 px-2.5">
          <DashboardNav expanded={true} />
        </div>

        {/* Bottom user info */}
        {(brandName || userEmail) && (
          <div className="border-t border-sidebar-border/70 p-3">
            <div className="flex items-center gap-2.5 px-2 py-1">
              <span
                className="h-8 w-8 shrink-0 rounded-lg grid place-items-center text-[12px] font-bold select-none"
                style={{
                  background: 'linear-gradient(135deg, oklch(0.485 0.25 258 / 0.18) 0%, oklch(0.585 0.163 37 / 0.12) 100%)',
                  color: 'oklch(0.485 0.25 258)',
                  border: '1px solid oklch(0.485 0.25 258 / 0.20)',
                }}
              >
                {(userName || userEmail).trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate leading-tight">{brandName}</p>
                <p className="text-[11px] text-sidebar-foreground/45 truncate leading-tight mt-0.5">{userEmail}</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>,
    document.body,
  ) : null

  return (
    <>
      {/* Hamburger button — stays inside the header */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden p-2 -ml-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
        aria-label="Open navigation"
        aria-expanded={open}
      >
        <Menu className="h-5 w-5" />
      </button>

      {overlay}
    </>
  )
}
