'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, FileText, BarChart2, ClipboardList, Sparkles,
  CalendarDays, MapPin, Megaphone, Zap, Trophy, ChevronDown,
  Monitor, Radio, Tv, Newspaper, Filter, Award, Users, Palette, Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Nav data ──────────────────────────────────────────────────────────────────

const INTELLIGENCE = [
  { label: 'Overview',     href: '/dashboard',              icon: LayoutDashboard },
  { label: 'Content',      href: '/dashboard/content',      icon: FileText        },
  { label: 'Sentiment',    href: '/dashboard/sentiment',    icon: BarChart2       },
  { label: 'Brand Equity', href: '/dashboard/brand-equity', icon: Award           },
  { label: 'Surveys',      href: '/dashboard/surveys',      icon: ClipboardList   },
]

const CAMPAIGN_PATHS = ['/dashboard/campaigns', '/dashboard/ooh', '/dashboard/events']

const CAMPAIGN_SUB = [
  { label: 'All Campaigns',  href: '/dashboard/campaigns', icon: Megaphone    },
  { label: 'OOH Placements', href: '/dashboard/ooh',       icon: MapPin       },
  { label: 'Events',         href: '/dashboard/events',    icon: CalendarDays },
]

const CAMPAIGN_SOON = [
  { label: 'Digital', icon: Monitor   },
  { label: 'Radio',   icon: Radio     },
  { label: 'TV',      icon: Tv        },
  { label: 'Print',   icon: Newspaper },
]

const DEEP_INTEL = [
  { label: 'Pre-Post',    href: '/dashboard/pre-post',    icon: Zap     },
  { label: 'Funnel',      href: '/dashboard/funnel',      icon: Filter  },
  { label: 'Cultural',    href: '/dashboard/cultural',    icon: Globe   },
  { label: 'Competitive', href: '/dashboard/competitive', icon: Trophy  },
  { label: 'Creative',    href: '/dashboard/creative',    icon: Palette },
  { label: 'Influencers', href: '/dashboard/influencers', icon: Users   },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function NavSeparator({ expanded }: { expanded: boolean }) {
  return (
    <div className={cn('my-2.5 flex items-center gap-2', expanded ? 'px-0' : 'px-0')}>
      <div className="h-px flex-1 bg-sidebar-border/50" />
    </div>
  )
}

function SectionLabel({ children, expanded }: { children: React.ReactNode; expanded: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-[10px] pb-1.5 pt-1',
        'transition-opacity duration-150',
        expanded ? 'opacity-100 delay-75' : 'opacity-0 h-0 overflow-hidden py-0',
      )}
    >
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-sidebar-foreground/30 whitespace-nowrap">
        {children}
      </p>
    </div>
  )
}

// ── Nav item ──────────────────────────────────────────────────────────────────

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  expanded,
}: {
  href: string
  icon: React.ElementType
  label: string
  active: boolean
  expanded: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 h-9 px-[10px] rounded-lg transition-all duration-150 group relative',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-sidebar-foreground/45 hover:text-sidebar-foreground hover:bg-sidebar-accent',
      )}
    >
      {/* Icon with subtle active-state ring */}
      <div
        className={cn(
          'h-[26px] w-[26px] rounded-md flex items-center justify-center shrink-0 transition-all duration-150',
          active ? 'bg-primary/15' : 'group-hover:bg-sidebar-accent',
        )}
      >
        <Icon className={cn('h-[15px] w-[15px]', active ? 'opacity-100' : 'opacity-70 group-hover:opacity-100')} />
      </div>

      {/* Label — visible only when sidebar expanded */}
      <span
        className={cn(
          'whitespace-nowrap text-[13px] font-medium transition-opacity duration-150',
          expanded ? 'opacity-100 delay-75' : 'opacity-0',
        )}
      >
        {label}
      </span>
    </Link>
  )
}

// ── Main nav ──────────────────────────────────────────────────────────────────

export function DashboardNav({ expanded = true }: { expanded?: boolean }) {
  const pathname = usePathname()

  const onCampaign = CAMPAIGN_PATHS.some(p => pathname.startsWith(p))
  const [campaignOpen, setCampaignOpen] = useState(onCampaign)

  useEffect(() => {
    if (onCampaign) setCampaignOpen(true)
  }, [onCampaign])

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  return (
    <nav className="space-y-0.5" aria-label="Dashboard navigation">

      {/* Intelligence */}
      <SectionLabel expanded={expanded}>Intelligence</SectionLabel>
      {INTELLIGENCE.map(({ label, href, icon }) => (
        <NavItem key={href} href={href} icon={icon} label={label} active={isActive(href)} expanded={expanded} />
      ))}

      <NavSeparator expanded={expanded} />

      {/* Campaigns */}
      <SectionLabel expanded={expanded}>Campaigns</SectionLabel>
      <div>
        <button
          onClick={() => expanded && setCampaignOpen(o => !o)}
          className={cn(
            'w-full flex items-center gap-3 h-9 px-[10px] rounded-lg transition-all duration-150',
            onCampaign
              ? 'text-foreground bg-muted/50'
              : 'text-sidebar-foreground/45 hover:text-sidebar-foreground hover:bg-sidebar-accent',
          )}
        >
          <div className="h-[26px] w-[26px] rounded-md flex items-center justify-center shrink-0">
            <Megaphone className="h-[15px] w-[15px] opacity-70" />
          </div>
          <span className={cn('flex-1 text-left text-[13px] font-medium whitespace-nowrap transition-opacity duration-150', expanded ? 'opacity-100 delay-75' : 'opacity-0')}>
            Campaigns
          </span>
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 opacity-50 transition-transform duration-200 transition-opacity', expanded ? 'opacity-50' : 'opacity-0', campaignOpen && 'rotate-180')} />
        </button>

        {/* Sub-items — only visible in expanded mode */}
        {campaignOpen && expanded && (
          <div className="mt-1 ml-3 pl-3 border-l border-sidebar-border/40 space-y-0.5">
            {CAMPAIGN_SUB.map(({ label, href, icon: Icon }) => {
              const active = href === '/dashboard/campaigns'
                ? pathname === '/dashboard/campaigns' || pathname.startsWith('/dashboard/campaigns/')
                : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-2 h-8 px-2 rounded-md text-[12.5px] font-medium transition-all duration-150',
                    active
                      ? 'text-primary bg-primary/8'
                      : 'text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  {label}
                </Link>
              )
            })}

            {/* Soon items */}
            <div className="pt-1 border-t border-sidebar-border/30 mt-1">
              {CAMPAIGN_SOON.map(({ label, icon: Icon }) => (
                <span
                  key={label}
                  className="flex items-center gap-2 h-8 px-2 rounded-md text-[12.5px] text-sidebar-foreground/25 cursor-not-allowed select-none"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                  <span className="ml-auto text-[9px] font-medium border border-sidebar-border/30 rounded px-1 py-px">
                    Soon
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <NavSeparator expanded={expanded} />

      {/* Deep Intelligence */}
      <SectionLabel expanded={expanded}>Deep Intel</SectionLabel>
      {DEEP_INTEL.map(({ label, href, icon }) => (
        <NavItem key={href} href={href} icon={icon} label={label} active={isActive(href)} expanded={expanded} />
      ))}

      <NavSeparator expanded={expanded} />

      {/* Ask AI — always highlighted */}
      <Link
        href="/dashboard/ask"
        className={cn(
          'flex items-center gap-3 h-9 px-[10px] rounded-lg transition-all duration-150 group',
          pathname.startsWith('/dashboard/ask')
            ? 'bg-primary/10 text-primary'
            : 'text-primary/60 hover:text-primary hover:bg-primary/8',
        )}
      >
        <div className={cn(
          'h-[26px] w-[26px] rounded-md flex items-center justify-center shrink-0 transition-all',
          pathname.startsWith('/dashboard/ask') ? 'bg-primary/15' : 'group-hover:bg-primary/10',
        )}>
          <Sparkles className="h-[15px] w-[15px]" />
        </div>
        <span className={cn('whitespace-nowrap text-[13px] font-semibold transition-opacity duration-150', expanded ? 'opacity-100 delay-75' : 'opacity-0')}>
          Ask AI
        </span>
      </Link>
    </nav>
  )
}
