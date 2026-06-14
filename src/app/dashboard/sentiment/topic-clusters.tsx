'use client'

import { useState, useTransition } from 'react'
import { Sparkles, Loader2, MessageSquareQuote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Cluster {
  label:       string
  description: string
  count:       number
  sentiment:   'positive' | 'neutral' | 'negative'
  quotes:      string[]
}

interface Props {
  mentions: string[]   // raw mention content strings
}

const SENTIMENT_DOT: Record<string, string> = {
  positive: 'bg-green-500',
  neutral:  'bg-muted-foreground/40',
  negative: 'bg-red-400',
}

const SENTIMENT_LABEL: Record<string, string> = {
  positive: 'text-green-600',
  neutral:  'text-muted-foreground',
  negative: 'text-red-500',
}

export function TopicClusters({ mentions }: Props) {
  const [clusters, setClusters] = useState<Cluster[] | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAnalyse() {
    startTransition(async () => {
      const res = await fetch('/api/sentiment/clusters', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mentions }),
      })
      const data = await res.json() as { clusters: Cluster[] } | { error: string }
      if ('error' in data) { toast.error(data.error); return }
      setClusters(data.clusters)
    })
  }

  if (mentions.length === 0) {
    return (
      <div className="border rounded-xl p-5 text-center">
        <p className="text-sm text-muted-foreground">No mentions available to cluster.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Topic clusters</p>
          <p className="text-xs text-muted-foreground">AI groups your {mentions.length} recent mentions into themes</p>
        </div>
        {!clusters && (
          <Button size="sm" variant="outline" onClick={handleAnalyse} disabled={isPending}>
            {isPending ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Clustering…</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Analyse topics</>
            )}
          </Button>
        )}
        {clusters && (
          <Button size="sm" variant="ghost" onClick={() => { setClusters(null) }}>
            Reset
          </Button>
        )}
      </div>

      {clusters && (
        <div className="space-y-3">
          {clusters.map((c, i) => (
            <div key={i} className="border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 rounded-full shrink-0', SENTIMENT_DOT[c.sentiment])} />
                  <p className="text-sm font-semibold">{c.label}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn('text-xs font-medium capitalize', SENTIMENT_LABEL[c.sentiment])}>
                    {c.sentiment}
                  </span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{c.count} mentions</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">{c.description}</p>

              {c.quotes.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {c.quotes.map((q, qi) => (
                    <div key={qi} className="flex items-start gap-2 bg-muted/40 rounded-lg px-3 py-2">
                      <MessageSquareQuote className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />
                      <p className="text-xs italic text-muted-foreground leading-relaxed">"{q}"</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
