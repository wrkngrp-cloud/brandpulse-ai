'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PanelIcon as PanelLeftClose, PanelIcon as PanelLeft, SettingsIcon as Settings, ExitIcon as LogOut, SortIcon as ChevronsUpDown } from '@/components/brand/icon'
import { AskIcon as Sparkles } from '@/components/brand/icon'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { logout } from '@/app/auth/actions'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DashboardNav } from './dashboard-nav'
import { BrandSwitcher } from './brand-switcher'
import type { BrandOption } from './brand-switcher'
import { cn } from '@/lib/utils'
import { BrandMark, BrandLockup } from '@/components/brand/logo'

// ── Sidebar user block ─────────────────────────────────────────────────────

function SidebarUserBlock({
  name,
  email,
  brandName,
  expanded,
}: {
  name:      string
  email:     string
  brandName: string
  expanded:  boolean
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function getInitials(n: string) {
    return n.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
  }

  const initials = getInitials(name || email)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'w-full flex items-center gap-2.5 rounded-xl p-2.5 outline-none cursor-pointer',
          'text-sidebar-foreground hover:bg-sidebar-accent transition-colors duration-150 group',
        )}
      >
        {/* Avatar */}
        <span
          className="h-8 w-8 shrink-0 rounded-lg grid place-items-center text-[12px] font-bold select-none"
          style={{
            background: 'var(--bg-shell)',
            color: 'var(--tx-2)',
            border: 'var(--line)',
          }}
        >
          {initials}
        </span>

        {expanded && (
          <>
            <span className="flex-1 min-w-0 text-left">
              <span className="block text-[13px] font-semibold truncate leading-tight">{brandName}</span>
              <span className="block text-[11px] text-sidebar-foreground/45 truncate leading-tight mt-0.5">{email}</span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 text-sidebar-foreground/35 shrink-0" />
          </>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" className="w-56 mb-1">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium truncate">{name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{email}</p>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => router.push('/dashboard/settings/profile')}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            disabled={pending}
            className="cursor-pointer"
            onClick={() => !pending && startTransition(() => logout())}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {pending ? 'Signing out…' : 'Sign out'}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────

interface SidebarProps {
  pinned:        boolean
  onToggle:      () => void
  userName:      string
  userEmail:     string
  brandName:     string
  brands?:       BrandOption[]
  activeBrandId?: string | null
  industry?:     string | null
}

export function Sidebar({ pinned, onToggle, userName, userEmail, brandName, brands = [], activeBrandId = null, industry = null }: SidebarProps) {
  const [hovering, setHovering] = useState(false)
  const pathname = usePathname()

  // When route changes, clear hover so collapsed state is clean
  useEffect(() => { setHovering(false) }, [pathname])

  const expanded = pinned || hovering
  const isAskActive = pathname.startsWith('/dashboard/ask')

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden md:flex flex-col',
        'bg-sidebar border-r border-sidebar-border',
        /* No animation touches width in this system: the rail changes
           width outright and the state reads through colour instead. */
        'overflow-hidden',
        /* subtle shadow when expanded as overlay (collapsed mode) */
        !pinned && hovering && 'border-r border-line-inv',
      )}
      style={{ width: expanded ? '256px' : '72px' }}
      onMouseEnter={() => !pinned && setHovering(true)}
      onMouseLeave={() => !pinned && setHovering(false)}
    >

      {/* ── Logo area ──────────────────────────────────────────── */}
      <div className="h-14 shrink-0 flex items-center gap-3 border-b border-sidebar-border/70 px-[18px]">
        {/* The mark as supplied. Duotone on the ink plane, and the lockup
            only once the rail is wide enough to carry the wordmark. */}
        <BrandMark size={28} ground="ink" className="shrink-0" />
        <span
          className={cn(
            'transition-opacity duration-150',
            expanded ? 'opacity-100 delay-75' : 'opacity-0',
          )}
        >
          <BrandLockup height={16} ground="ink" />
        </span>

        {/* Collapse/expand toggle */}
        <button
          onClick={onToggle}
          className={cn(
            'ml-auto h-7 w-7 shrink-0 grid place-items-center rounded-lg cursor-pointer',
            'text-sidebar-foreground/35 hover:text-sidebar-foreground hover:bg-sidebar-accent',
            'transition-colors duration-150',
            expanded ? 'opacity-100 delay-75' : 'opacity-0 pointer-events-none',
          )}
          aria-label={pinned ? 'Collapse sidebar' : 'Pin sidebar'}
        >
          {pinned
            ? <PanelLeftClose className="h-4 w-4" />
            : <PanelLeft className="h-4 w-4" />
          }
        </button>
      </div>

      {/* ── Navigation ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2.5">
        <DashboardNav expanded={expanded} industry={industry} />
      </div>

      {/* ── Ask AI CTA ─────────────────────────────────────────── */}
      <div className="px-2.5 pb-2">
        <Link
          href="/dashboard/ask"
          className={cn(
            'ask-ai-btn flex items-center gap-2.5 rounded-xl transition-colors duration-150',
            'overflow-hidden',
            expanded ? 'h-10 px-3' : 'h-10 justify-center px-0',
            isAskActive && 'ring-1 ring-primary/30',
          )}
        >
          <Sparkles className={cn('shrink-0', expanded ? 'h-4 w-4' : 'h-[15px] w-[15px]')} />
          {expanded && (
            <>
              <span className="text-[13px] font-semibold whitespace-nowrap">Ask AI</span>
              <kbd className="ml-auto text-[9.5px] bg-num bg-background/50 border border-current/20 rounded px-1.5 py-0.5 opacity-60 leading-none">
                ⌘K
              </kbd>
            </>
          )}
        </Link>
      </div>

      {/* ── Brand switcher — only shown when multiple brands exist ── */}
      {brands.length > 1 && (
        <div className={cn(
          'px-2.5 pb-2 transition-opacity duration-150',
          expanded ? 'opacity-100' : 'opacity-0 pointer-events-none h-0 overflow-hidden'
        )}>
          <BrandSwitcher brands={brands} activeBrandId={activeBrandId} />
        </div>
      )}

      {/* ── User block ─────────────────────────────────────────── */}
      <div className="border-t border-sidebar-border/70 p-2">
        <SidebarUserBlock
          name={userName}
          email={userEmail}
          brandName={brandName}
          expanded={expanded}
        />
      </div>

    </aside>
  )
}
