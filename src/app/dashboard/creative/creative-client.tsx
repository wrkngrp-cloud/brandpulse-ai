'use client'

import { useState } from 'react'
import {
  Palette, Zap, Eye, Target, Loader2, CheckCircle2, AlertCircle, TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface CreativeScore {
  engagement: number
  cultural_resonance: number
  tone: number
  clarity: number
  risk: number
  summary: string
}

interface CompareResult {
  winner: 'A' | 'B'
  why_winner: string
  creative_a: CreativeScore
  creative_b: CreativeScore
}

interface IdentityResult {
  consistency_score: number
  strengths: string[]
  drift_warnings: string[]
  adjustments: string[]
}

interface CompetitorResult {
  tone: string
  cultural_fit: number
  engagement_potential: number
  strategic_insights: string[]
  counter_positions: string[]
}

interface RecentAnalysis {
  id: string
  analysis_type: string
  result: Record<string, unknown>
  created_at: string
}

interface Props {
  brandId: string
  brandName: string
  category: string | null
  brandValues: string[]
  recentAnalyses: RecentAnalysis[]
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */

type Tab = 'compare' | 'identity' | 'competitor'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'compare',    label: 'Compare',          icon: Zap    },
  { id: 'identity',   label: 'Identity Check',   icon: Eye    },
  { id: 'competitor', label: 'Competitor Watch',  icon: Target },
]

const PLATFORMS = ['Instagram', 'Twitter', 'TikTok', 'Facebook']

const SCORE_META: { key: keyof Omit<CreativeScore, 'summary'>; label: string; color: string }[] = [
  { key: 'engagement',        label: 'Engagement',        color: 'bg-blue-500'   },
  { key: 'cultural_resonance',label: 'Cultural Resonance',color: 'bg-purple-500' },
  { key: 'tone',              label: 'Tone',              color: 'bg-green-500'  },
  { key: 'clarity',           label: 'Clarity',           color: 'bg-amber-500'  },
  { key: 'risk',              label: 'Risk',              color: 'bg-red-400'    },
]

function ScoreBar({ score, color, label }: { score: number; color: string; label: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{score}</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  )
}

function Gauge({ score }: { score: number }) {
  const pct = Math.min(score, 100)
  const color = pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-amber-600' : 'text-red-500'
  return (
    <div className="flex flex-col items-center gap-1 py-4">
      <span className={cn('text-5xl font-bold tabular-nums', color)}>{score}</span>
      <span className="text-sm text-muted-foreground">Consistency score / 100</span>
    </div>
  )
}

function analysisSummary(a: RecentAnalysis): string {
  const r = a.result
  if (a.analysis_type === 'compare') {
    const cr = r as unknown as CompareResult
    return `Creative ${cr.winner ?? '?'} won — ${(cr.why_winner as string | undefined)?.slice(0, 80) ?? ''}`
  }
  if (a.analysis_type === 'identity') {
    const ir = r as unknown as IdentityResult
    return `Consistency score ${ir.consistency_score ?? '?'}/100`
  }
  if (a.analysis_type === 'competitor') {
    const xr = r as unknown as CompetitorResult
    return `Cultural fit ${xr.cultural_fit ?? '?'}/100 · ${(xr.tone as string | undefined) ?? ''}`
  }
  return ''
}

const TYPE_LABEL: Record<string, string> = {
  compare:    'Compare',
  identity:   'Identity',
  competitor: 'Competitor',
}

/* ── Main component ─────────────────────────────────────────────────────────── */

export function CreativeClient({
  brandId, brandName, category: _category, brandValues, recentAnalyses,
}: Props) {
  const [tab, setTab] = useState<Tab>('compare')

  /* — Compare state — */
  const [creativeA, setCreativeA]     = useState('')
  const [creativeB, setCreativeB]     = useState('')
  const [imageUrlA, setImageUrlA]     = useState('')
  const [imageUrlB, setImageUrlB]     = useState('')
  const [platform, setPlatform]       = useState('Instagram')
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareError, setCompareError]     = useState<string | null>(null)
  const [compareResult, setCompareResult]   = useState<CompareResult | null>(null)

  /* — Identity state — */
  const [captions, setCaptions]           = useState(['', '', ''])
  const [identityLoading, setIdentityLoading] = useState(false)
  const [identityError, setIdentityError]     = useState<string | null>(null)
  const [identityResult, setIdentityResult]   = useState<IdentityResult | null>(null)

  /* — Competitor state — */
  const [competitorName, setCompetitorName]       = useState('')
  const [competitorContent, setCompetitorContent] = useState('')
  const [competitorLoading, setCompetitorLoading] = useState(false)
  const [competitorError, setCompetitorError]     = useState<string | null>(null)
  const [competitorResult, setCompetitorResult]   = useState<CompetitorResult | null>(null)

  /* — Actions — */

  async function runCompare() {
    if (!creativeA.trim() || !creativeB.trim()) return
    setCompareLoading(true)
    setCompareError(null)
    try {
      const res = await fetch('/api/creative/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          creativeA: creativeA.trim(),
          creativeB: creativeB.trim(),
          platform,
          imageUrlA: imageUrlA.trim() || undefined,
          imageUrlB: imageUrlB.trim() || undefined,
        }),
      })
      const data = await res.json() as CompareResult & { error?: string }
      if (!res.ok) { setCompareError(data.error ?? 'Analysis failed'); return }
      setCompareResult(data)
    } catch {
      setCompareError('Network error. Try again.')
    } finally {
      setCompareLoading(false)
    }
  }

  async function runIdentity() {
    const filled = captions.filter(c => c.trim())
    if (filled.length === 0) return
    setIdentityLoading(true)
    setIdentityError(null)
    try {
      const res = await fetch('/api/creative/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          captions: filled,
          brandValues,
        }),
      })
      const data = await res.json() as IdentityResult & { error?: string }
      if (!res.ok) { setIdentityError(data.error ?? 'Analysis failed'); return }
      setIdentityResult(data)
    } catch {
      setIdentityError('Network error. Try again.')
    } finally {
      setIdentityLoading(false)
    }
  }

  async function runCompetitor() {
    if (!competitorName.trim() || !competitorContent.trim()) return
    setCompetitorLoading(true)
    setCompetitorError(null)
    try {
      const res = await fetch('/api/creative/competitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          competitorName: competitorName.trim(),
          content: competitorContent.trim(),
        }),
      })
      const data = await res.json() as CompetitorResult & { error?: string }
      if (!res.ok) { setCompetitorError(data.error ?? 'Analysis failed'); return }
      setCompetitorResult(data)
    } catch {
      setCompetitorError('Network error. Try again.')
    } finally {
      setCompetitorLoading(false)
    }
  }

  /* ── Render ──────────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex border-b">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Compare ──────────────────────────────────────────────────── */}
      {tab === 'compare' && (
        <div className="space-y-5">
          {/* Platform selector */}
          <div className="flex gap-2 flex-wrap">
            {PLATFORMS.map(p => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  platform === p
                    ? 'bg-foreground text-background border-foreground'
                    : 'text-muted-foreground border-border hover:border-foreground/40',
                )}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Side-by-side inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Creative A */}
            <div className="space-y-3 border rounded-xl p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold bg-muted px-2 py-0.5 rounded">A</span>
                <span className="text-sm font-medium">Creative A</span>
              </div>
              <Textarea
                value={creativeA}
                onChange={e => setCreativeA(e.target.value)}
                placeholder="Paste caption or creative text..."
                className="min-h-[120px] resize-none text-sm"
              />
              <input
                type="url"
                value={imageUrlA}
                onChange={e => setImageUrlA(e.target.value)}
                placeholder="Image URL (optional)"
                className="w-full text-sm border rounded-md px-3 py-2 bg-background placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {/* Creative B */}
            <div className="space-y-3 border rounded-xl p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold bg-muted px-2 py-0.5 rounded">B</span>
                <span className="text-sm font-medium">Creative B</span>
              </div>
              <Textarea
                value={creativeB}
                onChange={e => setCreativeB(e.target.value)}
                placeholder="Paste caption or creative text..."
                className="min-h-[120px] resize-none text-sm"
              />
              <input
                type="url"
                value={imageUrlB}
                onChange={e => setImageUrlB(e.target.value)}
                placeholder="Image URL (optional)"
                className="w-full text-sm border rounded-md px-3 py-2 bg-background placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {compareError && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {compareError}
            </div>
          )}

          <Button
            onClick={runCompare}
            disabled={compareLoading || !creativeA.trim() || !creativeB.trim()}
            className="w-full"
          >
            {compareLoading
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Comparing creatives...</>
              : <><Zap className="h-4 w-4 mr-2" /> Compare creatives</>
            }
          </Button>

          {/* Compare results */}
          {compareResult && (
            <div className="space-y-4">
              {/* Winner banner */}
              <div className="border rounded-xl p-4 bg-muted/30 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-semibold">
                    Creative {compareResult.winner} wins on {platform}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {compareResult.why_winner}
                </p>
              </div>

              {/* Score cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(['creative_a', 'creative_b'] as const).map((key, i) => {
                  const label = i === 0 ? 'A' : 'B'
                  const scores = compareResult[key]
                  const isWinner = compareResult.winner === label
                  return (
                    <div
                      key={key}
                      className={cn(
                        'border rounded-xl p-4 space-y-4',
                        isWinner && 'border-green-400 ring-1 ring-green-300',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Creative {label}</span>
                        {isWinner && (
                          <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase tracking-wide">
                            Winner
                          </span>
                        )}
                      </div>
                      <div className="space-y-3">
                        {SCORE_META.map(({ key: sk, label: sl, color }) => (
                          <ScoreBar key={sk} score={scores[sk]} label={sl} color={color} />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed pt-1 border-t">
                        {scores.summary}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Identity Check ──────────────────────────────────────────── */}
      {tab === 'identity' && (
        <div className="space-y-5">
          <div className="border rounded-xl p-4 bg-muted/20 space-y-2">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">How this works</p>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Paste your 3 most recent social media captions to check if your brand voice is drifting.
            </p>
            {brandValues.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-xs text-muted-foreground">Brand values:</span>
                {brandValues.map(v => (
                  <span key={v} className="text-xs bg-muted px-2 py-0.5 rounded-full">
                    {v}
                  </span>
                ))}
              </div>
            )}
          </div>

          {[0, 1, 2].map(i => (
            <div key={i} className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Caption {i + 1}</label>
              <Textarea
                value={captions[i]}
                onChange={e => {
                  const next = [...captions]
                  next[i] = e.target.value
                  setCaptions(next)
                }}
                placeholder={`Paste caption ${i + 1}...`}
                className="min-h-[90px] resize-none text-sm"
              />
            </div>
          ))}

          {identityError && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {identityError}
            </div>
          )}

          <Button
            onClick={runIdentity}
            disabled={identityLoading || captions.every(c => !c.trim())}
            className="w-full"
          >
            {identityLoading
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking identity...</>
              : <><Eye className="h-4 w-4 mr-2" /> Check identity consistency</>
            }
          </Button>

          {/* Identity results */}
          {identityResult && (
            <div className="space-y-4">
              <div className="border rounded-xl bg-card">
                <Gauge score={identityResult.consistency_score} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Strengths</span>
                  </div>
                  {identityResult.strengths.length > 0 ? (
                    <ul className="space-y-1.5">
                      {identityResult.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-muted-foreground leading-relaxed flex gap-2">
                          <span className="text-green-500 shrink-0">•</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">None identified.</p>
                  )}
                </div>

                {/* Drift warnings */}
                <div className="border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">Drift warnings</span>
                  </div>
                  {identityResult.drift_warnings.length > 0 ? (
                    <ul className="space-y-1.5">
                      {identityResult.drift_warnings.map((w, i) => (
                        <li key={i} className="text-sm text-muted-foreground leading-relaxed flex gap-2">
                          <span className="text-amber-500 shrink-0">•</span>
                          {w}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No drift detected.</p>
                  )}
                </div>
              </div>

              {/* Adjustments */}
              {identityResult.adjustments.length > 0 && (
                <div className="border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Recommended adjustments</span>
                  </div>
                  <ul className="space-y-2">
                    {identityResult.adjustments.map((a, i) => (
                      <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                        <span className="shrink-0 h-5 w-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Competitor Watch ─────────────────────────────────────────── */}
      {tab === 'competitor' && (
        <div className="space-y-5">
          <div className="border rounded-xl p-4 bg-muted/20 space-y-1.5">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Analyse a competitor&apos;s creative</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Paste a competitor&apos;s recent post or campaign copy to get a breakdown of their tone,
              cultural fit, and how {brandName} can counter-position.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Competitor name</label>
            <input
              type="text"
              value={competitorName}
              onChange={e => setCompetitorName(e.target.value)}
              placeholder="e.g. Pepsi Nigeria"
              className="w-full text-sm border rounded-md px-3 py-2 bg-background placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Their recent content</label>
            <Textarea
              value={competitorContent}
              onChange={e => setCompetitorContent(e.target.value)}
              placeholder="Paste their recent caption, ad copy, or campaign text..."
              className="min-h-[140px] resize-none text-sm"
            />
          </div>

          {competitorError && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {competitorError}
            </div>
          )}

          <Button
            onClick={runCompetitor}
            disabled={competitorLoading || !competitorName.trim() || !competitorContent.trim()}
            className="w-full"
          >
            {competitorLoading
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analysing...</>
              : <><Target className="h-4 w-4 mr-2" /> Analyse competitor creative</>
            }
          </Button>

          {/* Competitor results */}
          {competitorResult && (
            <div className="space-y-4">
              {/* Top metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="border rounded-xl p-3 text-center space-y-1">
                  <p className="text-xs text-muted-foreground">Tone</p>
                  <p className="text-sm font-semibold capitalize">{competitorResult.tone}</p>
                </div>
                <div className="border rounded-xl p-3 text-center space-y-1">
                  <p className="text-xs text-muted-foreground">Cultural fit</p>
                  <p className="text-sm font-semibold tabular-nums">{competitorResult.cultural_fit}/100</p>
                </div>
                <div className="border rounded-xl p-3 text-center space-y-1">
                  <p className="text-xs text-muted-foreground">Est. engagement</p>
                  <p className="text-sm font-semibold tabular-nums">{competitorResult.engagement_potential}/100</p>
                </div>
              </div>

              {/* Strategic insights */}
              <div className="border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Strategic insights</span>
                </div>
                {competitorResult.strategic_insights.length > 0 ? (
                  <ul className="space-y-2">
                    {competitorResult.strategic_insights.map((s, i) => (
                      <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                        <span className="shrink-0 h-5 w-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        {s}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No insights generated.</p>
                )}
              </div>

              {/* Counter-positioning */}
              <div className="border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">Counter-positioning ideas for {brandName}</span>
                </div>
                {competitorResult.counter_positions.length > 0 ? (
                  <ul className="space-y-2">
                    {competitorResult.counter_positions.map((cp, i) => (
                      <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                        <span className="shrink-0 text-purple-400 font-bold">#{i + 1}</span>
                        {cp}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No counter-positions generated.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── History ──────────────────────────────────────────────────────────── */}
      {recentAnalyses.length > 0 && (
        <div className="space-y-3 pt-2 border-t">
          <p className="text-sm font-medium text-muted-foreground">Recent analyses</p>
          <ul className="space-y-2">
            {recentAnalyses.map(a => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-4 text-sm border rounded-lg px-3 py-2.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 text-xs bg-muted px-2 py-0.5 rounded font-medium capitalize">
                    {TYPE_LABEL[a.analysis_type] ?? a.analysis_type}
                  </span>
                  <span className="text-muted-foreground truncate">{analysisSummary(a)}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  {new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
