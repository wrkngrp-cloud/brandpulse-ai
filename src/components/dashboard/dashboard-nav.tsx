'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileText, BarChart2, ClipboardList, Sparkles, CalendarDays, MapPin, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { label: 'Overview',   href: '/dashboard',            icon: LayoutDashboard },
  { label: 'Content',    href: '/dashboard/content',    icon: FileText },
  { label: 'Sentiment',  href: '/dashboard/sentiment',  icon: BarChart2 },
  { label: 'Surveys',    href: '/dashboard/surveys',    icon: ClipboardList },
  { label: 'Campaigns',  href: '/dashboard/campaigns',  icon: Megaphone },
  { label: 'Events',     href: '/dashboard/events',     icon: CalendarDays },
  { label: 'OOH',        href: '/dashboard/ooh',        icon: MapPin },
  { label: 'Ask AI',     href: '/dashboard/ask',        icon: Sparkles, highlight: true },
]

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <ul className="space-y-1 text-sm">
      {links.map(({ label, href, icon: Icon, highlight }) => {
        const active = href === '/dashboard'
          ? pathname === '/dashboard'
          : pathname.startsWith(href)
        return (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors',
                active && !highlight && 'bg-muted text-foreground font-medium',
                active && highlight  && 'bg-foreground text-background font-medium',
                !active && !highlight && 'text-muted-foreground hover:bg-muted hover:text-foreground',
                !active && highlight  && 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
