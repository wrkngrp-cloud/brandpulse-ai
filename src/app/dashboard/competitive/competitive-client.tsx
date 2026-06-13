'use client'

import { useState } from 'react'
import { Trophy, Loader2, RefreshCw, ChevronDown, ChevronUp, TrendingUp, TrendingDown, AlertCircle, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Recommendation {
  action: string
  rationale: string
  priority: 'High' | 'Medium' | 'Low'
}

interface BriefingResult {
  title: string
  executive_summary: string
  sov_analysis: string
  sentiment_vs_market: string
  brand_strengths: string[]
  brand_vulnerabilities: string[]
  competitor_threats: string[]
  opportunities: string[]
  recommendations: Recommendation[]
  data_gaps: string[]
  confidence: 'High' | 'Medium' | 'Low'
}

const PRIORITY_STYLE: Record<string, string> = {
  High:   'bg-red-100 text-red-800',
  Medium: 'bg-amber-100 text-amber-800',
  Low:    'bg-muted text-muted-foreground',
}

const CONFIDENCE_STYLE: Record<string, string> = {
  High:   'bg-green-100 text-green-800',
  Medium: 'bg-amber-100 text-amber-800',
  Low:    'bg-muted text-muted-foreground',
}

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5 pt-1">{children}</div>}
    </div>
  )
}

function StringList({ items, icon: Icon, iconClass }: { items: string[]; icon?: React.ElementType; iconClass?: string }) {
  if (!items?.length) return <p className="text-sm text-muted-foreground">No data.</p>
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
          {Icon
            ? <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', iconClass ?? 'text-muted-foreground')} />
            : <span className="shrink-0 h-5 w-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
          }
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

interface Props {
  hasSovData: boolean
  brandName: string
  competitorNames: string[]
}

export function CompetitiveClient({ hasSovData, brandName, competitorNames }: Props) {
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<BriefingResult | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/competitive-briefing', { method: 'POST' })
      const data = await res.json() as BriefingResult & { error?: string }
      if (!res.ok) { setError(data.error ?? 'Generation failed'); return }
      setResult(data)
      setGenerated(true)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Context banner */}
      {!generated && (
        <div className="border rounded-xl p-5 bg-card space-y-4">
          <div className="flex items-start gap-3">
            <Trophy className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">What this briefing covers</p>
              <p className="text-sm text-muted-foreground">
                An AI-generated competitive intelligence report using your live brand data — share of voice, sentiment trends, recent social signals, and your tracked competitors.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="border rounded-lg p-3 space-y-0.5">
              <p className="text-xs text-muted-foreground">Brand</p>
              <p className="font-medium">{brandName}</p>
            </div>
            <div className="border rounded-lg p-3 space-y-0.5">
              <p className="text-xs text-muted-foreground">Competitors tracked</p>
              <p className="font-medium">{competitorNames.length > 0 ? competitorNames.join(', ') : 'None yet'}</p>
            </div>
            <div className="border rounded-lg p-3 space-y-0.5">
              <p className="text-xs text-muted-foreground">SOV data</p>
              <p className={cn('font-medium', hasSovData ? 'text-green-600' : 'text-muted-foreground')}>
                {hasSovData ? 'Available' : 'Not yet — run a crawl first'}
              </p>
            </div>
            <div className="border rounded-lg p-3 space-y-0.5">
              <p className="text-xs text-muted-foreground">Model</p>
              <p className="font-medium">Llama 4 Maverick (structural)</p>
            </div>
          </div>

          {competitorNames.length === 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">
                Add competitors in Settings to get a richer briefing with named competitive comparisons.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={generate} disabled={loading} className="w-full">
            {loading
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating briefing...</>
              : <><Trophy className="h-4 w-4 mr-2" /> Generate competitive briefing</>
            }
          </Button>

          {loading && (
            <p className="text-center text-xs text-muted-foreground animate-pulse">
              Analysing share of voice, sentiment trends, and social signals...
            </p>
          )}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">{result.title}</h2>
              <span className={cn('inline-flex text-xs px-2 py-0.5 rounded-full font-medium', CONFIDENCE_STYLE[result.confidence])}>
                {result.confidence} confidence
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          </div>

          {/* Executive summary */}
          <div className="border rounded-xl bg-muted/40 px-5 py-4">
            <p className="text-sm leading-relaxed">{result.executive_summary}</p>
          </div>

          {/* SOV analysis */}
          <Section title="Share of voice" icon={Trophy}>
            <p className="text-sm leading-relaxed">{result.sov_analysis}</p>
          </Section>

          {/* Sentiment vs market */}
          <Section title="Sentiment vs market" icon={TrendingUp}>
            <p className="text-sm leading-relaxed">{result.sentiment_vs_market}</p>
          </Section>

          {/* Strengths + Vulnerabilities */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Section title="Brand strengths" icon={TrendingUp} defaultOpen={true}>
              <StringList items={result.brand_strengths} icon={TrendingUp} iconClass="text-green-500" />
            </Section>
            <Section title="Vulnerabilities" icon={TrendingDown} defaultOpen={true}>
              <StringList items={result.brand_vulnerabilities} icon={TrendingDown} iconClass="text-red-400" />
            </Section>
          </div>

          {/* Competitor threats */}
          <Section title="Competitor threats" icon={AlertCircle}>
            <StringList items={result.competitor_threats} />
          </Section>

          {/* Opportunities */}
          <Section title="Opportunities" icon={Lightbulb}>
            <StringList items={result.opportunities} />
          </Section>

          {/* Recommendations */}
          <Section title="Recommendations" icon={Trophy}>
            {result.recommendations?.length > 0 ? (
              <div className="space-y-3">
                {result.recommendations.map((rec, i) => (
                  <div key={i} className="border rounded-xl p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium leading-snug">{rec.action}</p>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', PRIORITY_STYLE[rec.priority])}>
                        {rec.priority}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{rec.rationale}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recommendations generated.</p>
            )}
          </Section>

          {/* Data gaps */}
          {result.data_gaps?.length > 0 && (
            <Section title="Data gaps" icon={AlertCircle} defaultOpen={false}>
              <p className="text-xs text-muted-foreground mb-3">Collect this data to make the next briefing more accurate.</p>
              <StringList items={result.data_gaps} />
            </Section>
          )}
        </div>
      )}
    </div>
  )
}
