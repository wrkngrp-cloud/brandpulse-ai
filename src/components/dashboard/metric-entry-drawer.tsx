'use client'

import { useState, useTransition }  from 'react'
import { X, ChevronDown, Loader2, CheckCircle2, Plus } from 'lucide-react'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'
import { cn }       from '@/lib/utils'
import { KEY_METRICS_BY_INDUSTRY, type IndustryId } from '@/lib/industry-config'
import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'

interface Props {
  industry:  string | null
  onClose:   () => void
  onSaved?:  () => void
}

export function MetricEntryDrawer({ industry, onClose, onSaved }: Props) {
  const ind      = (industry ?? 'other') as IndustryId
  const metrics  = KEY_METRICS_BY_INDUSTRY[ind] ?? KEY_METRICS_BY_INDUSTRY['other']

  const today    = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const lastDay  = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]

  const [values, setValues]    = useState<Record<string, string>>({})
  const [saved, setSaved]      = useState<Record<string, boolean>>({})
  const [isPending, start]     = useTransition()
  const [mounted, setMounted]  = useState(false)
  const drawerRef              = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  async function saveMetric(metricKey: string, rawValue: string) {
    const value = parseFloat(rawValue.replace(/,/g, ''))
    if (isNaN(value)) return

    const res = await fetch('/api/dashboard/metrics', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ metric_key: metricKey, value, period_start: firstDay, period_end: lastDay }),
    })
    if (res.ok) {
      setSaved(s => ({ ...s, [metricKey]: true }))
      setTimeout(() => setSaved(s => ({ ...s, [metricKey]: false })), 2000)
      onSaved?.()
    }
  }

  function saveAll() {
    start(async () => {
      for (const [key, val] of Object.entries(values)) {
        if (val) await saveMetric(key, val)
      }
    })
  }

  if (!mounted) return null

  const drawer = (
    <>
      <div className="fixed inset-0 z-[9990] bg-foreground/20 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={drawerRef}
        className="fixed inset-y-0 right-0 z-[9991] w-full max-w-sm bg-card border-l shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="text-sm font-semibold">Enter marketing data</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {today.toLocaleString('en-NG', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            No connector needed. Enter your numbers manually and BrandPulse will compute your ROI metrics.
            Confidence shows as "Manual input" until a connector upgrades it automatically.
          </p>

          {metrics.map(m => (
            <div key={m.metricKey} className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-2">
                {m.label}
                {saved[m.metricKey] && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
              </Label>
              <p className="text-xs text-muted-foreground">{m.description}</p>
              <div className="flex gap-2">
                <Input
                  value={values[m.metricKey] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [m.metricKey]: e.target.value }))}
                  placeholder={m.metricKey.includes('rate') || m.metricKey.includes('pct') ? '0.0' : '0'}
                  className="text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => saveMetric(m.metricKey, values[m.metricKey] ?? '')}
                  disabled={!values[m.metricKey]}
                >
                  Save
                </Button>
              </div>
            </div>
          ))}

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-3">
              Want to add a metric not listed? Connect a data source in{' '}
              <a href="/dashboard/connectors" className="underline hover:text-foreground">Connectors</a>.
            </p>
          </div>
        </div>

        <div className="p-4 border-t">
          <Button className="w-full" onClick={saveAll} disabled={isPending || Object.keys(values).length === 0}>
            {isPending
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              : 'Save all'
            }
          </Button>
        </div>
      </div>
    </>
  )

  return createPortal(drawer, document.body)
}
