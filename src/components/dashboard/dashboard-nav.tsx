'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion, LayoutGroup } from 'framer-motion'
import {
  LayoutDashboard, FileText, BarChart2, ClipboardList,
  CalendarDays, MapPin, Megaphone, Zap, Trophy, ChevronDown,
  Monitor, Radio, Tv, Newspaper, Filter, Award, Users, Palette, Globe,
  Target, FileSearch, BookOpen, PieChart, Sparkles, ClipboardCheck,
  TrendingUp, Plug, BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Section data ────────────────────────────────────────────────────────────

const INTELLIGENCE = [
  { label: 'Overview',     href: '/dashboard',              icon: LayoutDashboard },
  { label: 'Sentiment',    href: '/dashboard/sentiment',    icon: BarChart2       },
  { label: 'Brand Equity', href: '/dashboard/brand-equity', icon: Award           },
  { label: 'Content',      href: '/dashboard/content',      icon: FileText        },
]

const AUDIENCE = [
  { label: 'Competitive',  href: '/dashboard/competitive', icon: Trophy     },
  { label: 'Influencers',  href: '/dashboard/influencers', icon: Users      },
  { label: 'Cultural',     href: '/dashboard/cultural',    icon: Globe      },
  { label: 'PR Tracking',  href: '/dashboard/pr',          icon: FileSearch },
]

const CAMPAIGN_PATHS = ['/dashboard/campaigns', '/dashboard/ooh', '/dashboard/events', '/dashboard/digital', '/dashboard/radio', '/dashboard/tv', '/dashboard/print']

const CAMPAIGN_SUB = [
  { label: 'All Campaigns',  href: '/dashboard/campaigns', icon: Megaphone    },
  { label: 'OOH Placements', href: '/dashboard/ooh',       icon: MapPin       },
  { label: 'Events',         href: '/dashboard/events',    icon: CalendarDays },
]
const CAMPAIGN_PAID = [
  { label: 'Digital', href: '/dashboard/digital', icon: Monitor   },
  { label: 'Radio',   href: '/dashboard/radio',   icon: Radio     },
  { label: 'TV',      href: '/dashboard/tv',      icon: Tv        },
  { label: 'Print',   href: '/dashboard/print',   icon: Newspaper },
]

// Creative Analysis — Voice Builder is the required first step
const CREATIVE_PATHS = ['/dashboard/pre-post', '/dashboard/creative', '/dashboard/funnel', '/dashboard/settings/voice-builder']

const CREATIVE_SUB = [
  { label: 'Voice Builder', href: '/dashboard/settings/voice-builder', icon: Sparkles, badge: 'Setup' },
  { label: 'Pre-Post Intel', href: '/dashboard/pre-post',              icon: Zap  },
  { label: 'Creative Library', href: '/dashboard/creative',            icon: Palette },
  { label: 'Funnel',          href: '/dashboard/funnel',               icon: Filter  },
]

// Surveys — panels live here now
const SURVEY_PATHS = ['/dashboard/surveys']

const SURVEY_SUB = [
  { label: 'All Surveys',      href: '/dashboard/surveys',         icon: ClipboardList  },
  { label: 'NPS Tracker',      href: '/dashboard/surveys/nps',     icon: TrendingUp     },
  { label: 'Tracking Panels',  href: '/dashboard/surveys/panels',  icon: ClipboardCheck },
]

const REPORTING = [
  { label: 'Media Mix',     href: '/dashboard/mmm',       icon: PieChart  },
  { label: 'Geo-Lift',      href: '/dashboard/geo-lift',  icon: Target    },
  { label: 'Business Case', href: '/dashboard/business-case', icon: BarChart3 },
  { label: 'Methodology',   href: '/dashboard/methodology', icon: BookOpen },
]

// ── Primitives ─────────────────────────────────────────────────────────────

function SectionLabel({ children, expanded }: { children: React.ReactNode; expanded: boolean }) {
  if (expanded) {
    return (
      <p className="px-3 pt-4 pb-1.5 text-[9.5px] font-bold uppercase tracking-[0.13em] text-sidebar-foreground/35 select-none whitespace-nowrap">
        {children}
      </p>
    )
  }
  return <div className="mx-auto my-3 h-px w-6 bg-sidebar-border/60" />
}

function NavItem({
  href, icon: Icon, label, active, expanded,
}: {
  href: string; icon: React.ElementType; label: string; active: boolean; expanded: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'relative flex items-center gap-3 h-[38px] rounded-xl transition-colors duration-150 group',
        expanded ? 'px-3' : 'px-0 justify-center',
        active
          ? 'nav-pill-active text-white'
          : 'text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent',
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-rail"
          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-white/80"
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}
      <Icon className={cn(
        'shrink-0 transition-all duration-150',
        expanded ? 'h-[15px] w-[15px]' : 'h-[16px] w-[16px]',
        active ? 'opacity-100' : 'opacity-65 group-hover:opacity-100',
      )} />
      {expanded && (
        <span className="text-[13px] font-medium whitespace-nowrap leading-none">{label}</span>
      )}
    </Link>
  )
}

function CollapsibleSection({
  label, paths, sub, paidSub, icon: Icon, expanded, pathname,
  badgeMap,
}: {
  label: string
  paths: string[]
  sub: { label: string; href: string; icon: React.ElementType; badge?: string }[]
  paidSub?: { label: string; href: string; icon: React.ElementType }[]
  icon: React.ElementType
  expanded: boolean
  pathname: string
  badgeMap?: Record<string, string>
}) {
  const isOnSection = paths.some(p => pathname === p || pathname.startsWith(p + '/'))
    || sub.some(s => pathname === s.href || pathname.startsWith(s.href + '/'))
  const [open, setOpen] = useState(isOnSection)

  useEffect(() => { if (isOnSection) setOpen(true) }, [isOnSection])

  return (
    <>
      <button
        onClick={() => expanded && setOpen(o => !o)}
        className={cn(
          'flex items-center gap-3 h-[38px] rounded-xl transition-colors duration-150 w-full',
          expanded ? 'px-3' : 'px-0 justify-center',
          isOnSection
            ? 'text-sidebar-foreground bg-sidebar-accent font-medium'
            : 'text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent',
        )}
      >
        <Icon className={cn('shrink-0 opacity-65', expanded ? 'h-[15px] w-[15px]' : 'h-[16px] w-[16px]')} />
        {expanded && (
          <>
            <span className="flex-1 text-left text-[13px] font-medium whitespace-nowrap">{label}</span>
            <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 opacity-40 transition-transform duration-200', open && 'rotate-180')} />
          </>
        )}
      </button>

      {open && expanded && (
        <div className="ml-3 pl-3 border-l border-sidebar-border/50 flex flex-col gap-0.5 mt-0.5">
          {sub.map(({ label: l, href, icon: SubIcon, badge }) => {
            const active = href === pathname || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 h-8 px-2.5 rounded-lg text-[12.5px] font-medium transition-colors duration-150',
                  active
                    ? 'text-primary bg-primary/10'
                    : 'text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent',
                )}
              >
                <SubIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="flex-1">{l}</span>
                {badge && (
                  <span className="text-[9px] font-bold uppercase tracking-wide bg-primary/15 text-primary rounded px-1 py-0.5 leading-none">{badge}</span>
                )}
              </Link>
            )
          })}
          {paidSub && (
            <div className="pt-1.5 border-t border-sidebar-border/30 mt-0.5 flex flex-col gap-0.5">
              {paidSub.map(({ label: l, href, icon: SubIcon }) => {
                const active = pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-2 h-8 px-2.5 rounded-lg text-[12.5px] font-medium transition-colors duration-150',
                      active
                        ? 'text-primary bg-primary/10'
                        : 'text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent',
                    )}
                  >
                    <SubIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    {l}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ── Main nav ────────────────────────────────────────────────────────────────

export function DashboardNav({ expanded = true }: { expanded?: boolean }) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <LayoutGroup>
      <nav className="flex flex-col gap-0.5" aria-label="Dashboard navigation">

        {/* Intelligence */}
        <SectionLabel expanded={expanded}>Intelligence</SectionLabel>
        {INTELLIGENCE.map(({ label, href, icon }) => (
          <NavItem key={href} href={href} icon={icon} label={label} active={isActive(href)} expanded={expanded} />
        ))}

        {/* Audience & Competitive */}
        <SectionLabel expanded={expanded}>Audience</SectionLabel>
        {AUDIENCE.map(({ label, href, icon }) => (
          <NavItem key={href} href={href} icon={icon} label={label} active={isActive(href)} expanded={expanded} />
        ))}

        {/* Campaigns */}
        <SectionLabel expanded={expanded}>Campaigns</SectionLabel>
        <CollapsibleSection
          label="Campaigns"
          paths={CAMPAIGN_PATHS}
          sub={CAMPAIGN_SUB}
          paidSub={CAMPAIGN_PAID}
          icon={Megaphone}
          expanded={expanded}
          pathname={pathname}
        />

        {/* Creative Analysis */}
        <SectionLabel expanded={expanded}>Creative</SectionLabel>
        <CollapsibleSection
          label="Creative Analysis"
          paths={CREATIVE_PATHS}
          sub={CREATIVE_SUB}
          icon={Palette}
          expanded={expanded}
          pathname={pathname}
        />

        {/* Surveys */}
        <SectionLabel expanded={expanded}>Surveys</SectionLabel>
        <CollapsibleSection
          label="Surveys"
          paths={SURVEY_PATHS}
          sub={SURVEY_SUB}
          icon={ClipboardList}
          expanded={expanded}
          pathname={pathname}
        />

        {/* Reporting */}
        <SectionLabel expanded={expanded}>Reporting</SectionLabel>
        {REPORTING.map(({ label, href, icon }) => (
          <NavItem key={href} href={href} icon={icon} label={label} active={isActive(href)} expanded={expanded} />
        ))}

        {/* Connectors */}
        <SectionLabel expanded={expanded}>Connectors</SectionLabel>
        <NavItem href="/dashboard/connectors" icon={Plug} label="All Connectors" active={isActive('/dashboard/connectors')} expanded={expanded} />

      </nav>
    </LayoutGroup>
  )
}
