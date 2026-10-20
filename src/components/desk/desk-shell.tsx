'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { deskSignOut } from '@/app/desk/actions'
import { stripDeskPrefix } from '@/lib/desk/desk-path'
import { BrandLockup } from '@/components/brand/logo'
import { cn } from '@/lib/utils'
import {
  LayoutGridIcon, BuildingIcon, MessageQuoteIcon, UsersIcon,
  CurrencyIcon, TrendIcon, WrenchIcon, ShieldIcon, LogoutIcon,
} from '@/components/brand/icon'

/**
 * The Desk's own shell.
 *
 * Narrower than the product's: one flat list of modules, no brand switcher, no
 * tours, no command palette. It is a tool for a handful of people who will
 * learn it in a day, so it does not need to teach itself.
 *
 * A person is shown only the modules they hold a permission for. That is a
 * courtesy rather than the control: the pages check again, and so does the
 * database.
 */

export interface DeskNavEntry {
  label: string
  href:  string
  icon:  React.ElementType
  /** The permission that puts this in the nav. */
  perm:  string
  /** Listed, not yet built. Shown greyed rather than hidden, so the shape of
   *  the tool is visible and nobody hunts for a screen that is coming. */
  soon?: boolean
}

const NAV: DeskNavEntry[] = [
  { label: 'Overview', href: '/desk',          icon: LayoutGridIcon,    perm: 'accounts.view' },
  { label: 'Accounts', href: '/desk/accounts', icon: BuildingIcon,      perm: 'accounts.view' },
  { label: 'Inbox',    href: '/desk/inbox',    icon: MessageQuoteIcon,  perm: 'support.view' },
  { label: 'Leads',    href: '/desk/leads',    icon: TrendIcon,         perm: 'leads.view' },
  { label: 'Revenue',  href: '/desk/revenue',  icon: CurrencyIcon,      perm: 'revenue.view' },
  { label: 'Ops',      href: '/desk/ops',      icon: WrenchIcon,        perm: 'ops.view' },
  { label: 'Staff',    href: '/desk/staff',    icon: UsersIcon,         perm: 'staff.view' },
]

export function DeskShell({
  children, fullName, roleLabel, permissions, isSuperAdmin, onDesk,
}: {
  children:    React.ReactNode
  fullName:    string
  roleLabel:   string
  permissions: string[]
  isSuperAdmin: boolean
  /** True once DESK_HOST is live and this render is answering on it, so every
   *  nav link has to lose the `/desk` prefix the same way `deskHref` does
   *  server-side — this component can't call that itself, it has no
   *  `headers()` to ask. */
  onDesk: boolean
}) {
  const pathname = usePathname()
  const held = new Set(permissions)
  const visible = NAV.filter(entry => isSuperAdmin || held.has(entry.perm))
  const hrefFor = (mainHostHref: string) => onDesk ? stripDeskPrefix(mainHostHref) : mainHostHref

  const isActive = (href: string) =>
    href === '/desk' || href === '/' ? pathname === href : pathname.startsWith(href)

  return (
    <div className="min-h-screen bg-shell">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <BrandLockup />
            <span className="bg-label hidden text-[0.7rem] text-tx-3 sm:inline">The Desk</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm leading-tight font-medium">{fullName}</p>
              <p className="text-xs leading-tight text-tx-3">{roleLabel}</p>
            </div>
            <form action={deskSignOut}>
              <button
                type="submit"
                className="bg-press flex size-8 items-center justify-center rounded-md border border-line text-tx-2"
                aria-label="Sign out"
              >
                <LogoutIcon className="size-4" />
              </button>
            </form>
          </div>
        </div>

        <nav className="mx-auto max-w-7xl overflow-x-auto px-4">
          <ul className="flex gap-1">
            {visible.map(({ label, href: mainHostHref, icon: Icon, soon }) => {
              const href = hrefFor(mainHostHref)
              return (
              <li key={mainHostHref}>
                {soon ? (
                  <span
                    className="-mb-px flex cursor-default items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-sm whitespace-nowrap text-tx-3"
                    title="Being built"
                  >
                    <Icon className="size-4" />
                    {label}
                    <span className="bg-label text-[0.6rem]">Soon</span>
                  </span>
                ) : (
                  <Link
                    href={href}
                    className={cn(
                      'bg-press -mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap',
                      isActive(href)
                        ? 'border-flare font-medium text-tx'
                        : 'border-transparent text-tx-2 hover:text-tx',
                    )}
                  >
                    <Icon className="size-4" />
                    {label}
                  </Link>
                )}
              </li>
              )
            })}
            {isSuperAdmin && (
              <li className="ml-auto flex items-center gap-1.5 py-2.5 pl-3 text-tx-3">
                <ShieldIcon className="size-3.5" />
                <span className="bg-label text-[0.65rem]">Super admin</span>
              </li>
            )}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  )
}
