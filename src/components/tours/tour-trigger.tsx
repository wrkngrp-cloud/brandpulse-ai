'use client'

import { useEffect, useState, useCallback } from 'react'
import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TourSpotlight } from '@/components/tours/tour-spotlight'
import { getTourStatuses, markTourStatus } from '@/app/dashboard/tours/actions'
import { TOUR_DEFINITIONS } from '@/lib/tour-definitions'

type Props = {
  module:      string
  autoStart?:  boolean
  /** 'icon' renders a compact circular icon button (topbar), 'default' the labelled pill (in-page). */
  variant?:    'default' | 'icon'
  className?:  string
}

export function TourTrigger({ module, autoStart = false, variant = 'default', className }: Props) {
  const [active,  setActive]  = useState(false)
  const [checked, setChecked] = useState(false)

  const steps = TOUR_DEFINITIONS[module] ?? []

  // Fetch tour status on mount
  useEffect(() => {
    if (!steps.length) { setChecked(true); return }

    getTourStatuses([module]).then(statuses => {
      const status = statuses[module]
      const isUnseen = !status || status === 'unseen'

      if (isUnseen && autoStart) {
        const timer = setTimeout(() => setActive(true), 1500)
        return () => clearTimeout(timer)
      }
      setChecked(true)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module, autoStart])

  const handleComplete = useCallback(
    async (status: 'completed' | 'skipped') => {
      setActive(false)
      setChecked(true)
      await markTourStatus(module, status)
    },
    [module],
  )

  if (!steps.length) return null

  return (
    <>
      {variant === 'icon' ? (
        <button
          onClick={() => setActive(true)}
          className={cn(
            'h-9 w-9 shrink-0 grid place-items-center rounded-xl cursor-pointer',
            'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            'transition-colors duration-150',
            className,
          )}
          aria-label="Show me around this page"
        >
          <HelpCircle className="h-[17px] w-[17px]" />
        </button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-8 gap-1.5 text-[12px] text-muted-foreground hover:text-foreground', className)}
          onClick={() => setActive(true)}
          aria-label={`Show ${module} tour`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Show me around</span>
        </Button>
      )}

      {active && (
        <TourSpotlight
          module={module}
          steps={steps}
          onComplete={handleComplete}
        />
      )}
    </>
  )
}
