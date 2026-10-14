'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { deskSignOut } from '@/app/desk/actions'
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
  { label: 'Accounts', href: '/desk/accounts', icon: BuildingIcon,      perm: 'accounts.view', soon: true },
  { label: 'Inbox',    href: '/desk/inbox',    icon: MessageQuoteIcon,  perm: 'support.view',  soon: true },
  { label: 'Leads',    href: '/desk/leads',    icon: TrendIcon,         perm: 'leads.view',    soon: true },
  { label: 'Revenue',  href: '/desk/revenue',  icon: CurrencyIcon,      perm: 'revenue.view',  soon: true },
  { label: 'Ops',      href: '/desk/ops',      icon: WrenchIcon,        perm: 'ops.view',      soon: true },
  { label: 'Staff',    href: '/desk/staff',    icon: UsersIcon,         perm: 'staff.view' },
]

export function DeskShell({
  children, fullName, roleLabel, permissions, isSuperAdmin,
}: {
  children:    React.ReactNode
  fullName:    string
  roleLabel:   string
  permissions: string[]
  isSuperAdmin: boolean
}) {
  const pathname = usePathname()
  const held = new Set(permissions)
  const visible = NAV.filter(entry => isSuperAdmin || held.has(entry.perm))

  const isActive = (href: string) =>
    href === '/desk' ? pathname === '/desk' : pathname.startsWith(href)

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
            {visible.map(({ label, href, icon: Icon, soon }) => (
              <li key={href}>
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
            ))}
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
