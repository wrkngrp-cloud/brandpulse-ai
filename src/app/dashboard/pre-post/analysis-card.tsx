'use client'

import { useState } from 'react'
import { AlertTriangle, Camera, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RiskFlag {
  title?: string
}

interface Analysis {
  id:                string
  content_text:      string | null
  platform:          string | null
  funnel_goal:       string | null
  target_segment:    string | null
  engagement_score:  number | null
  cultural_score:    number | null
  tone_score:        number | null
  clarity_score:     number | null
  risk_score:        number | null
  risk_flags:        unknown
  verdict:           string | null
  improvements:      unknown
  suggested_rewrite: string | null
  created_at:        string
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-green-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-500'
}

function ScoreBar({ score, invert = false }: { score: number; invert?: boolean }) {
  const good = invert ? score <= 25 : score >= 75
  const mid  = invert ? score <= 50 : score >= 50
  const col  = good ? 'bg-green-500' : mid ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="h-1 bg-muted rounded-full overflow-hidden w-16">
      <div className={cn('h-full rounded-full', col)} style={{ width: `${score}%` }} />
    </div>
  )
}

function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === 'Publish') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border border-green-200 dark:border-green-800">
        Ready to Publish
      </span>
    )
  }
  if (verdict === 'Revise') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
        Needs Revision
      </span>
    )
  }
  if (verdict === 'Hold') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border border-red-200 dark:border-red-800">
        On Hold
      </span>
    )
  }
  // Fallback: render raw verdict text as a neutral badge
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
      {verdict}
    </span>
  )
}

export function AnalysisCard({ analysis: a }: { analysis: Analysis }) {
  const [rewriteOpen, setRewriteOpen] = useState(false)

  const riskFlags = (a.risk_flags as RiskFlag[] | null) ?? []
  const hasRisk   = (a.risk_score ?? 0) > 50

  return (
    <div className="border rounded-xl p-5 bg-card space-y-4">
      {/* Header row: verdict badge + date */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {a.verdict && <VerdictBadge verdict={a.verdict} />}
          <span className="text-xs bg-muted px-2 py-0.5 rounded font-medium">{a.platform}</span>
          {a.funnel_goal    && <span className="text-xs text-muted-foreground">{a.funnel_goal}</span>}
          {a.target_segment && <span className="text-xs text-muted-foreground">· {a.target_segment}</span>}
        </div>
        <p className="text-xs text-muted-foreground shrink-0">
          {new Date(a.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>

      {/* Content preview */}
      <div>
        {a.content_text ? (
          <p className="text-sm line-clamp-2 leading-snug">{a.content_text}</p>
        ) : (
          <div className="flex items-center gap-1.5 text-muted-foreground/70">
            <Camera className="h-3.5 w-3.5 shrink-0" />
            <span className="text-sm italic">Image/video analyzed</span>
          </div>
        )}
      </div>

      {/* Scores grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Engagement', score: a.engagement_score },
          { label: 'Cultural',   score: a.cultural_score },
          { label: 'Tone',       score: a.tone_score },
          { label: 'Clarity',    score: a.clarity_score },
          { label: 'Risk',       score: a.risk_score, invert: true },
        ].map(s => (
          <div key={s.label} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{s.label}</span>
              <span className={cn(
                'text-xs font-semibold tabular-nums',
                s.invert
                  ? (s.score ?? 0) <= 25 ? 'text-green-600' : (s.score ?? 0) <= 50 ? 'text-amber-600' : 'text-red-500'
                  : scoreColor(s.score ?? 0),
              )}>
                {s.score ?? '—'}
              </span>
            </div>
            <ScoreBar score={s.score ?? 0} invert={s.invert} />
          </div>
        ))}
      </div>

      {/* Risk flags */}
      {hasRisk && riskFlags.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-800 dark:text-amber-300 space-y-0.5">
            {riskFlags.slice(0, 2).map((f, i) => (
              <p key={i}>{f.title}</p>
            ))}
            {riskFlags.length > 2 && (
              <p className="text-amber-600 dark:text-amber-400">+{riskFlags.length - 2} more</p>
            )}
          </div>
        </div>
      )}

      {/* Suggested rewrite collapsible */}
      {a.suggested_rewrite && (
        <div className="border-t pt-3 space-y-2">
          <button
            onClick={() => setRewriteOpen(o => !o)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Suggested Rewrite
            {rewriteOpen
              ? <ChevronUp className="h-3.5 w-3.5 ml-auto" />
              : <ChevronDown className="h-3.5 w-3.5 ml-auto" />
            }
          </button>
          {rewriteOpen && (
            <div className="rounded-lg bg-muted/50 border border-border px-3 py-2.5">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{a.suggested_rewrite}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
