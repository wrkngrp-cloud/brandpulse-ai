'use client'

import { useState } from 'react'
import { Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AnalysisResult {
  headline: string
  nps_interpretation: string
  promoter_insight: string
  detractor_risk: string
  awareness_insight: string
  recommendations: string[]
  confidence: 'High' | 'Medium' | 'Low'
}

const CONFIDENCE_COLOUR: Record<string, string> = {
  High:   'bg-green-100 text-green-800',
  Medium: 'bg-amber-100 text-amber-800',
  Low:    'bg-muted text-muted-foreground',
}

function InsightRow({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border-b last:border-0 py-3">
      <button
        className="w-full flex items-center justify-between text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && <p className="text-sm leading-relaxed mt-1.5">{text}</p>}
    </div>
  )
}

export function SurveyAiAnalysis({ surveyId, responseCount }: { surveyId: string; responseCount: number }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<AnalysisResult | null>(null)
  const [error, setError]     = useState<string | null>(null)

  async function generate() {
    if (loading || responseCount === 0) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/survey-analysis', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ surveyId }),
      })
      const data = await res.json() as AnalysisResult & { error?: string }
      if (!res.ok) { setError(data.error ?? 'Analysis failed'); return }
      setResult(data)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (responseCount === 0) return null

  return (
    <div className="border rounded-xl p-5 bg-card space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          <p className="text-sm font-medium">AI analysis</p>
        </div>
        {!result && (
          <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
            {loading
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Analysing...</>
              : <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Generate</>}
          </Button>
        )}
        {result && (
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', CONFIDENCE_COLOUR[result.confidence])}>
            {result.confidence} confidence
          </span>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading && !result && (
        <div className="py-6 text-center space-y-2">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-xs text-muted-foreground animate-pulse">Reading your survey data and generating insights...</p>
        </div>
      )}

      {result && (
        <div className="space-y-1">
          {/* Headline */}
          <div className="bg-muted rounded-xl px-4 py-3">
            <p className="text-sm font-medium leading-relaxed">{result.headline}</p>
          </div>

          {/* Insight rows */}
          <InsightRow label="NPS interpretation" text={result.nps_interpretation} />
          <InsightRow label="What's driving promoters" text={result.promoter_insight} />
          <InsightRow label="Detractor risk" text={result.detractor_risk} />
          <InsightRow label="Awareness channels" text={result.awareness_insight} />

          {/* Recommendations */}
          {result.recommendations?.length > 0 && (
            <div className="pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Recommendations</p>
              <ul className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="flex gap-2.5 text-sm">
                    <span className="shrink-0 h-5 w-5 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button onClick={() => setResult(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Regenerate
            </button>
          </div>
        </div>
      )}

      {!result && !loading && !error && (
        <p className="text-xs text-muted-foreground">
          Get an AI-powered breakdown of NPS distribution, top awareness channels, promoter drivers, and actionable recommendations — all in plain English.
        </p>
      )}
    </div>
  )
}
