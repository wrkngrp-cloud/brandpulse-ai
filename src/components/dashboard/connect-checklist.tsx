'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Check, ArrowRight, X, Plug } from 'lucide-react'
import { cn } from '@/lib/utils'
import { markTourStatus } from '@/app/dashboard/tours/actions'

export interface ConnectChecklistItem {
  id:          string
  label:       string
  description: string
  href:        string
  done:        boolean
}

// Mirrors the tour convention: demo accounts share a login, so "dismissed"
// lives in this browser's storage for them (see tour-trigger.tsx).
const STORAGE_KEY = 'bp_tour_seen_connect_checklist'

export function ConnectChecklist({ items, serverDismissed }: {
  items:           ConnectChecklistItem[]
  serverDismissed: boolean
}) {
  const doneCount = items.filter(i => i.done).length
  const allDone   = items.length > 0 && doneCount === items.length

  const [dismissedNow, setDismissedNow] = useState(false)

  // Browser-side dismissal (demo accounts and instant hide after clicking X).
  // useSyncExternalStore lets the server render assume "not dismissed" and the
  // client correct it without setting state from an effect.
  const locallyDismissed = useSyncExternalStore(
    () => () => {},
    () => !!window.localStorage.getItem(STORAGE_KEY),
    () => false,
  )
  const dismissed = serverDismissed || locallyDismissed || dismissedNow

  // Once every source is connected the job is done — record it so the list
  // stays gone on every device, then stop rendering.
  useEffect(() => {
    if (allDone && !serverDismissed) {
      window.localStorage.setItem(STORAGE_KEY, '1')
      markTourStatus('connect_checklist', 'completed')
    }
  }, [allDone, serverDismissed])

  if (dismissed || allDone || items.length === 0) return null

  function dismiss() {
    setDismissedNow(true)
    window.localStorage.setItem(STORAGE_KEY, '1')
    markTourStatus('connect_checklist', 'skipped')
  }

  return (
    <div
      data-tour="connect-checklist"
      className="rounded-2xl border bg-card card-shadow overflow-hidden"
    >
      <div className="flex items-start justify-between gap-4 px-5 pt-5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
            <Plug className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[14px] font-semibold leading-tight">Get your data flowing</p>
            <p className="text-[12.5px] text-muted-foreground mt-1 max-w-xl leading-relaxed">
              BrandGauge fills itself in from the sources you connect. Start with these and your
              scores, sentiment and reports build themselves.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground rounded-full border border-border px-2.5 py-1">
            {doneCount} of {items.length} done
          </span>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Hide this checklist"
            className="text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 divide-y divide-border/40 border-t border-border/40">
        {items.map(item => (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              'flex items-center gap-3.5 px-5 py-3 transition-colors group',
              item.done ? 'opacity-60' : 'hover:bg-muted/30',
            )}
          >
            <span
              className={cn(
                'h-5 w-5 rounded-full flex items-center justify-center shrink-0 border',
                item.done
                  ? 'bg-green-500 border-green-500'
                  : 'border-border bg-background',
              )}
            >
              {item.done && <Check className="h-3 w-3 text-white" />}
            </span>
            <span className="flex-1 min-w-0">
              <span className={cn('block text-[13px] font-medium truncate', item.done && 'line-through decoration-muted-foreground/40')}>
                {item.label}
              </span>
              <span className="block text-[11.5px] text-muted-foreground truncate mt-0.5">
                {item.description}
              </span>
            </span>
            {item.done ? (
              <span className="text-[11px] font-medium text-green-600 shrink-0">Connected</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
                Set up
                <ArrowRight className="h-3 w-3" />
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
