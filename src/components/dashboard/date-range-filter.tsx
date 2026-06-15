'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

const PRESETS = [
  { label: '7d',    days: 7,   title: 'Last 7 days'  },
  { label: '30d',   days: 30,  title: 'Last 30 days' },
  { label: '12wk',  days: 84,  title: '12 weeks'     },
  { label: '6mo',   days: 180, title: '6 months'     },
]

export function DateRangeFilter({ defaultDays = 84 }: { defaultDays?: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentDays = Number(searchParams.get('days') ?? defaultDays)

  function select(days: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (days === defaultDays) {
      params.delete('days')
    } else {
      params.set('days', String(days))
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
      {PRESETS.map(p => (
        <button
          key={p.days}
          title={p.title}
          onClick={() => select(p.days)}
          className={cn(
            'text-[11px] font-medium px-2.5 py-1 rounded-md transition-all',
            currentDays === p.days
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
