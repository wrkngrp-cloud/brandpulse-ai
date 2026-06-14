'use client'

import { useState } from 'react'
import {
  FileText,
  TrendingUp,
  Filter,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExpectedOutcome {
  metric:   string
  target:   string
  timeline: string
}

interface RiskFactor {
  risk:       string
  mitigation: string
}

interface BusinessCaseResult {
  title:                string
  executive_summary:    string
  market_opportunity:   string
  strategic_rationale:  string[]
  proposed_investment:  string
  expected_outcomes:    ExpectedOutcome[]
  risk_factors:         RiskFactor[]
  success_metrics:      string[]
  recommendation:       string
}

interface NextMonthPriority {
  priority:  string
  rationale: string
}

interface MonthlyReportResult {
  month:                 string
  headline_score:        string
  executive_summary:     string
  key_wins:              string[]
  key_concerns:          string[]
  sentiment_narrative:   string
  content_performance:   string
  audience_signals:      string
  next_month_priorities: NextMonthPriority[]
  data_quality:          'High' | 'Medium' | 'Low'
  emailSent?:            boolean
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function SectionToggle({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium bg-muted/40 hover:bg-muted transition-colors text-left"
      >
        {label}
        {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>
      {open && <div className="px-4 py-3 text-sm space-y-2">{children}</div>}
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground/40 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function DataQualityBadge({ quality }: { quality: 'High' | 'Medium' | 'Low' }) {
  const styles: Record<string, string> = {
    High:   'bg-green-50 text-green-700 border-green-200',
    Medium: 'bg-amber-50 text-amber-700 border-amber-200',
    Low:    'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', styles[quality])}>
      {quality} data quality
    </span>
  )
}

// ── Business Case Panel ────────────────────────────────────────────────────────

function BusinessCasePanel() {
  const [open,       setOpen]       = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [result,     setResult]     = useState<BusinessCaseResult | null>(null)
  const [initiative, setInitiative] = useState('')
  const [budget,     setBudget]     = useState('')
  const [timeline,   setTimeline]   = useState('')
  const [objective,  setObjective]  = useState('')

  async function generate() {
    if (!initiative.trim() || initiative.trim().length < 10) {
      setError('Please describe the initiative in at least 10 characters.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/ai/business-case', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ initiative, budget: budget || undefined, timeline: timeline || undefined, objective: objective || undefined }),
      })
      const data = await res.json() as BusinessCaseResult & { error?: string }
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return }
      setResult(data)
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Card header */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <FileText className="h-4.5 w-4.5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Business Case</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generate a board-ready business case for any brand initiative
            </p>
          </div>
          <Button
            size="sm"
            variant={open ? 'secondary' : 'default'}
            className="shrink-0 text-xs h-8"
            onClick={() => { setOpen(o => !o); setResult(null); setError(null) }}
          >
            {open ? 'Close' : 'Start'}
          </Button>
        </div>
      </div>

      {/* Form */}
      {open && !result && (
        <div className="border-t px-4 sm:px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Initiative description <span className="text-red-500">*</span></label>
            <Textarea
              value={initiative}
              onChange={e => setInitiative(e.target.value)}
              placeholder="e.g. Launch a national radio campaign targeting Lagos + Abuja to lift brand awareness by 15pts over 3 months"
              className="text-sm min-h-[80px] resize-none"
              disabled={loading}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Budget <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input
                type="text"
                value={budget}
                onChange={e => setBudget(e.target.value)}
                placeholder="e.g. ₦15M"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Timeline <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input
                type="text"
                value={timeline}
                onChange={e => setTimeline(e.target.value)}
                placeholder="e.g. Q3 2026"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Objective <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input
                type="text"
                value={objective}
                onChange={e => setObjective(e.target.value)}
                placeholder="e.g. Grow awareness"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                disabled={loading}
              />
            </div>
          </div>
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          <Button onClick={generate} disabled={loading || !initiative.trim()} className="w-full sm:w-auto gap-2">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Generating...</> : <><Send className="h-4 w-4" />Generate Business Case</>}
          </Button>
          {loading && (
            <p className="text-xs text-muted-foreground">This uses the most capable model and takes about 30-60 seconds.</p>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="border-t px-4 sm:px-5 py-4 space-y-4">
          {/* Recommendation banner */}
          <div className={cn(
            'flex items-start gap-3 rounded-lg px-4 py-3',
            result.recommendation.toLowerCase().includes('go')
              ? 'bg-green-50 border border-green-200'
              : 'bg-amber-50 border border-amber-200'
          )}>
            <CheckCircle2 className={cn(
              'h-5 w-5 shrink-0 mt-0.5',
              result.recommendation.toLowerCase().includes('go') ? 'text-green-600' : 'text-amber-600'
            )} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Recommendation</p>
              <p className="text-sm font-medium">{result.recommendation}</p>
            </div>
          </div>

          <div>
            <h4 className="text-base font-semibold">{result.title}</h4>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{result.executive_summary}</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Market Opportunity</p>
            <p className="text-sm leading-relaxed">{result.market_opportunity}</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Strategic Rationale</p>
            <BulletList items={result.strategic_rationale} />
          </div>

          {result.proposed_investment && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proposed Investment</p>
              <p className="text-sm leading-relaxed">{result.proposed_investment}</p>
            </div>
          )}

          <SectionToggle label={`Expected Outcomes (${result.expected_outcomes?.length ?? 0})`}>
            <div className="space-y-3">
              {(result.expected_outcomes ?? []).map((o, i) => (
                <div key={i} className="rounded-lg bg-muted/50 px-3 py-2.5">
                  <p className="text-xs font-semibold text-muted-foreground">{o.metric}</p>
                  <p className="font-medium text-sm mt-0.5">{o.target}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{o.timeline}</p>
                </div>
              ))}
            </div>
          </SectionToggle>

          <SectionToggle label={`Risk Factors (${result.risk_factors?.length ?? 0})`}>
            <div className="space-y-3">
              {(result.risk_factors ?? []).map((r, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">{r.risk}</p>
                  </div>
                  <p className="text-xs text-muted-foreground pl-5.5">{r.mitigation}</p>
                </div>
              ))}
            </div>
          </SectionToggle>

          {result.success_metrics?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Success Metrics</p>
              <BulletList items={result.success_metrics} />
            </div>
          )}

          <Button variant="outline" size="sm" onClick={() => { setResult(null); setOpen(true) }} className="text-xs">
            Generate another
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Monthly Report Panel ───────────────────────────────────────────────────────

function MonthlyReportPanel({ userEmail }: { userEmail: string }) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [result,  setResult]  = useState<MonthlyReportResult | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res  = await fetch('/api/ai/monthly-report', { method: 'POST' })
      const data = await res.json() as MonthlyReportResult & { error?: string }
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return }
      setResult(data)
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
            <TrendingUp className="h-4.5 w-4.5 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Monthly Report</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generate your monthly brand performance summary
            </p>
          </div>
          {!result && (
            <Button
              size="sm"
              className="shrink-0 text-xs h-8 gap-1.5"
              onClick={generate}
              disabled={loading}
            >
              {loading
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating...</>
                : <><Sparkles className="h-3.5 w-3.5" />Generate report</>
              }
            </Button>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mt-3">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="border-t px-4 sm:px-5 py-4 space-y-4">
          {/* Headline */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{result.month}</p>
              <p className="font-semibold text-sm mt-0.5">{result.headline_score}</p>
            </div>
            <DataQualityBadge quality={result.data_quality} />
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">{result.executive_summary}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg bg-green-50 border border-green-100 px-4 py-3">
              <p className="text-xs font-semibold text-green-700 mb-2">Key Wins</p>
              <ul className="space-y-1.5">
                {(result.key_wins ?? []).map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-green-900">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
              <p className="text-xs font-semibold text-amber-700 mb-2">Key Concerns</p>
              <ul className="space-y-1.5">
                {(result.key_concerns ?? []).map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-amber-900">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <SectionToggle label="Sentiment narrative">
            <p className="text-sm leading-relaxed text-muted-foreground">{result.sentiment_narrative}</p>
          </SectionToggle>

          <SectionToggle label="Content performance">
            <p className="text-sm leading-relaxed text-muted-foreground">{result.content_performance}</p>
          </SectionToggle>

          <SectionToggle label="Audience signals">
            <p className="text-sm leading-relaxed text-muted-foreground">{result.audience_signals}</p>
          </SectionToggle>

          {(result.next_month_priorities ?? []).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next month priorities</p>
              <div className="space-y-2">
                {result.next_month_priorities.map((p, i) => (
                  <div key={i} className="rounded-lg border px-4 py-3">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold text-muted-foreground shrink-0 mt-0.5">{i + 1}.</span>
                      <div>
                        <p className="text-sm font-medium">{p.priority}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{p.rationale}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.emailSent && userEmail && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              Report sent to {userEmail}
            </div>
          )}

          <Button variant="outline" size="sm" onClick={() => setResult(null)} className="text-xs">
            Generate again
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Funnel Diagnostic Panel ────────────────────────────────────────────────────

function FunnelDiagnosticPanel() {
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
          <Filter className="h-4.5 w-4.5 text-orange-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Funnel Diagnostic</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Deep root-cause analysis of every funnel leak
          </p>
          <p className="text-xs text-muted-foreground mt-3 bg-muted/50 rounded-lg px-3 py-2.5 border">
            Open the Funnel page and click Diagnose to start here.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Exported component ─────────────────────────────────────────────────────────

export function V2Tools({ userEmail }: { userEmail: string }) {
  return (
    <div className="space-y-3 mb-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI Power Tools</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <BusinessCasePanel />
        <MonthlyReportPanel userEmail={userEmail} />
        <FunnelDiagnosticPanel />
      </div>
    </div>
  )
}
