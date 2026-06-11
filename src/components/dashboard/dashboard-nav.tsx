'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const links = [
  { label: 'Overview',  href: '/dashboard' },
  { label: 'Content',   href: '/dashboard/content' },
  { label: 'Sentiment', href: '/dashboard/sentiment' },
  { label: 'Surveys',   href: '/dashboard/surveys' },
  { label: 'Ask AI',    href: '/dashboard/ask' },
]

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <ul className="space-y-1 text-sm">
      {links.map(({ label, href }) => {
        const active = href === '/dashboard'
          ? pathname === '/dashboard'
          : pathname.startsWith(href)
        return (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                'block px-2 py-1.5 rounded-md transition-colors',
                active
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
