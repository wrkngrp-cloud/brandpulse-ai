'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, FileText, BarChart2, ClipboardList, Sparkles,
  CalendarDays, MapPin, Megaphone, Zap, Trophy, ChevronDown,
  Monitor, Radio, Tv, Newspaper,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const CAMPAIGN_PATHS = ['/dashboard/campaigns', '/dashboard/ooh', '/dashboard/events']

const campaignSubItems = [
  { label: 'All Campaigns', href: '/dashboard/campaigns', icon: Megaphone },
  { label: 'OOH',           href: '/dashboard/ooh',       icon: MapPin    },
  { label: 'Events',        href: '/dashboard/events',     icon: CalendarDays },
]

const campaignSoonItems = [
  { label: 'Digital', icon: Monitor   },
  { label: 'Radio',   icon: Radio     },
  { label: 'TV',      icon: Tv        },
  { label: 'Print',   icon: Newspaper },
]

const topLinks = [
  { label: 'Overview',   href: '/dashboard',           icon: LayoutDashboard },
  { label: 'Content',    href: '/dashboard/content',   icon: FileText        },
  { label: 'Sentiment',  href: '/dashboard/sentiment', icon: BarChart2       },
  { label: 'Surveys',    href: '/dashboard/surveys',   icon: ClipboardList   },
]

const bottomLinks = [
  { label: 'Pre-Post',    href: '/dashboard/pre-post',    icon: Zap                            },
  { label: 'Competitive', href: '/dashboard/competitive', icon: Trophy                         },
  { label: 'Ask AI',      href: '/dashboard/ask',         icon: Sparkles, highlight: true as const },
]

export function DashboardNav() {
  const pathname = usePathname()

  const onCampaignPath = CAMPAIGN_PATHS.some(p => pathname.startsWith(p))
  const [campaignOpen, setCampaignOpen] = useState(onCampaignPath)

  // Auto-expand when navigating into a campaign sub-path
  useEffect(() => {
    if (onCampaignPath) setCampaignOpen(true)
  }, [onCampaignPath])

  return (
    <ul className="space-y-0.5 text-sm">
      {/* Top links */}
      {topLinks.map(({ label, href, icon: Icon }) => {
        const active = href === '/dashboard'
          ? pathname === '/dashboard'
          : pathname.startsWith(href)
        return (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors',
                active
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          </li>
        )
      })}

      {/* Campaigns section */}
      <li>
        <button
          onClick={() => setCampaignOpen(o => !o)}
          className={cn(
            'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors',
            onCampaignPath
              ? 'text-foreground font-medium'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Megaphone className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Campaigns</span>
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', campaignOpen && 'rotate-180')} />
        </button>

        {campaignOpen && (
          <ul className="mt-0.5 ml-3 pl-3 border-l border-border space-y-0.5">
            {campaignSubItems.map(({ label, href, icon: Icon }) => {
              const active = href === '/dashboard/campaigns'
                ? pathname === '/dashboard/campaigns' || pathname.startsWith('/dashboard/campaigns/')
                : pathname.startsWith(href)
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-sm',
                      active
                        ? 'bg-muted text-foreground font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {label}
                  </Link>
                </li>
              )
            })}

            {/* Phase 3 divider */}
            <li className="pt-1">
              <p className="px-2 pb-1 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">
                Phase 3
              </p>
            </li>

            {campaignSoonItems.map(({ label, icon: Icon }) => (
              <li key={label}>
                <span
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground/40 cursor-not-allowed select-none"
                  title="Coming in Phase 3"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                  <span className="ml-auto text-[9px] bg-muted rounded px-1 py-0.5 font-medium text-muted-foreground/60">
                    Soon
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </li>

      {/* Bottom links */}
      {bottomLinks.map(({ label, href, icon: Icon, highlight }) => {
        const active = pathname.startsWith(href)
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
