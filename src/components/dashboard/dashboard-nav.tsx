'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion, LayoutGroup } from 'framer-motion'
import {
  LayoutDashboard, FileText, BarChart2, ClipboardList, Sparkles,
  CalendarDays, MapPin, Megaphone, Zap, Trophy, ChevronDown,
  Monitor, Radio, Tv, Newspaper, Filter, Award, Users, Palette, Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Nav data ───────────────────────────────────────────────────────────────

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
  href,
  icon: Icon,
  label,
  active,
  expanded,
}: {
  href:     string
  icon:     React.ElementType
  label:    string
  active:   boolean
  expanded: boolean
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
      {/* Sliding rail indicator on active — driven by LayoutGroup */}
      {active && (
        <motion.span
          layoutId="nav-rail"
          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-white/80"
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}

      <Icon
        className={cn(
          'shrink-0 transition-all duration-150',
          expanded ? 'h-[15px] w-[15px]' : 'h-[16px] w-[16px]',
          active ? 'opacity-100' : 'opacity-65 group-hover:opacity-100',
        )}
      />

      {expanded && (
        <span className="text-[13px] font-medium whitespace-nowrap leading-none">
          {label}
        </span>
      )}
    </Link>
  )
}

// ── Main nav ────────────────────────────────────────────────────────────────

export function DashboardNav({ expanded = true }: { expanded?: boolean }) {
  const pathname   = usePathname()
  const onCampaign = CAMPAIGN_PATHS.some(p => pathname.startsWith(p))
  const [campaignOpen, setCampaignOpen] = useState(onCampaign)

  useEffect(() => { if (onCampaign) setCampaignOpen(true) }, [onCampaign])

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  return (
    <LayoutGroup>
      <nav className="flex flex-col gap-0.5" aria-label="Dashboard navigation">

        {/* Intelligence */}
        <SectionLabel expanded={expanded}>Intelligence</SectionLabel>
        {INTELLIGENCE.map(({ label, href, icon }) => (
          <NavItem key={href} href={href} icon={icon} label={label} active={isActive(href)} expanded={expanded} />
        ))}

        {/* Campaigns */}
        <SectionLabel expanded={expanded}>Campaigns</SectionLabel>
        <button
          onClick={() => expanded && setCampaignOpen(o => !o)}
          className={cn(
            'flex items-center gap-3 h-[38px] rounded-xl transition-colors duration-150 w-full',
            expanded ? 'px-3' : 'px-0 justify-center',
            onCampaign
              ? 'text-sidebar-foreground bg-sidebar-accent font-medium'
              : 'text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent',
          )}
        >
          <Megaphone className={cn('shrink-0 opacity-65', expanded ? 'h-[15px] w-[15px]' : 'h-[16px] w-[16px]')} />
          {expanded && (
            <>
              <span className="flex-1 text-left text-[13px] font-medium whitespace-nowrap">Campaigns</span>
              <ChevronDown className={cn(
                'h-3.5 w-3.5 shrink-0 opacity-40 transition-transform duration-200',
                campaignOpen && 'rotate-180',
              )} />
            </>
          )}
        </button>

        {campaignOpen && expanded && (
          <div className="ml-3 pl-3 border-l border-sidebar-border/50 flex flex-col gap-0.5 mt-0.5">
            {CAMPAIGN_SUB.map(({ label, href, icon: Icon }) => {
              const active = href === '/dashboard/campaigns'
                ? pathname === href || pathname.startsWith(`${href}/`)
                : pathname.startsWith(href)
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
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  {label}
                </Link>
              )
            })}

            <div className="pt-1.5 border-t border-sidebar-border/30 mt-0.5 flex flex-col gap-0.5">
              {CAMPAIGN_SOON.map(({ label, icon: Icon }) => (
                <span
                  key={label}
                  className="flex items-center gap-2 h-8 px-2.5 rounded-lg text-[12.5px] text-sidebar-foreground/22 cursor-not-allowed select-none"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-50" />
                  {label}
                  <span className="ml-auto text-[9px] font-semibold tracking-wide border border-sidebar-border/35 rounded px-1.5 py-px text-sidebar-foreground/30">
                    Soon
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Deep Intelligence */}
        <SectionLabel expanded={expanded}>Deep Intel</SectionLabel>
        {DEEP_INTEL.map(({ label, href, icon }) => (
          <NavItem key={href} href={href} icon={icon} label={label} active={isActive(href)} expanded={expanded} />
        ))}

      </nav>
    </LayoutGroup>
  )
}
