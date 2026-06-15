'use client'

import { useState, useTransition } from 'react'
import { Sparkles, RefreshCw }      from 'lucide-react'
import { toast }                    from 'sonner'
import { Button }                   from '@/components/ui/button'

interface CampaignAiSummaryProps {
  campaignId:     string
  initialSummary: string | null
}

export function CampaignAiSummary({ campaignId, initialSummary }: CampaignAiSummaryProps) {
  const [summary, setSummary]      = useState<string | null>(initialSummary)
  const [pending, startTransition] = useTransition()

  function analyse() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/analyse`, { method: 'POST' })
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({}))
          throw new Error(error ?? 'Analysis failed')
        }
        const { summary: next } = await res.json()
        setSummary(next)
        toast.success('Campaign analysis updated.')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Analysis failed')
      }
    })
  }

  return (
    <div className="border rounded-xl p-5 bg-card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">AI campaign summary</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5"
          onClick={analyse}
          disabled={pending}
        >
          <RefreshCw className={`h-3 w-3 ${pending ? 'animate-spin' : ''}`} />
          {pending ? 'Analysing…' : summary ? 'Re-analyse' : 'Analyse campaign'}
        </Button>
      </div>

      {pending ? (
        <div className="space-y-2 pt-1">
          <div className="h-3 bg-muted animate-pulse rounded w-full" />
          <div className="h-3 bg-muted animate-pulse rounded w-4/5" />
          <div className="h-3 bg-muted animate-pulse rounded w-3/5" />
        </div>
      ) : summary ? (
        <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Click &ldquo;Analyse campaign&rdquo; to generate an AI performance narrative using your OOH site data, events, and campaign metrics.
        </p>
      )}
    </div>
  )
}
