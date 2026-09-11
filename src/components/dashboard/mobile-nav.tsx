'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MenuIcon as Menu, XIcon as X } from '@/components/brand/icon'
import { usePathname } from 'next/navigation'
import { DashboardNav } from './dashboard-nav'
import { cn } from '@/lib/utils'
import { BrandLockup } from '@/components/brand/logo'

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
            <BrandLockup height={20} tone="duotone" ground="ink" />
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors cursor-pointer bg-press"
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
                  background: 'var(--bg-shell)',
                  color: 'var(--tx-2)',
                  border: 'var(--line)',
                }}
              >
                {(userName || userEmail).trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate leading-tight">{brandName}</p>
                <p className="text-[11px] text-sidebar-foreground truncate leading-tight mt-0.5">{userEmail}</p>
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
        className="md:hidden p-2 -ml-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer bg-press"
        aria-label="Open navigation"
        aria-expanded={open}
      >
        <Menu className="h-5 w-5" />
      </button>

      {overlay}
    </>
  )
}
