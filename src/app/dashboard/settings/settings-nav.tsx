'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, Building2, Link2, MapPin, Swords, Code2, Sparkles, Share2, CreditCard, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { label: 'Profile',            href: '/dashboard/settings/profile',        icon: User      },
  { label: 'Brands',             href: '/dashboard/settings/brands',          icon: Layers    },
  { label: 'Brand',              href: '/dashboard/settings/brand',           icon: Building2 },
  { label: 'Voice Builder',      href: '/dashboard/settings/voice-builder',   icon: Sparkles  },
  { label: 'Connected Accounts', href: '/dashboard/settings/connections',     icon: Link2     },
  { label: 'OOH Domain',         href: '/dashboard/settings/ooh-domain',     icon: MapPin    },
  { label: 'Competitors',        href: '/dashboard/settings/competitors',     icon: Swords    },
  { label: 'Pixel & SDK',        href: '/dashboard/settings/pixel',           icon: Code2     },
  { label: 'Client Portal',      href: '/dashboard/settings/portal',          icon: Share2    },
  { label: 'Billing & Plan',     href: '/dashboard/settings/billing',         icon: CreditCard },
]

export function SettingsNav() {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-0.5">
      {links.map(({ label, href, icon: Icon }) => {
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
    </nav>
  )
}
