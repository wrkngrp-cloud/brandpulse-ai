'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'

export function TriggerPrCrawlButton() {
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function trigger() {
    setPhase('running')
    try {
      const res = await fetch('/api/inngest/trigger-pr', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        setMessage(body.error ?? `Server error ${res.status}`)
        setPhase('error')
        return
      }
      setMessage('Crawl started. New mentions will appear in a few minutes.')
      setPhase('done')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Network error')
      setPhase('error')
    }
  }

  if (phase === 'running') {
    return (
      <Button size="sm" variant="outline" disabled>
        <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        Starting crawl…
      </Button>
    )
  }

  if (phase === 'done') {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-600">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {message}
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-rose-500 flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" />{message}
        </span>
        <Button size="sm" variant="outline" onClick={trigger}>Retry</Button>
      </div>
    )
  }

  return (
    <Button size="sm" variant="outline" onClick={trigger}>
      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
      Run crawl now
    </Button>
  )
}
