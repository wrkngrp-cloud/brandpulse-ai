'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshIcon as RefreshCw, ConfirmedIcon as CheckCircle2, SearchIcon as SearchX } from '@/components/brand/icon'
import { AlertIcon as AlertCircle } from '@/components/brand/icon'
import { Crescendo } from '@/components/brand/crescendo'

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
            <RefreshCw className="h-3 w-3" />
            {label}
          </span>
          <span>{state.progress}%</span>
        </div>
        <Crescendo value={state.progress} height={6} />
      </div>
    )
  }

  if (state.phase === 'done') {
    const platformList = state.sources.length
      ? state.sources.map(s => s === 'twitter' ? 'X' : 'Instagram').join(' and ')
      : null
    const FRIENDLY: Record<string, string> = {
      X_CREDITS_DEPLETED: 'X free-tier credits exhausted for this month. Resets on the 1st. Instagram mentions are still collecting.',
    }
    const errors = Object.entries(state.platformErrors)
      .map(([p, msg]) => {
        const friendly = FRIENDLY[msg]
        return friendly ?? `${p === 'twitter' ? 'X' : 'Instagram'}: ${msg}`
      })

    if (state.mentionsFound === 0) {
      return (
        <div className="space-y-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <SearchX className="h-4 w-4" />
            {state.sources.length === 0
              ? 'No social accounts connected yet.'
              : `No new mentions found on ${platformList} in the last 24 hours.`}
          </div>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto bg-num">
            {state.sources.length === 0
              ? 'Connect your X or Instagram account in Settings to start collecting mentions.'
              : 'Nobody @mentioned your account today, or the crawl already ran recently.'}
          </p>
          {errors.length > 0 && (
            <div className="text-left max-w-xs mx-auto space-y-1">
              {errors.map((e, i) => (
                <p key={i} className="text-[11px] text-tx-flare bg-flare-wash border border-line-strong rounded px-2 py-1 bg-num break-all">{e}</p>
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
        <div className="flex items-center gap-1.5 text-sm text-pos">
          <CheckCircle2 className="h-4 w-4" />
          {state.mentionsFound} mention{state.mentionsFound !== 1 ? 's' : ''} found{platformList ? ` from ${platformList}` : ''} and classified.
        </div>
        {errors.length > 0 && (
          <div className="w-full max-w-xs space-y-1">
            {errors.map((e, i) => (
              <p key={i} className="text-[11px] text-tx-flare bg-flare-wash border border-line-strong rounded px-2 py-1 bg-num break-all">{e}</p>
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
        <div className="flex items-center gap-1.5 text-sm text-tx-flare">
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
