'use client'

import { useState } from 'react'
import {
  FileText,
  TrendingUp,
  Filter,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Send,
  Printer,
  Copy,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExpectedOutcome { metric: string; target: string; timeline: string }
interface RiskFactor      { risk: string; mitigation: string }

interface FinancialReturn {
  marketing_roi_estimate: string
  payback_period:         string
  clv_cac_implication:    string
  mer_impact:             string
}

interface ScenarioAnalysis { base: string; bull: string; bear: string }

interface AakerEquityOutcomes {
  loyalty:            string
  awareness:          string
  perceived_quality:  string
  associations:       string
  proprietary_assets: string
}

interface BusinessCaseResult {
  title:                   string
  executive_summary:       string
  ansoff_quadrant:         string
  ansoff_implication:      string
  market_opportunity:      string
  esov_signal:             string
  financial_return:        FinancialReturn
  scenario_analysis:       ScenarioAnalysis
  aaker_equity_outcomes:   AakerEquityOutcomes
  strategic_rationale:     string[]
  proposed_investment:     string
  resource_requirements:   string
  expected_outcomes:       ExpectedOutcome[]
  risk_factors:            RiskFactor[]
  decision_gates:          string[]
  success_metrics:         string[]
  alternatives_considered: string
  recommendation:          string
}

interface NextMonthPriority { priority: string; rationale: string }

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

// ── Export helpers ─────────────────────────────────────────────────────────────

function printHtml(title: string, body: string) {
  const w = window.open('', '_blank')
  if (!w) { toast.error('Pop-up blocked. Allow pop-ups for this site to export the PDF.'); return }
  w.document.write(`<!DOCTYPE html>
<html>
<head>
<title>${title}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:760px;margin:40px auto;padding:0 24px;color:#111;line-height:1.65;font-size:13px}
  h1{font-size:1.35rem;font-weight:700;margin:0 0 .5rem}
  h2{font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:#888;margin:1.75rem 0 .5rem}
  p{margin:.4rem 0}
  ul{padding-left:1.4rem;margin:.4rem 0}
  li{margin-bottom:.35rem}
  .banner{padding:.75rem 1rem;border-radius:6px;margin:1rem 0;border:1px solid}
  .green{background:#f0fdf4;border-color:#bbf7d0;color:#15803d}
  .amber{background:#fffbeb;border-color:#fde68a;color:#92400e}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin:.5rem 0}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.75rem;margin:.5rem 0}
  .card{padding:.65rem .85rem;border:1px solid #e5e7eb;border-radius:6px}
  .label{font-size:.6rem;text-transform:uppercase;letter-spacing:.06em;color:#888;display:block;margin-bottom:.2rem}
  .wins{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:.65rem .85rem}
  .concerns{background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:.65rem .85rem}
  table{width:100%;border-collapse:collapse;margin:.5rem 0}
  th{text-align:left;font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:#888;border-bottom:1px solid #e5e7eb;padding:.4rem .5rem}
  td{padding:.45rem .5rem;border-bottom:1px solid #f3f4f6;vertical-align:top}
  @media print{body{margin:16px}button{display:none}}
</style>
</head>
<body>
${body}
<script>window.onload=()=>{window.print()}<\/script>
</body>
</html>`)
  w.document.close()
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  } catch {
    toast.error('Copy failed. Try again.')
  }
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{children}</p>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-foreground/30 shrink-0" />
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

function isGoVerdict(rec: string) {
  const lower = rec.toLowerCase()
  return lower.startsWith('go') || lower.includes(': go') || lower.includes(' go')
}

// ── Business Case Tab ──────────────────────────────────────────────────────────

export function BusinessCaseTab() {
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

  function handlePrint() {
    if (!result) return
    const verdictClass = isGoVerdict(result.recommendation) ? 'green' : 'amber'
    const html = `
      <h1>${result.title}</h1>
      <div class="banner ${verdictClass}"><strong>Recommendation:</strong> ${result.recommendation}</div>
      <h2>Executive Summary</h2><p>${result.executive_summary}</p>
      <h2>Strategic Context</h2>
      <div class="grid2">
        <div class="card"><span class="label">Ansoff Quadrant</span><strong>${result.ansoff_quadrant ?? ''}</strong><p>${result.ansoff_implication ?? ''}</p></div>
        <div class="card"><span class="label">ESOV Signal</span><p>${result.esov_signal ?? ''}</p></div>
      </div>
      <h2>Financial Return</h2>
      <div class="grid2">
        <div class="card"><span class="label">Marketing ROI</span><p>${result.financial_return?.marketing_roi_estimate ?? ''}</p></div>
        <div class="card"><span class="label">Payback Period</span><p>${result.financial_return?.payback_period ?? ''}</p></div>
        <div class="card"><span class="label">CLV:CAC</span><p>${result.financial_return?.clv_cac_implication ?? ''}</p></div>
        <div class="card"><span class="label">MER Impact</span><p>${result.financial_return?.mer_impact ?? ''}</p></div>
      </div>
      <h2>Scenario Analysis</h2>
      <div class="grid3">
        <div class="card"><span class="label">Base</span><p>${result.scenario_analysis?.base ?? ''}</p></div>
        <div class="card"><span class="label">Bull</span><p>${result.scenario_analysis?.bull ?? ''}</p></div>
        <div class="card"><span class="label">Bear</span><p>${result.scenario_analysis?.bear ?? ''}</p></div>
      </div>
      <h2>Market Opportunity</h2><p>${result.market_opportunity}</p>
      <h2>Strategic Rationale</h2><ul>${(result.strategic_rationale ?? []).map(r => `<li>${r}</li>`).join('')}</ul>
      <h2>Proposed Investment</h2><p>${result.proposed_investment}</p>
      <h2>Resource Requirements</h2><p>${result.resource_requirements ?? ''}</p>
      <h2>Brand Equity Outcomes (Aaker)</h2>
      <div class="grid2">
        <div class="card"><span class="label">Loyalty</span><p>${result.aaker_equity_outcomes?.loyalty ?? ''}</p></div>
        <div class="card"><span class="label">Awareness</span><p>${result.aaker_equity_outcomes?.awareness ?? ''}</p></div>
        <div class="card"><span class="label">Perceived Quality</span><p>${result.aaker_equity_outcomes?.perceived_quality ?? ''}</p></div>
        <div class="card"><span class="label">Associations</span><p>${result.aaker_equity_outcomes?.associations ?? ''}</p></div>
        <div class="card"><span class="label">Proprietary Assets</span><p>${result.aaker_equity_outcomes?.proprietary_assets ?? ''}</p></div>
      </div>
      <h2>Expected Outcomes</h2>
      <table><tr><th>Metric</th><th>Target</th><th>Timeline</th></tr>${(result.expected_outcomes ?? []).map(o => `<tr><td>${o.metric}</td><td>${o.target}</td><td>${o.timeline}</td></tr>`).join('')}</table>
      <h2>Risk Factors</h2>
      ${(result.risk_factors ?? []).map(r => `<div class="card" style="margin-bottom:.5rem"><strong>${r.risk}</strong><p style="color:#666">${r.mitigation}</p></div>`).join('')}
      <h2>Decision Gates</h2><ul>${(result.decision_gates ?? []).map(g => `<li>${g}</li>`).join('')}</ul>
      <h2>Success Metrics</h2><ul>${(result.success_metrics ?? []).map(m => `<li>${m}</li>`).join('')}</ul>
      <h2>Alternatives Considered</h2><p>${result.alternatives_considered ?? ''}</p>
    `
    printHtml(result.title, html)
  }

  function handleCopy() {
    if (!result) return
    const md = [
      `# ${result.title}`,
      '',
      `**Recommendation:** ${result.recommendation}`,
      '',
      '## Executive Summary',
      result.executive_summary,
      '',
      `## Strategic Context`,
      `**Ansoff Quadrant:** ${result.ansoff_quadrant ?? ''}`,
      result.ansoff_implication ?? '',
      '',
      `**ESOV Signal:** ${result.esov_signal ?? ''}`,
      '',
      '## Financial Return',
      `- Marketing ROI: ${result.financial_return?.marketing_roi_estimate ?? ''}`,
      `- Payback Period: ${result.financial_return?.payback_period ?? ''}`,
      `- CLV:CAC: ${result.financial_return?.clv_cac_implication ?? ''}`,
      `- MER Impact: ${result.financial_return?.mer_impact ?? ''}`,
      '',
      '## Scenario Analysis',
      `**Base:** ${result.scenario_analysis?.base ?? ''}`,
      `**Bull:** ${result.scenario_analysis?.bull ?? ''}`,
      `**Bear:** ${result.scenario_analysis?.bear ?? ''}`,
      '',
      '## Market Opportunity',
      result.market_opportunity,
      '',
      '## Strategic Rationale',
      ...(result.strategic_rationale ?? []).map(r => `- ${r}`),
      '',
      '## Proposed Investment',
      result.proposed_investment,
      '',
      '## Resource Requirements',
      result.resource_requirements ?? '',
      '',
      '## Brand Equity Outcomes',
      `- Loyalty: ${result.aaker_equity_outcomes?.loyalty ?? ''}`,
      `- Awareness: ${result.aaker_equity_outcomes?.awareness ?? ''}`,
      `- Perceived Quality: ${result.aaker_equity_outcomes?.perceived_quality ?? ''}`,
      `- Associations: ${result.aaker_equity_outcomes?.associations ?? ''}`,
      `- Proprietary Assets: ${result.aaker_equity_outcomes?.proprietary_assets ?? ''}`,
      '',
      '## Expected Outcomes',
      ...(result.expected_outcomes ?? []).map(o => `- **${o.metric}**: ${o.target} (${o.timeline})`),
      '',
      '## Risk Factors',
      ...(result.risk_factors ?? []).map(r => `- **${r.risk}**: ${r.mitigation}`),
      '',
      '## Decision Gates',
      ...(result.decision_gates ?? []).map(g => `- ${g}`),
      '',
      '## Success Metrics',
      ...(result.success_metrics ?? []).map(m => `- ${m}`),
      '',
      '## Alternatives Considered',
      result.alternatives_considered ?? '',
    ].join('\n')
    copyText(md)
  }

  if (!result) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold">Marketing Business Case</h2>
          </div>
          <p className="text-sm text-muted-foreground ml-10.5">
            Board-ready investment case applying ESOV, Aaker, Ansoff, and financial return frameworks.
            Takes 30–60 seconds using the most capable model.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5">
              Initiative description <span className="text-red-500">*</span>
            </label>
            <Textarea
              value={initiative}
              onChange={e => setInitiative(e.target.value)}
              placeholder="e.g. Launch a national radio campaign targeting Lagos + Abuja to lift brand awareness by 15pts over 3 months"
              className="text-sm min-h-[100px] resize-none"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Budget', value: budget, set: setBudget, placeholder: 'e.g. ₦15M' },
              { label: 'Timeline', value: timeline, set: setTimeline, placeholder: 'e.g. Q3 2026' },
              { label: 'Objective', value: objective, set: setObjective, placeholder: 'e.g. Grow awareness' },
            ].map(f => (
              <div key={f.label}>
                <label className="block text-xs font-medium mb-1.5">
                  {f.label} <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={f.value}
                  onChange={e => f.set(e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                  disabled={loading}
                />
              </div>
            ))}
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <Button onClick={generate} disabled={loading || !initiative.trim()} className="gap-2">
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" />Generating business case...</>
              : <><Send className="h-4 w-4" />Generate Business Case</>
            }
          </Button>
        </div>
      </div>
    )
  }

  // Result view
  const verdictIsGo = isGoVerdict(result.recommendation)
  return (
    <div className="flex flex-col h-full">
      {/* Sticky header with export actions */}
      <div className="shrink-0 px-6 py-3 border-b bg-background flex items-center justify-between gap-3">
        <p className="text-sm font-semibold truncate">{result.title}</p>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCopy}>
            <Copy className="h-3.5 w-3.5" />Copy
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" />Print / PDF
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setResult(null)}>
            New case
          </Button>
        </div>
      </div>

      {/* Scrollable result */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Recommendation banner */}
          <div className={cn(
            'flex items-start gap-3 rounded-xl px-5 py-4 border',
            verdictIsGo ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
          )}>
            <CheckCircle2 className={cn('h-5 w-5 shrink-0 mt-0.5', verdictIsGo ? 'text-green-600' : 'text-amber-600')} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Recommendation</p>
              <p className="text-sm font-semibold">{result.recommendation}</p>
            </div>
          </div>

          {/* Title + executive summary */}
          <div>
            <h1 className="text-xl font-bold">{result.title}</h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{result.executive_summary}</p>
          </div>

          {/* Strategic context */}
          {(result.ansoff_quadrant || result.esov_signal) && (
            <div className="space-y-2">
              <SectionLabel>Strategic Context</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {result.ansoff_quadrant && (
                  <div className="rounded-xl border bg-card px-4 py-3 space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ansoff Quadrant</p>
                    <p className="text-sm font-semibold">{result.ansoff_quadrant}</p>
                    {result.ansoff_implication && <p className="text-xs text-muted-foreground leading-relaxed">{result.ansoff_implication}</p>}
                  </div>
                )}
                {result.esov_signal && (
                  <div className="rounded-xl border bg-card px-4 py-3 space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">ESOV Signal</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{result.esov_signal}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Financial return */}
          {result.financial_return && (
            <div className="space-y-2">
              <SectionLabel>Financial Return</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Marketing ROI Estimate', value: result.financial_return.marketing_roi_estimate },
                  { label: 'Payback Period',          value: result.financial_return.payback_period },
                  { label: 'CLV:CAC Implication',     value: result.financial_return.clv_cac_implication },
                  { label: 'MER Impact',              value: result.financial_return.mer_impact },
                ].filter(f => f.value).map(f => (
                  <div key={f.label} className="rounded-xl border bg-card px-4 py-3 space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</p>
                    <p className="text-xs leading-relaxed">{f.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scenario analysis */}
          {result.scenario_analysis && (
            <div className="space-y-2">
              <SectionLabel>Scenario Analysis</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Base Case',  value: result.scenario_analysis.base, color: 'border-blue-200 bg-blue-50/40' },
                  { label: 'Bull Case',  value: result.scenario_analysis.bull, color: 'border-green-200 bg-green-50/40' },
                  { label: 'Bear Case',  value: result.scenario_analysis.bear, color: 'border-amber-200 bg-amber-50/40' },
                ].filter(s => s.value).map(s => (
                  <div key={s.label} className={cn('rounded-xl border px-4 py-3 space-y-1', s.color)}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                    <p className="text-xs leading-relaxed">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Market opportunity */}
          <div className="space-y-1.5">
            <SectionLabel>Market Opportunity</SectionLabel>
            <p className="text-sm leading-relaxed">{result.market_opportunity}</p>
          </div>

          {/* Strategic rationale */}
          {(result.strategic_rationale ?? []).length > 0 && (
            <div className="space-y-1.5">
              <SectionLabel>Strategic Rationale</SectionLabel>
              <BulletList items={result.strategic_rationale} />
            </div>
          )}

          {/* Investment + resources */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {result.proposed_investment && (
              <div className="space-y-1.5">
                <SectionLabel>Proposed Investment</SectionLabel>
                <p className="text-sm leading-relaxed">{result.proposed_investment}</p>
              </div>
            )}
            {result.resource_requirements && (
              <div className="space-y-1.5">
                <SectionLabel>Resource Requirements</SectionLabel>
                <p className="text-sm leading-relaxed">{result.resource_requirements}</p>
              </div>
            )}
          </div>

          {/* Aaker brand equity */}
          {result.aaker_equity_outcomes && (
            <div className="space-y-2">
              <SectionLabel>Brand Equity Outcomes (Aaker)</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Loyalty',            value: result.aaker_equity_outcomes.loyalty },
                  { label: 'Awareness',           value: result.aaker_equity_outcomes.awareness },
                  { label: 'Perceived Quality',   value: result.aaker_equity_outcomes.perceived_quality },
                  { label: 'Associations',        value: result.aaker_equity_outcomes.associations },
                  { label: 'Proprietary Assets',  value: result.aaker_equity_outcomes.proprietary_assets },
                ].filter(f => f.value).map(f => (
                  <div key={f.label} className="rounded-xl border bg-card px-4 py-3 space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</p>
                    <p className="text-xs leading-relaxed">{f.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expected outcomes */}
          {(result.expected_outcomes ?? []).length > 0 && (
            <div className="space-y-2">
              <SectionLabel>Expected Outcomes</SectionLabel>
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      {['Metric', 'Target', 'Timeline'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.expected_outcomes.map((o, i) => (
                      <tr key={i} className="border-b border-border/30 last:border-0">
                        <td className="px-4 py-2.5 font-medium">{o.metric}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{o.target}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{o.timeline}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Risk factors */}
          {(result.risk_factors ?? []).length > 0 && (
            <div className="space-y-2">
              <SectionLabel>Risk Factors</SectionLabel>
              <div className="space-y-2">
                {result.risk_factors.map((r, i) => (
                  <div key={i} className="rounded-xl border bg-card px-4 py-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{r.risk}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{r.mitigation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decision gates */}
          {(result.decision_gates ?? []).length > 0 && (
            <div className="space-y-1.5">
              <SectionLabel>Decision Gates</SectionLabel>
              <BulletList items={result.decision_gates} />
            </div>
          )}

          {/* Success metrics */}
          {(result.success_metrics ?? []).length > 0 && (
            <div className="space-y-1.5">
              <SectionLabel>Success Metrics</SectionLabel>
              <BulletList items={result.success_metrics} />
            </div>
          )}

          {/* Alternatives considered */}
          {result.alternatives_considered && (
            <div className="space-y-1.5">
              <SectionLabel>Alternatives Considered</SectionLabel>
              <p className="text-sm leading-relaxed text-muted-foreground">{result.alternatives_considered}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Monthly Report Tab ─────────────────────────────────────────────────────────

export function MonthlyReportTab({ userEmail }: { userEmail: string }) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [errorCta, setErrorCta] = useState<{ label: string; href: string } | null>(null)
  const [result,  setResult]  = useState<MonthlyReportResult | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    setErrorCta(null)
    setResult(null)

    try {
      const res  = await fetch('/api/ai/monthly-report', { method: 'POST' })
      const data = await res.json() as MonthlyReportResult & { error?: string; cta?: { label: string; href: string } }
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); setErrorCta(data.cta ?? null); return }
      setResult(data)
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  function handlePrint() {
    if (!result) return
    const html = `
      <h1>Monthly Brand Report — ${result.month}</h1>
      <p><strong>${result.headline_score}</strong></p>
      <h2>Executive Summary</h2><p>${result.executive_summary}</p>
      <div class="grid2">
        <div class="wins"><strong style="font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:#15803d">Key Wins</strong><ul>${(result.key_wins ?? []).map(w => `<li>${w}</li>`).join('')}</ul></div>
        <div class="concerns"><strong style="font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:#92400e">Key Concerns</strong><ul>${(result.key_concerns ?? []).map(c => `<li>${c}</li>`).join('')}</ul></div>
      </div>
      <h2>Sentiment Narrative</h2><p>${result.sentiment_narrative}</p>
      <h2>Content Performance</h2><p>${result.content_performance}</p>
      <h2>Audience Signals</h2><p>${result.audience_signals}</p>
      <h2>Next Month Priorities</h2>
      ${(result.next_month_priorities ?? []).map((p, i) => `<div class="card" style="margin-bottom:.5rem"><strong>${i + 1}. ${p.priority}</strong><p style="color:#666">${p.rationale}</p></div>`).join('')}
    `
    printHtml(`Monthly Brand Report — ${result.month}`, html)
  }

  function handleCopy() {
    if (!result) return
    const md = [
      `# Monthly Brand Report — ${result.month}`,
      '',
      `**${result.headline_score}**`,
      '',
      '## Executive Summary',
      result.executive_summary,
      '',
      '## Key Wins',
      ...(result.key_wins ?? []).map(w => `- ${w}`),
      '',
      '## Key Concerns',
      ...(result.key_concerns ?? []).map(c => `- ${c}`),
      '',
      '## Sentiment Narrative',
      result.sentiment_narrative,
      '',
      '## Content Performance',
      result.content_performance,
      '',
      '## Audience Signals',
      result.audience_signals,
      '',
      '## Next Month Priorities',
      ...(result.next_month_priorities ?? []).map((p, i) => `${i + 1}. **${p.priority}** — ${p.rationale}`),
    ].join('\n')
    copyText(md)
  }

  if (!result) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center space-y-6">
        <div className="h-12 w-12 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto">
          <TrendingUp className="h-6 w-6 text-violet-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Monthly Brand Report</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Compiles last 30 days of sentiment, content, SOV, and survey data into an executive-ready report.
            {userEmail && ` A copy will be emailed to ${userEmail}.`}
          </p>
        </div>

        {error && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-left space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
            {errorCta && (
              <Link
                href={errorCta.href}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900 border border-amber-300 rounded-full px-3 py-1.5 hover:bg-amber-100 transition-colors ml-6"
              >
                {errorCta.label}
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}

        <Button onClick={generate} disabled={loading} size="lg" className="gap-2">
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin" />Generating report...</>
            : <><Sparkles className="h-4 w-4" />Generate Monthly Report</>
          }
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="shrink-0 px-6 py-3 border-b bg-background flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{result.month}</p>
          <p className="text-sm font-semibold">{result.headline_score}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DataQualityBadge quality={result.data_quality} />
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCopy}>
            <Copy className="h-3.5 w-3.5" />Copy
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" />Print / PDF
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setResult(null)}>
            Regenerate
          </Button>
        </div>
      </div>

      {/* Scrollable result */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <p className="text-sm text-muted-foreground leading-relaxed">{result.executive_summary}</p>

          {/* Wins / concerns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-wider text-green-700 mb-2.5">Key Wins</p>
              <ul className="space-y-2">
                {(result.key_wins ?? []).map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-green-900">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2.5">Key Concerns</p>
              <ul className="space-y-2">
                {(result.key_concerns ?? []).map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-900">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Narrative sections */}
          {[
            { label: 'Sentiment Narrative', content: result.sentiment_narrative },
            { label: 'Content Performance', content: result.content_performance },
            { label: 'Audience Signals',    content: result.audience_signals },
          ].filter(s => s.content).map(s => (
            <div key={s.label} className="space-y-1.5">
              <SectionLabel>{s.label}</SectionLabel>
              <p className="text-sm leading-relaxed">{s.content}</p>
            </div>
          ))}

          {/* Next month priorities */}
          {(result.next_month_priorities ?? []).length > 0 && (
            <div className="space-y-2">
              <SectionLabel>Next Month Priorities</SectionLabel>
              <div className="space-y-2">
                {result.next_month_priorities.map((p, i) => (
                  <div key={i} className="rounded-xl border bg-card px-4 py-3">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold text-muted-foreground shrink-0 mt-0.5">{i + 1}.</span>
                      <div>
                        <p className="text-sm font-medium">{p.priority}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{p.rationale}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.emailSent && userEmail && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2.5 border">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              Report also sent to {userEmail}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Funnel Diagnostic Tab ──────────────────────────────────────────────────────

export function FunnelDiagnosticTab() {
  return (
    <div className="max-w-lg mx-auto py-16 px-4 text-center space-y-6">
      <div className="h-12 w-12 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto">
        <Filter className="h-6 w-6 text-orange-500" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">Funnel Diagnostic</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          Deep root-cause analysis of every conversion leak across your full customer journey.
          Open the Funnel page and click Diagnose to run an AI analysis.
        </p>
      </div>
      <Link
        href="/dashboard/funnel"
        className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:underline"
      >
        Go to Funnel
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

// ── Legacy V2Tools (now removed from chat page — kept for any future use) ──────
export function V2Tools({ userEmail }: { userEmail: string }) {
  return null
}
