'use client'

import { useState } from 'react'
import { Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface RadioAiAnalysisProps {
  days:      number
  brandName: string
  hasData:   boolean
}

function renderAnalysis(text: string) {
  const sections = text.split(/^## /m).filter(Boolean)
  return sections.map((section, i) => {
    const [heading, ...rest] = section.split('\n')
    const body = rest.join('\n').trim()
    return (
      <div key={i} className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{heading.trim()}</p>
        <p className="text-sm leading-relaxed">{body}</p>
      </div>
    )
  })
}

export function RadioAiAnalysis({ days, brandName, hasData }: RadioAiAnalysisProps) {
  const [analysis, setAnalysis]   = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  async function handleAnalyse() {
    if (!hasData) {
      toast.error('Upload a radio schedule first to run AI analysis.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/radio/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days, brandName }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Analysis failed')
        return
      }
      setAnalysis(data.analysis)
      setCollapsed(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleAnalyse}
        disabled={loading || !hasData}
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          'gap-2',
          !hasData && 'opacity-40 cursor-not-allowed',
        )}
      >
        {loading
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <Sparkles className="h-3.5 w-3.5 text-violet-500" />
        }
        {loading ? 'Analysing…' : 'Analyse with AI'}
      </button>

      {analysis && (
        <Card className="border rounded-xl p-5 bg-card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <span className="text-sm font-semibold">AI Radio Analysis</span>
            </div>
            <button
              onClick={() => setCollapsed(c => !c)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {collapsed
                ? <ChevronDown className="h-4 w-4" />
                : <ChevronUp className="h-4 w-4" />
              }
            </button>
          </div>

          {!collapsed && (
            <div className="space-y-4 divide-y divide-border/40">
              <div className="space-y-4">
                {renderAnalysis(analysis)}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleAnalyse}
              disabled={loading}
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-xs gap-1.5')}
            >
              <Sparkles className="h-3 w-3" />
              Refresh
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}
