'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import { History, RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react'

interface CrawlRun {
  id: string
  trigger_type: string
  status: string
  mentions_found: number
  classified: number
  started_at: string
  completed_at: string | null
  error_message: string | null
}

function duration(start: string, end: string | null) {
  if (!end) return '—'
  const secs = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'done') return (
    <span className="inline-flex items-center gap-1 text-xs text-green-600">
      <CheckCircle2 className="h-3 w-3" /> Done
    </span>
  )
  if (status === 'error') return (
    <span className="inline-flex items-center gap-1 text-xs text-red-500">
      <AlertCircle className="h-3 w-3" /> Error
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-500">
      <Clock className="h-3 w-3" /> Running
    </span>
  )
}

export function CrawlHistory() {
  const [runs, setRuns] = useState<CrawlRun[] | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/crawl/runs')
      if (res.ok) setRuns(await res.json())
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet onOpenChange={open => { if (open) load() }}>
      <SheetTrigger>
        <Button size="sm" variant="outline">
          <History className="h-3.5 w-3.5 mr-1.5" />
          Crawl history
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Crawl history</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {loading && !runs && (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          {!loading && runs?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No crawl runs yet.
            </p>
          )}

          {runs && runs.length > 0 && (
            <div className="border rounded-xl overflow-hidden divide-y">
              {runs.map(run => (
                <div key={run.id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={run.status} />
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        run.trigger_type === 'manual'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {run.trigger_type === 'manual' ? 'Manual' : 'Scheduled'}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(run.started_at).toLocaleString('en-NG', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{run.mentions_found} mention{run.mentions_found !== 1 ? 's' : ''}</span>
                    <span>{run.classified} classified</span>
                    <span>{duration(run.started_at, run.completed_at)}</span>
                  </div>

                  {run.error_message && (
                    <p className="text-xs text-red-500 truncate">{run.error_message}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
