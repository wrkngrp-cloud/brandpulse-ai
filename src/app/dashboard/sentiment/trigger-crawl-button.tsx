'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, CheckCircle2 } from 'lucide-react'

export function TriggerCrawlButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function trigger() {
    setState('loading')
    try {
      const res = await fetch('/api/inngest/trigger', { method: 'POST' })
      if (!res.ok) throw new Error('Request failed')
      setState('done')
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  if (state === 'done') {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <CheckCircle2 className="h-4 w-4" />
        Crawl started — check back in a minute.
      </div>
    )
  }

  return (
    <Button
      size="sm"
      onClick={trigger}
      disabled={state === 'loading'}
    >
      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${state === 'loading' ? 'animate-spin' : ''}`} />
      {state === 'error' ? 'Failed — try again' : state === 'loading' ? 'Starting...' : 'Run crawl now'}
    </Button>
  )
}
