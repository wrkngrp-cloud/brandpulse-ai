'use client'

import { useEffect, useState, useCallback } from 'react'
import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TourSpotlight } from '@/components/tours/tour-spotlight'
import { getTourStatuses, markTourStatus } from '@/app/dashboard/tours/actions'
import { TOUR_DEFINITIONS } from '@/lib/tour-definitions'

type Props = {
  module:      string
  autoStart?:  boolean
}

export function TourTrigger({ module, autoStart = false }: Props) {
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
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
        onClick={() => setActive(true)}
        aria-label={`Show ${module} tour`}
      >
        <HelpCircle className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Show me around</span>
      </Button>

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
