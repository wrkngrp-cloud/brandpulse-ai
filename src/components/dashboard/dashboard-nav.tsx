'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion, LayoutGroup } from 'framer-motion'
import {
  LayoutDashboard, BarChart2, ClipboardList, CalendarDays,
  MapPin, Megaphone, Zap, Trophy, ChevronDown, Monitor, Radio,
  Tv, Newspaper, Filter, Users, Palette, Globe, Target,
  FileSearch, BookOpen, PieChart, Sparkles, ClipboardCheck,
  Plug, BarChart3, Clipboard, AlertTriangle, Heart, Database,
  ShoppingBag, DollarSign, FlaskConical, Activity, Gift,
  FileText, TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Architecture ──────────────────────────────────────────────────────────────
//
//  The nav tells the marketer's story in order:
//
//  BRAND HEALTH      How is my brand doing?
//  INTELLIGENCE      What is happening in the market?
//  CAMPAIGNS         What am I running? (one section — all channels inside it)
//  CREATIVE          What am I saying?
//  RESEARCH          What do customers tell me?
//  MEASUREMENT       Is it working?
//  GROWTH            How do I keep and grow my base?
//  REPORTS           How do I present results?
//  SETUP             Connect and configure
//
//  Inside CAMPAIGNS, three natural groups separated by thin dividers (not headers):
//    Overview: All Campaigns
//    Digital:  Digital Ads · Influencers
//    Physical: Out of Home · Events & Activation
//    Broadcast: Radio · TV · Print

type NavEntry =
  | { label: string; href: string; icon: React.ElementType }
  | { divider: true }

// ── Section data ──────────────────────────────────────────────────────────────

const BRAND_HEALTH: NavEntry[] = [
  { label: 'Sentiment',    href: '/dashboard/sentiment',    icon: BarChart2 },
  { label: 'Brand Health', href: '/dashboard/brand-equity', icon: Activity  },
  { label: 'Content',      href: '/dashboard/content',      icon: FileText  },
  { label: 'Funnel',       href: '/dashboard/funnel',       icon: Filter    },
]

const INTELLIGENCE: NavEntry[] = [
  { label: 'Competitive',        href: '/dashboard/competitive',        icon: Trophy      },
  { label: 'Marketplace',        href: '/dashboard/marketplace',        icon: ShoppingBag },
  { label: 'Cultural Insights',  href: '/dashboard/cultural',           icon: Globe       },
  { label: 'Field Intelligence', href: '/dashboard/field-intelligence', icon: Clipboard   },
  { label: 'PR Tracking',        href: '/dashboard/pr',                 icon: FileSearch  },
]

// Campaigns: one section, three channel groups separated by thin dividers.
// No sub-section headers — the dividers carry the grouping signal.
const CAMPAIGNS: NavEntry[] = [
  { label: 'All Campaigns',       href: '/dashboard/campaigns',   icon: Megaphone   },
  { divider: true },
  { label: 'Digital Ads',         href: '/dashboard/digital',     icon: Monitor     },
  { label: 'Influencers',         href: '/dashboard/influencers', icon: Users       },
  { divider: true },
  { label: 'Out of Home',         href: '/dashboard/ooh',         icon: MapPin      },
  { label: 'Events & Activation', href: '/dashboard/events',      icon: CalendarDays },
  { divider: true },
  { label: 'Radio',               href: '/dashboard/radio',       icon: Radio       },
  { label: 'TV',                  href: '/dashboard/tv',          icon: Tv          },
  { label: 'Print',               href: '/dashboard/print',       icon: Newspaper   },
]

const CREATIVE_LAB_PATHS = ['/dashboard/voice-builder', '/dashboard/pre-post', '/dashboard/creative']
const CREATIVE_LAB_SUB = [
  { label: 'Voice Builder',    href: '/dashboard/voice-builder', icon: Sparkles },
  { label: 'Pre-Post Intel',   href: '/dashboard/pre-post',      icon: Zap      },
  { label: 'Creative Analysis',href: '/dashboard/creative',      icon: Palette  },
]

const SURVEY_PATHS = ['/dashboard/surveys']
const SURVEY_SUB = [
  { label: 'All Surveys',     href: '/dashboard/surveys',        icon: ClipboardList  },
  { label: 'NPS Tracker',     href: '/dashboard/surveys/nps',    icon: TrendingUp     },
  { label: 'Tracking Panels', href: '/dashboard/surveys/panels', icon: ClipboardCheck },
]

const MEASUREMENT: NavEntry[] = [
  { label: 'Media Mix',       href: '/dashboard/mmm',      icon: PieChart   },
  { label: 'Geo-Lift',        href: '/dashboard/geo-lift', icon: Target     },
  { label: 'Budget & Pacing', href: '/dashboard/budget',   icon: DollarSign },
]

const GROWTH: NavEntry[] = [
  { label: 'Retention Risk', href: '/dashboard/retention', icon: AlertTriangle },
  { label: 'Loyalty Engine', href: '/dashboard/loyalty',   icon: Gift          },
  { label: 'Advocacy',       href: '/dashboard/advocacy',  icon: Heart         },
  { label: 'Customer Data',  href: '/dashboard/cdp',       icon: Database      },
]

const REPORTS: NavEntry[] = [
  { label: 'Business Case', href: '/dashboard/business-case', icon: BarChart3 },
  { label: 'Methodology',   href: '/dashboard/methodology',   icon: BookOpen  },
]

// ── Primitives ────────────────────────────────────────────────────────────────

function SectionLabel({ children, expanded }: { children: React.ReactNode; expanded: boolean }) {
  if (expanded) {
    return (
      <p className="px-3 pt-5 pb-1.5 text-[9.5px] font-bold uppercase tracking-[0.13em] text-sidebar-foreground/35 select-none whitespace-nowrap">
        {children}
      </p>
    )
  }
  return <div className="mx-auto my-3 h-px w-6 bg-sidebar-border/60" />
}

function InSectionDivider({ expanded }: { expanded: boolean }) {
  if (!expanded) return null
  return <div className="mx-3 my-1 h-px bg-sidebar-border/40" />
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

function NavSection({
  entries, isActive, expanded,
}: {
  entries: NavEntry[]
  isActive: (href: string) => boolean
  expanded: boolean
}) {
  return (
    <>
      {entries.map((entry, i) => {
        if ('divider' in entry) return <InSectionDivider key={`div-${i}`} expanded={expanded} />
        return (
          <NavItem
            key={entry.href}
            href={entry.href}
            icon={entry.icon}
            label={entry.label}
            active={isActive(entry.href)}
            expanded={expanded}
          />
        )
      })}
    </>
  )
}

function CollapsibleSection({
  label, paths, sub, icon: Icon, expanded, pathname,
}: {
  label:    string
  paths:    string[]
  sub:      { label: string; href: string; icon: React.ElementType; badge?: string }[]
  icon:     React.ElementType
  expanded: boolean
  pathname: string
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
        </div>
      )}
    </>
  )
}

// ── Main nav ──────────────────────────────────────────────────────────────────

export function DashboardNav({ expanded = true }: { expanded?: boolean }) {
  const pathname = usePathname()
  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <LayoutGroup>
      <nav className="flex flex-col gap-0.5" aria-label="Dashboard navigation">

        <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" active={isActive('/dashboard')} expanded={expanded} />

        {/* Brand Health first — the core product value: how is my brand doing? */}
        <SectionLabel expanded={expanded}>Brand Health</SectionLabel>
        <NavSection entries={BRAND_HEALTH} isActive={isActive} expanded={expanded} />

        {/* Research adjacent to Brand Health — both answer "what do customers think?" */}
        <SectionLabel expanded={expanded}>Research</SectionLabel>
        <CollapsibleSection
          label="Surveys"
          paths={SURVEY_PATHS}
          sub={SURVEY_SUB}
          icon={ClipboardList}
          expanded={expanded}
          pathname={pathname}
        />

        <SectionLabel expanded={expanded}>Intelligence</SectionLabel>
        <NavSection entries={INTELLIGENCE} isActive={isActive} expanded={expanded} />

        {/* CAMPAIGNS — all channels in one section */}
        <SectionLabel expanded={expanded}>Campaigns</SectionLabel>
        <NavSection entries={CAMPAIGNS} isActive={isActive} expanded={expanded} />

        {/* Creative Intelligence — voice, analysis, library, A/B testing */}
        <SectionLabel expanded={expanded}>Creative Intelligence</SectionLabel>
        <CollapsibleSection
          label="Creative Lab"
          paths={CREATIVE_LAB_PATHS}
          sub={CREATIVE_LAB_SUB}
          icon={Palette}
          expanded={expanded}
          pathname={pathname}
        />
        <NavItem href="/dashboard/creative-library" icon={BookOpen}      label="Creative Library"    active={isActive('/dashboard/creative-library')}  expanded={expanded} />
        <NavItem href="/dashboard/creative-fatigue" icon={AlertTriangle}  label="Fatigue Monitor"    active={isActive('/dashboard/creative-fatigue')}  expanded={expanded} />
        <NavItem href="/dashboard/experiments"       icon={FlaskConical}  label="A/B Testing"        active={isActive('/dashboard/experiments')}        expanded={expanded} />

        <SectionLabel expanded={expanded}>Measurement</SectionLabel>
        <NavSection entries={MEASUREMENT} isActive={isActive} expanded={expanded} />

        <SectionLabel expanded={expanded}>Growth</SectionLabel>
        <NavSection entries={GROWTH} isActive={isActive} expanded={expanded} />

        <SectionLabel expanded={expanded}>Reports</SectionLabel>
        <NavSection entries={REPORTS} isActive={isActive} expanded={expanded} />

        <SectionLabel expanded={expanded}>Setup</SectionLabel>
        <NavItem href="/dashboard/connectors" icon={Plug} label="Connectors" active={isActive('/dashboard/connectors')} expanded={expanded} />

      </nav>
    </LayoutGroup>
  )
}
