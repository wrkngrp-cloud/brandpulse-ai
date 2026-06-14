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

// ── Data ──────────────────────────────────────────────────────────────────────

const INTELLIGENCE_LINKS = [
  { label: 'Overview',     href: '/dashboard',              icon: LayoutDashboard },
  { label: 'Content',      href: '/dashboard/content',      icon: FileText        },
  { label: 'Sentiment',    href: '/dashboard/sentiment',    icon: BarChart2       },
  { label: 'Brand Equity', href: '/dashboard/brand-equity', icon: Award           },
  { label: 'Surveys',      href: '/dashboard/surveys',      icon: ClipboardList   },
]

const CAMPAIGN_PATHS = ['/dashboard/campaigns', '/dashboard/ooh', '/dashboard/events']

const CAMPAIGN_SUB = [
  { label: 'All Campaigns', href: '/dashboard/campaigns', icon: Megaphone    },
  { label: 'OOH Placements', href: '/dashboard/ooh',      icon: MapPin       },
  { label: 'Events',         href: '/dashboard/events',    icon: CalendarDays },
]

const CAMPAIGN_SOON = [
  { label: 'Digital', icon: Monitor   },
  { label: 'Radio',   icon: Radio     },
  { label: 'TV',      icon: Tv        },
  { label: 'Print',   icon: Newspaper },
]

const DEEP_INTEL_LINKS = [
  { label: 'Pre-Post',    href: '/dashboard/pre-post',    icon: Zap     },
  { label: 'Funnel',      href: '/dashboard/funnel',      icon: Filter  },
  { label: 'Cultural',    href: '/dashboard/cultural',    icon: Globe   },
  { label: 'Competitive', href: '/dashboard/competitive', icon: Trophy  },
  { label: 'Creative',    href: '/dashboard/creative',    icon: Palette },
  { label: 'Influencers', href: '/dashboard/influencers', icon: Users   },
]

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pt-5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-sidebar-foreground/35 select-none first:pt-1">
      {children}
    </p>
  )
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string
  icon: React.ElementType
  label: string
  active: boolean
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] font-medium transition-all duration-150 outline-none group',
          active
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent',
        )}
      >
        <Icon
          className={cn(
            'h-[15px] w-[15px] shrink-0 transition-colors',
            active ? 'opacity-90' : 'opacity-70 group-hover:opacity-100',
          )}
        />
        {label}
      </Link>
    </li>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function DashboardNav() {
  const pathname = usePathname()

  const onCampaignPath = CAMPAIGN_PATHS.some(p => pathname.startsWith(p))
  const [campaignOpen, setCampaignOpen] = useState(onCampaignPath)

  useEffect(() => {
    if (onCampaignPath) setCampaignOpen(true)
  }, [onCampaignPath])

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  return (
    <nav aria-label="Dashboard navigation">
      {/* ── Intelligence ─────────────────────────────────────────────── */}
      <SectionLabel>Intelligence</SectionLabel>
      <ul className="space-y-0.5">
        {INTELLIGENCE_LINKS.map(({ label, href, icon }) => (
          <NavItem key={href} href={href} icon={icon} label={label} active={isActive(href)} />
        ))}
      </ul>

      {/* ── Campaigns ────────────────────────────────────────────────── */}
      <SectionLabel>Campaigns</SectionLabel>
      <ul className="space-y-0.5">
        <li>
          <button
            onClick={() => setCampaignOpen(o => !o)}
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] font-medium transition-all duration-150 outline-none',
              onCampaignPath
                ? 'text-sidebar-foreground'
                : 'text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent',
            )}
          >
            <Megaphone className="h-[15px] w-[15px] shrink-0 opacity-70" />
            <span className="flex-1 text-left">Campaigns</span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 shrink-0 opacity-50 transition-transform duration-200',
                campaignOpen && 'rotate-180',
              )}
            />
          </button>

          {campaignOpen && (
            <ul className="mt-1 ml-4 pl-3 border-l border-sidebar-border/60 space-y-0.5">
              {CAMPAIGN_SUB.map(({ label, href, icon: Icon }) => {
                const active = href === '/dashboard/campaigns'
                  ? pathname === '/dashboard/campaigns' || pathname.startsWith('/dashboard/campaigns/')
                  : pathname.startsWith(href)
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded-md text-[12.5px] font-medium transition-all duration-150',
                        active
                          ? 'text-primary font-semibold'
                          : 'text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      {label}
                    </Link>
                  </li>
                )
              })}

              <li>
                <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/25">
                  Coming soon
                </p>
              </li>

              {CAMPAIGN_SOON.map(({ label, icon: Icon }) => (
                <li key={label}>
                  <span className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12.5px] text-sidebar-foreground/30 cursor-not-allowed select-none">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {label}
                    <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full border border-sidebar-border/50 text-sidebar-foreground/30">
                      Soon
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </li>
      </ul>

      {/* ── Deep Intelligence ─────────────────────────────────────────── */}
      <SectionLabel>Deep Intelligence</SectionLabel>
      <ul className="space-y-0.5">
        {DEEP_INTEL_LINKS.map(({ label, href, icon }) => (
          <NavItem key={href} href={href} icon={icon} label={label} active={isActive(href)} />
        ))}
      </ul>

      {/* ── Ask AI — special CTA ──────────────────────────────────────── */}
      <div className="pt-5 pb-2">
        <Link
          href="/dashboard/ask"
          className={cn(
            'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13.5px] font-semibold transition-all duration-150 outline-none',
            pathname.startsWith('/dashboard/ask')
              ? 'bg-primary text-primary-foreground shadow-md'
              : [
                  'border text-primary hover:bg-primary hover:text-primary-foreground',
                  'border-primary/25 bg-primary/8',
                  'hover:border-primary/40 hover:shadow-sm',
                ].join(' '),
          )}
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          Ask AI
          {!pathname.startsWith('/dashboard/ask') && (
            <span
              className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'oklch(0.55 0.25 258 / 15%)' }}
            >
              AI
            </span>
          )}
        </Link>
      </div>
    </nav>
  )
}
