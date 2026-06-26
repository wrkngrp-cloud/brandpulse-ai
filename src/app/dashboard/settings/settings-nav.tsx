'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, Building2, Link2, MapPin, Swords, Share2, Layers, Plug, ExternalLink, ClipboardList, Code2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const SETTINGS_LINKS = [
  { label: 'Profile',            href: '/dashboard/settings/profile',      icon: User          },
  { label: 'Brands',             href: '/dashboard/settings/brands',       icon: Layers        },
  { label: 'Brand',              href: '/dashboard/settings/brand',        icon: Building2     },
  { label: 'Connected Accounts', href: '/dashboard/settings/connections',  icon: Link2         },
  { label: 'OOH Domain',         href: '/dashboard/settings/ooh-domain',   icon: MapPin        },
  { label: 'Competitors',        href: '/dashboard/settings/competitors',   icon: Swords        },
  { label: 'Field Teams',        href: '/dashboard/settings/field-teams',  icon: ClipboardList },
  { label: 'Pixel & SDK',        href: '/dashboard/settings/pixel',        icon: Code2         },
  { label: 'Client Portal',      href: '/dashboard/settings/portal',       icon: Share2        },
  // Billing hidden during beta — re-enable post-validation
]

export function SettingsNav() {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-0.5">
      {SETTINGS_LINKS.map(({ label, href, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
              active
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        )
      })}

      {/* Connector management lives under Platform → Connectors */}
      <div className="mt-3 pt-3 border-t border-border/50">
        <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Add integrations</p>
        <Link
          href="/dashboard/connectors"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50"
        >
          <Plug className="h-4 w-4 shrink-0" />
          All Connectors
          <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
        </Link>
      </div>
    </nav>
  )
}
