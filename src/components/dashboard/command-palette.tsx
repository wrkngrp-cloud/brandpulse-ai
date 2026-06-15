'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command'
import {
  LayoutDashboard, FileText, BarChart2, ClipboardList, CalendarDays,
  MapPin, Megaphone, Zap, Trophy, Filter, Award, Users, Palette, Globe,
  Plus, Settings, TrendingUp, Sparkles, Radio, Search, ArrowRight,
} from 'lucide-react'

// ── Nav items ──────────────────────────────────────────────────────────────

const PAGES = [
  { label: 'Overview',            href: '/dashboard',                   icon: LayoutDashboard, group: 'Intelligence' },
  { label: 'Content',             href: '/dashboard/content',           icon: FileText,         group: 'Intelligence' },
  { label: 'Sentiment',           href: '/dashboard/sentiment',         icon: BarChart2,        group: 'Intelligence' },
  { label: 'Brand Equity',        href: '/dashboard/brand-equity',      icon: Award,            group: 'Intelligence' },
  { label: 'Surveys & NPS',       href: '/dashboard/surveys',           icon: ClipboardList,    group: 'Intelligence' },
  { label: 'NPS Tracker',         href: '/dashboard/surveys/nps',       icon: TrendingUp,       group: 'Intelligence' },
  { label: 'Campaigns',           href: '/dashboard/campaigns',         icon: Megaphone,        group: 'Campaigns'    },
  { label: 'OOH Placements',      href: '/dashboard/ooh',               icon: MapPin,           group: 'Campaigns'    },
  { label: 'Events',              href: '/dashboard/events',            icon: CalendarDays,     group: 'Campaigns'    },
  { label: 'Pre-Post Analysis',   href: '/dashboard/pre-post',          icon: Zap,              group: 'Deep Intel'   },
  { label: 'Funnel Intelligence', href: '/dashboard/funnel',            icon: Filter,           group: 'Deep Intel'   },
  { label: 'Cultural Intelligence',href: '/dashboard/cultural',         icon: Globe,            group: 'Deep Intel'   },
  { label: 'Competitive Intel',   href: '/dashboard/competitive',       icon: Trophy,           group: 'Deep Intel'   },
  { label: 'Creative Analysis',   href: '/dashboard/creative',          icon: Palette,          group: 'Deep Intel'   },
  { label: 'Influencer Tracker',  href: '/dashboard/influencers',       icon: Users,            group: 'Deep Intel'   },
  { label: 'Ask AI',              href: '/dashboard/ask',               icon: Sparkles,         group: 'Deep Intel'   },
  { label: 'Settings',            href: '/dashboard/settings',          icon: Settings,         group: 'Settings'     },
  { label: 'Brand Settings',      href: '/dashboard/settings/brand',    icon: Settings,         group: 'Settings'     },
  { label: 'Connections',         href: '/dashboard/settings/connections', icon: Radio,          group: 'Settings'     },
  { label: 'Competitors',         href: '/dashboard/settings/competitors', icon: Trophy,         group: 'Settings'     },
]

const ACTIONS = [
  { label: 'New Campaign',   href: '/dashboard/campaigns/new',   icon: Plus        },
  { label: 'Create Event',   href: '/dashboard/events/new',      icon: Plus        },
  { label: 'New OOH Site',   href: '/dashboard/ooh/new',         icon: Plus        },
  { label: 'Launch Survey',  href: '/dashboard/surveys',         icon: ClipboardList },
  { label: 'Run Pre-Post',   href: '/dashboard/pre-post',        icon: Zap         },
  { label: 'Search Mentions', href: '/dashboard/sentiment',      icon: Search      },
]

// Group pages
const GROUPS = ['Intelligence', 'Campaigns', 'Deep Intel', 'Settings'] as const

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    const onOpen = (e: Event) => {
      const prefill = (e as CustomEvent<string>).detail ?? ''
      setQuery(prefill)
      setOpen(true)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('bp:open-command', onOpen)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('bp:open-command', onOpen)
    }
  }, [])

  const go = useCallback((href: string) => {
    router.push(href)
    setOpen(false)
    setQuery('')
  }, [router])

  const askAiHref = `/dashboard/ask?q=${encodeURIComponent(query.trim())}`

  return (
    <CommandDialog open={open} onOpenChange={v => { setOpen(v); if (!v) setQuery('') }}>
      <CommandInput
        placeholder="Search pages, actions, or ask AI anything…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          <div className="py-6 text-center space-y-3">
            <Search className="h-8 w-8 text-muted-foreground/25 mx-auto" />
            <p className="text-sm text-muted-foreground">No pages found.</p>
            {query.trim() && (
              <button
                onClick={() => go(askAiHref)}
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Ask AI: &ldquo;{query.trim()}&rdquo;
              </button>
            )}
          </div>
        </CommandEmpty>

        {/* Ask AI — shows when user is typing a question */}
        {query.trim() && (
          <CommandGroup heading="Ask AI">
            <CommandItem
              value={`ask ai ${query}`}
              onSelect={() => go(askAiHref)}
              className="gap-3 cursor-pointer"
            >
              <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="truncate">Ask AI: &ldquo;{query.trim()}&rdquo;</span>
              <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground/30 shrink-0" />
            </CommandItem>
          </CommandGroup>
        )}

        {query.trim() && <CommandSeparator />}

        {/* Quick actions — always top */}
        <CommandGroup heading="Quick Actions">
          {ACTIONS.map(a => (
            <CommandItem
              key={a.label}
              value={a.label}
              onSelect={() => go(a.href)}
              className="gap-3 cursor-pointer"
            >
              <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <a.icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <span>{a.label}</span>
              <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground/30" />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Navigation groups */}
        {GROUPS.map(group => {
          const items = PAGES.filter(p => p.group === group)
          if (!items.length) return null
          return (
            <CommandGroup key={group} heading={group}>
              {items.map(p => (
                <CommandItem
                  key={p.href}
                  value={p.label}
                  onSelect={() => go(p.href)}
                  className="gap-3 cursor-pointer"
                >
                  <p.icon className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                  <span>{p.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )
        })}
      </CommandList>
    </CommandDialog>
  )
}
