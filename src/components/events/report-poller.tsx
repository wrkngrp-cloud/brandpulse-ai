'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, Loader2 } from 'lucide-react'

const STEPS = [
  { label: 'Aggregating interactions',   threshold: 15  },
  { label: 'Computing ROI metrics',       threshold: 35  },
  { label: 'Analysing ambassador data',   threshold: 55  },
  { label: 'Generating AI narrative',     threshold: 75  },
  { label: 'Finalising report',           threshold: 95  },
]

export function ReportPoller({ eventId }: { eventId: string }) {
  const router   = useRouter()
  const [progress, setProgress] = useState(0)
  const [ready,    setReady   ] = useState(false)

  useEffect(() => {
    const storageKey = `bp_report_start_${eventId}`

    // Restore or initialise the start timestamp
    let startMs = parseInt(localStorage.getItem(storageKey) ?? '0', 10)
    if (!startMs) {
      startMs = Date.now()
      localStorage.setItem(storageKey, String(startMs))
    }

    // Jump to the appropriate progress level based on elapsed time
    const elapsedSec = (Date.now() - startMs) / 1000
    setProgress(Math.min(elapsedSec * 1.5, 90))

    // Advance ~1.5% per second, capping at 90% until the report arrives
    const tick = setInterval(() => {
      setProgress(p => Math.min(p + 1.5, 90))
    }, 1000)

    // Poll for the ROI report every 6 seconds
    const poll = setInterval(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('event_roi_reports')
        .select('id')
        .eq('event_id', eventId)
        .maybeSingle()

      if (data) {
        clearInterval(tick)
        clearInterval(poll)
        localStorage.removeItem(storageKey)
        setProgress(100)
        setReady(true)
        setTimeout(() => router.refresh(), 600)
      }
    }, 6000)

    return () => {
      clearInterval(tick)
      clearInterval(poll)
    }
  }, [eventId, router])

  return (
    <div className="border rounded-xl p-6 bg-card space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        {ready
          ? <div className="h-9 w-9 rounded-full bg-foreground/10 flex items-center justify-center shrink-0">
              <Check className="h-4 w-4 text-foreground" />
            </div>
          : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0 mt-0.5" />
        }
        <div>
          <p className="text-sm font-medium">
            {ready ? 'Report ready — loading…' : 'Generating your ROI report'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ready
              ? 'The report is complete.'
              : 'The AI is analysing your event data. Usually takes 30–60 seconds.'}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-foreground rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-2">
        {STEPS.map(s => {
          const done = progress >= s.threshold
          return (
            <div key={s.label} className="flex items-center gap-2.5 text-xs">
              <div className={`h-1.5 w-1.5 rounded-full shrink-0 transition-colors duration-700 ${done ? 'bg-foreground' : 'bg-muted-foreground/25'}`} />
              <span className={done ? 'text-foreground' : 'text-muted-foreground'}>{s.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
