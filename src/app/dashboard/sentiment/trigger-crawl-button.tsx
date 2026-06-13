'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, CheckCircle2, AlertCircle, SearchX } from 'lucide-react'

type State =
  | { phase: 'idle' }
  | { phase: 'running'; progress: number }
  | { phase: 'done'; mentionsFound: number; sources: string[]; platformErrors: Record<string, string> }
  | { phase: 'error'; message: string }

interface Props {
  hasRanBefore?: boolean
}

export function TriggerCrawlButton({ hasRanBefore = false }: Props) {
  const [state, setState] = useState<State>({ phase: 'idle' })

  async function trigger() {
    setState({ phase: 'running', progress: 5 })

    // Animate progress while the request is in flight
    const timer = setInterval(() => {
      setState(prev =>
        prev.phase === 'running'
          ? { ...prev, progress: Math.min(90, prev.progress + 3) }
          : prev
      )
    }, 1500)

    try {
      const res = await fetch('/api/crawl/run', { method: 'POST' })
      clearInterval(timer)

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        setState({ phase: 'error', message: body.error ?? `Server error ${res.status}` })
        return
      }

      const data = await res.json() as { mentionsFound: number; sources?: string[]; platformErrors?: Record<string, string> }
      setState({ phase: 'done', mentionsFound: data.mentionsFound, sources: data.sources ?? [], platformErrors: data.platformErrors ?? {} })
    } catch (err) {
      clearInterval(timer)
      setState({ phase: 'error', message: err instanceof Error ? err.message : 'Network error' })
    }
  }

  if (state.phase === 'running') {
    const label =
      state.progress < 30 ? 'Fetching mentions...' :
      state.progress < 65 ? 'Classifying sentiment...' :
      'Aggregating results...'

    return (
      <div className="space-y-2 w-full max-w-xs">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <RefreshCw className="h-3 w-3 animate-spin" />
            {label}
          </span>
          <span>{state.progress}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-foreground rounded-full transition-all duration-1000"
            style={{ width: `${state.progress}%` }}
          />
        </div>
      </div>
    )
  }

  if (state.phase === 'done') {
    const platformList = state.sources.length
      ? state.sources.map(s => s === 'twitter' ? 'X' : 'Instagram').join(' and ')
      : null
    const errors = Object.entries(state.platformErrors)
      .map(([p, msg]) => `${p === 'twitter' ? 'X' : 'Instagram'}: ${msg}`)

    if (state.mentionsFound === 0) {
      return (
        <div className="space-y-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <SearchX className="h-4 w-4" />
            {state.sources.length === 0
              ? 'No social accounts connected yet.'
              : `No new mentions found on ${platformList} in the last 24 hours.`}
          </div>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            {state.sources.length === 0
              ? 'Connect your X or Instagram account in Settings to start collecting mentions.'
              : 'Nobody @mentioned your account today, or the crawl already ran recently.'}
          </p>
          {errors.length > 0 && (
            <div className="text-left max-w-xs mx-auto space-y-1">
              {errors.map((e, i) => (
                <p key={i} className="text-[11px] text-red-500 bg-red-50 border border-red-200 rounded px-2 py-1 font-mono break-all">{e}</p>
              ))}
            </div>
          )}
          <Button size="sm" variant="outline" onClick={trigger}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Crawl again
          </Button>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          {state.mentionsFound} mention{state.mentionsFound !== 1 ? 's' : ''} found{platformList ? ` from ${platformList}` : ''} and classified.
        </div>
        {errors.length > 0 && (
          <div className="w-full max-w-xs space-y-1">
            {errors.map((e, i) => (
              <p key={i} className="text-[11px] text-red-500 bg-red-50 border border-red-200 rounded px-2 py-1 font-mono break-all">{e}</p>
            ))}
          </div>
        )}
        <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
          Refresh page to see data
        </Button>
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-red-500">
          <AlertCircle className="h-4 w-4" />
          {state.message}
        </div>
        <Button size="sm" variant="outline" onClick={trigger}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try again
        </Button>
      </div>
    )
  }

  return (
    <Button size="sm" onClick={trigger}>
      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
      {hasRanBefore ? 'Crawl again' : 'Run crawl now'}
    </Button>
  )
}
