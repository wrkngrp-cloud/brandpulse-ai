'use client'

import { useState } from 'react'
import { DashboardNav } from './dashboard-nav'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const [expanded, setExpanded] = useState(false)

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-20 hidden md:flex flex-col bg-sidebar border-r border-sidebar-border',
        'overflow-hidden transition-[width] duration-200 ease-out',
      )}
      style={{ width: expanded ? '220px' : '60px' }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo row */}
      <div className="h-14 flex items-center gap-3 shrink-0 border-b border-sidebar-border px-[18px]">
        {/* Pulse mark — always visible */}
        <div
          className="h-6 w-6 rounded-md shrink-0 flex items-center justify-center"
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

        {/* Word mark — fades in when expanded */}
        <span
          className={cn(
            'whitespace-nowrap font-bold text-[14.5px] tracking-tight text-sidebar-foreground',
            'transition-opacity duration-150',
            expanded ? 'opacity-100 delay-75' : 'opacity-0',
          )}
        >
          BrandPulse
        </span>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-[10px]">
        <DashboardNav expanded={expanded} />
      </div>
    </aside>
  )
}
