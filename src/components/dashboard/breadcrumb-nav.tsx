'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const LABELS: Record<string, string> = {
  dashboard:    'Overview',
  content:      'Content',
  sentiment:    'Sentiment',
  'brand-equity': 'Brand Equity',
  surveys:      'Surveys',
  campaigns:    'Campaigns',
  ooh:          'OOH',
  events:       'Events',
  'pre-post':   'Pre-Post',
  funnel:       'Funnel',
  cultural:     'Cultural',
  competitive:  'Competitive',
  creative:     'Creative',
  influencers:  'Influencers',
  ask:          'Ask AI',
  settings:     'Settings',
  nps:          'NPS Tracker',
  new:          'New',
  debrief:      'Debrief',
  edit:         'Edit',
  connections:  'Connections',
  competitors:  'Competitors',
  profile:      'Profile',
  brand:        'Brand',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}/i

function toLabel(seg: string): string {
  return LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ')
}

export function BreadcrumbNav({ className }: { className?: string }) {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  // Build crumbs — skip UUID segments
  const crumbs = segments.reduce<{ href: string; label: string }[]>((acc, seg, i) => {
    if (UUID_RE.test(seg)) return acc
    const href = '/' + segments.slice(0, i + 1).join('/')
    acc.push({ href, label: toLabel(seg) })
    return acc
  }, [])

  if (crumbs.length <= 1) return null

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-0.5', className)}>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={crumb.href} className="flex items-center gap-0.5">
            {i > 0 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0 mx-0.5" />
            )}
            {isLast ? (
              <span className="text-[12px] font-medium text-foreground/75 select-none">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-[12px] text-muted-foreground/55 hover:text-foreground/75 transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
