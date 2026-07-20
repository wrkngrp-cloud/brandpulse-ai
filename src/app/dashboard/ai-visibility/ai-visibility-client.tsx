'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Bot, Loader2, RefreshCw, AlertCircle, CheckCircle2, XCircle, MinusCircle, Sparkles, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { VisibilityScore, VisibilityCheck } from './page'

interface Props {
  brandName: string
  brandCategory: string | null
  scores: VisibilityScore[]
  checks: VisibilityCheck[]
  hasApiKeys: boolean
}

const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
}

const PLATFORM_COLORS: Record<string, string> = {
  chatgpt:    '#10a37f',
  gemini:     '#4285f4',
  perplexity: '#5436da',
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = size * 0.38
  const circumference = 2 * Math.PI * r
  const filled = (score / 100) * circumference
  const color = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={size * 0.085} className="text-muted/40" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={size * 0.085}
        strokeDasharray={`${filled} ${circumference - filled}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + size * 0.07} textAnchor="middle" fontSize={size * 0.26} fontWeight="bold" fill={color}>{score}</text>
    </svg>
  )
}

function PlatformScore({ platform, score }: { platform: string; score: number | null }) {
  const label = PLATFORM_LABELS[platform] ?? platform
  const color = PLATFORM_COLORS[platform] ?? '#888'
  return (
    <div className="border rounded-xl p-4 bg-card space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <p className="text-[12px] font-semibold text-muted-foreground">{label}</p>
      </div>
      {score === null ? (
        <p className="text-sm text-muted-foreground">Not connected</p>
      ) : (
        <p className="text-2xl font-bold tracking-tight" style={{ color }}>{score}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
      )}
    </div>
  )
}

function MentionIcon({ mentioned, tone }: { mentioned: boolean; tone: string | null }) {
  if (!mentioned) return <XCircle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
  if (tone === 'positive') return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
  if (tone === 'negative') return <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
  return <MinusCircle className="h-4 w-4 text-amber-500 shrink-0" />
}

function toneBadge(tone: string | null) {
  if (!tone) return null
  const map = {
    positive: 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400',
    neutral:  'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    negative: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  }
  return (
    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize', map[tone as keyof typeof map])}>
      {tone}
    </span>
  )
}

export function AiVisibilityClient({ brandName, brandCategory, scores, checks, hasApiKeys }: Props) {
  const [running, setRunning] = useState(false)

  const latest = scores[0] ?? null

  const chartData = [...scores].reverse().map(s => ({
    week: new Date(s.week_of).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', timeZone: 'Africa/Lagos' }),
    score: s.visibility_score,
    chatgpt: s.chatgpt_score,
    gemini: s.gemini_score,
    perplexity: s.perplexity_score,
  }))

  async function runCheck() {
    setRunning(true)
    try {
      const res = await fetch('/api/ai-visibility/check', { method: 'POST' })
      const data = await res.json() as { queued?: boolean; error?: string }
      if (!res.ok || data.error) { toast.error(data.error ?? "Couldn't start the visibility check. Try again."); return }
      toast.success('Visibility check queued. Results appear in 2-3 minutes.')
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.")
    } finally {
      setRunning(false)
    }
  }

  const noKeys = !hasApiKeys

  return (
    <div className="max-w-4xl space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Intelligence</p>
          <h1 className="h-display text-[26px] leading-none">AI Visibility Tracker</h1>
          <p className="mt-2 text-[13px] text-muted-foreground/70 max-w-xl">
            How often does {brandName} appear when consumers ask ChatGPT, Gemini, or Perplexity for a recommendation?
          </p>
        </div>
        <Button onClick={runCheck} disabled={running || noKeys} size="sm" className="shrink-0">
          {running
            ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Running...</>
            : <><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Run check now</>}
        </Button>
      </div>

      {/* No API keys warning */}
      {noKeys && (
        <div className="border border-amber-200 dark:border-amber-800 rounded-xl p-5 bg-amber-50 dark:bg-amber-950/20 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">No AI platform keys configured</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
                Add at least one key to start tracking. All three are optional — BrandGauge will check whichever platforms are configured.
              </p>
            </div>
          </div>
          <div className="font-mono text-xs bg-amber-100 dark:bg-amber-950/40 rounded-lg p-3 space-y-1 text-amber-900 dark:text-amber-300">
            <p>OPENAI_API_KEY=          ← ChatGPT (GPT-4o mini)</p>
            <p>GOOGLE_AI_API_KEY=       ← Gemini 2.0 Flash</p>
            <p>PERPLEXITY_API_KEY=      ← Perplexity Sonar</p>
          </div>
        </div>
      )}

      {/* Score summary */}
      {latest ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Overall score */}
          <div className="border rounded-2xl p-6 bg-card flex flex-col items-center justify-center gap-2 sm:col-span-1">
            <ScoreRing score={latest.visibility_score} size={80} />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center">AI Visibility Score</p>
            <p className="text-[11px] text-muted-foreground">
              Week of {new Date(latest.week_of).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', timeZone: 'Africa/Lagos' })}
            </p>
          </div>
          {/* Per-platform */}
          <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <PlatformScore platform="chatgpt"    score={latest.chatgpt_score} />
            <PlatformScore platform="gemini"     score={latest.gemini_score} />
            <PlatformScore platform="perplexity" score={latest.perplexity_score} />
          </div>
        </div>
      ) : (
        <div className="border rounded-2xl p-10 bg-card text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Bot className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="font-semibold">No visibility data yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {noKeys
                ? 'Add your API keys above, then run the first check.'
                : `Click "Run check now" to see how ${brandName} appears in AI assistants.`}
            </p>
          </div>
          {!noKeys && (
            <Button onClick={runCheck} disabled={running}>
              {running ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running...</> : 'Run first check'}
            </Button>
          )}
        </div>
      )}

      {/* Trend chart */}
      {chartData.length > 1 && (
        <div className="border rounded-2xl p-5 bg-card space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">12-week trend</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                formatter={(value, name) => [
                  String(value ?? 0) + '/100',
                  PLATFORM_LABELS[String(name)] ?? String(name),
                ]}
              />
              <Line type="monotone" dataKey="score"      stroke="#6366f1" strokeWidth={2.5} dot={false} name="Overall" />
              <Line type="monotone" dataKey="chatgpt"    stroke={PLATFORM_COLORS.chatgpt}    strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="chatgpt" />
              <Line type="monotone" dataKey="gemini"     stroke={PLATFORM_COLORS.gemini}     strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="gemini" />
              <Line type="monotone" dataKey="perplexity" stroke={PLATFORM_COLORS.perplexity} strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="perplexity" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AI Recommendation */}
      {latest?.ai_recommendation && (
        <div className="border rounded-2xl p-5 bg-card space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Strategic recommendation</p>
          </div>
          <p className="text-[13.5px] leading-relaxed text-muted-foreground">{latest.ai_recommendation}</p>
        </div>
      )}

      {/* Top competitors in AI responses */}
      {latest?.top_competitors && latest.top_competitors.length > 0 && (
        <div className="border rounded-2xl p-5 bg-card space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-semibold">Competitors surfaced by AI assistants</p>
            <p className="text-[11px] text-muted-foreground ml-auto">This week</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {latest.top_competitors.map(c => (
              <Badge key={c} variant="secondary" className="text-[12px]">{c}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Check log */}
      {checks.length > 0 && (
        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Question-by-question breakdown
          </h2>
          <div className="border rounded-2xl bg-card overflow-hidden divide-y">
            {checks.map((c, i) => (
              <div key={i} className="p-4 flex items-start gap-3">
                <MentionIcon mentioned={c.brand_mentioned} tone={c.tone} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white shrink-0"
                      style={{ backgroundColor: PLATFORM_COLORS[c.platform] ?? '#888' }}
                    >
                      {PLATFORM_LABELS[c.platform] ?? c.platform}
                    </span>
                    {c.brand_mentioned
                      ? <>
                          {toneBadge(c.tone)}
                          {c.mention_position && (
                            <span className="text-[10px] text-muted-foreground capitalize">{c.mention_position} mention</span>
                          )}
                        </>
                      : <span className="text-[11px] text-muted-foreground">Not mentioned</span>
                    }
                  </div>
                  <p className="text-[13px] leading-snug">{c.question}</p>
                  {c.competitors_mentioned.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Competitors surfaced: {c.competitors_mentioned.join(', ')}
                    </p>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground shrink-0">
                  {new Date(c.checked_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' })}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
