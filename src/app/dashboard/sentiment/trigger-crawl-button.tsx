'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, CheckCircle2, AlertCircle, SearchX } from 'lucide-react'

type RunState =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'running'; runId: string; progress: number; elapsed: number }
  | { phase: 'done'; mentionsFound: number }
  | { phase: 'error'; message: string }

interface Props {
  hasRanBefore?: boolean
}

const POLL_INTERVAL   = 3000   // ms
const PROGRESS_TARGET = 90     // fill to 90 % while running, snap to 100 on done
const FILL_DURATION   = 60000  // ms to reach 90 %

export function TriggerCrawlButton({ hasRanBefore = false }: Props) {
  const [run, setRun] = useState<RunState>({ phase: 'idle' })
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef<number>(0)

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  async function pollStatus(runId: string) {
    try {
      const res = await fetch(`/api/crawl/runs/${runId}`)
      if (!res.ok) return
      const data = await res.json() as {
        status: string; mentions_found: number; error_message?: string
      }

      if (data.status === 'done') {
        stopPolling()
        setRun({ phase: 'done', mentionsFound: data.mentions_found })
      } else if (data.status === 'error') {
        stopPolling()
        setRun({ phase: 'error', message: data.error_message ?? 'Crawl failed' })
      } else {
        // Still running — update progress bar
        const elapsed  = Date.now() - startRef.current
        const progress = Math.min(PROGRESS_TARGET, (elapsed / FILL_DURATION) * PROGRESS_TARGET)
        setRun(prev =>
          prev.phase === 'running'
            ? { ...prev, progress: Math.round(progress), elapsed }
            : prev
        )
      }
    } catch {
      // Network glitch — keep polling
    }
  }

  async function trigger() {
    setRun({ phase: 'starting' })
    try {
      const res = await fetch('/api/inngest/trigger', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        setRun({ phase: 'error', message: body.error ?? 'Failed to start crawl' })
        return
      }
      const { runId } = await res.json() as { runId: string }
      startRef.current = Date.now()
      setRun({ phase: 'running', runId, progress: 2, elapsed: 0 })

      pollRef.current = setInterval(() => pollStatus(runId), POLL_INTERVAL)

      // Hard timeout — stop polling after 3 minutes regardless
      setTimeout(() => {
        if (pollRef.current) {
          stopPolling()
          setRun(prev =>
            prev.phase === 'running'
              ? { phase: 'error', message: 'Timed out — check Inngest dashboard' }
              : prev
          )
        }
      }, 3 * 60 * 1000)
    } catch {
      setRun({ phase: 'error', message: 'Network error — try again' })
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (run.phase === 'running' || run.phase === 'starting') {
    const progress = run.phase === 'starting' ? 2 : run.progress

    return (
      <div className="space-y-2 w-full max-w-xs">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <RefreshCw className="h-3 w-3 animate-spin" />
            {run.phase === 'starting'
              ? 'Starting crawl...'
              : run.elapsed < 15000
                ? 'Fetching X mentions...'
                : run.elapsed < 40000
                  ? 'Classifying sentiment...'
                  : 'Aggregating results...'}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-foreground rounded-full transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    )
  }

  if (run.phase === 'done') {
    if (run.mentionsFound === 0) {
      return (
        <div className="space-y-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <SearchX className="h-4 w-4" />
            No mentions found for your brand on X in the last 24 hours.
          </div>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            This could mean no one mentioned you today, or the brand name in your profile
            doesn't match how people tag you on X.
          </p>
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
          {run.mentionsFound} mention{run.mentionsFound !== 1 ? 's' : ''} found — refresh the page to see data.
        </div>
        <Button size="sm" variant="outline" onClick={() => { setRun({ phase: 'idle' }); window.location.reload() }}>
          Refresh page
        </Button>
      </div>
    )
  }

  if (run.phase === 'error') {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-red-500">
          <AlertCircle className="h-4 w-4" />
          {run.message}
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
