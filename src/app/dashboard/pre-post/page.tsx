import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Zap, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

function scoreColor(score: number) {
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

async function PrePostHistory() {
  const supabase = await createClient()

  const { data: analyses } = await supabase
    .from('pre_post_analyses')
    .select('id, content_text, platform, funnel_goal, target_segment, engagement_score, cultural_score, tone_score, clarity_score, risk_score, risk_flags, verdict, improvements, suggested_rewrite, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  if (!analyses?.length) {
    return (
      <div className="border rounded-xl p-12 text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto">
          <Zap className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">No analyses yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Use the Pre-Post widget (the ⚡ button or ⌘⇧P) to score content before you publish. Your history will appear here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {analyses.map(a => {
        const riskFlags = (a.risk_flags as { title?: string }[] | null) ?? []
        const hasRisk   = (a.risk_score ?? 0) > 50

        return (
          <div key={a.id} className="border rounded-xl p-5 bg-card space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs bg-muted px-2 py-0.5 rounded font-medium">{a.platform}</span>
                  {a.funnel_goal && <span className="text-xs text-muted-foreground">{a.funnel_goal}</span>}
                  {a.target_segment && <span className="text-xs text-muted-foreground">· {a.target_segment}</span>}
                </div>
                <p className="text-sm line-clamp-2 leading-snug">{a.content_text || '(visual only)'}</p>
              </div>
              <p className="text-xs text-muted-foreground shrink-0">
                {new Date(a.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>

            {/* Scores grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Engagement',  score: a.engagement_score },
                { label: 'Cultural',    score: a.cultural_score },
                { label: 'Tone',        score: a.tone_score },
                { label: 'Clarity',     score: a.clarity_score },
                { label: 'Risk',        score: a.risk_score, invert: true },
              ].map(s => (
                <div key={s.label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{s.label}</span>
                    <span className={cn('text-xs font-semibold tabular-nums', s.invert
                      ? (s.score ?? 0) <= 25 ? 'text-green-600' : (s.score ?? 0) <= 50 ? 'text-amber-600' : 'text-red-500'
                      : scoreColor(s.score ?? 0)
                    )}>
                      {s.score ?? '—'}
                    </span>
                  </div>
                  <ScoreBar score={s.score ?? 0} invert={s.invert} />
                </div>
              ))}
            </div>

            {/* Verdict */}
            {a.verdict && (
              <p className="text-xs text-muted-foreground leading-relaxed border-t pt-3">{a.verdict}</p>
            )}

            {/* Risk flags */}
            {hasRisk && riskFlags.length > 0 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-800 space-y-0.5">
                  {riskFlags.slice(0, 2).map((f, i) => (
                    <p key={i}>{f.title}</p>
                  ))}
                  {riskFlags.length > 2 && <p className="text-amber-600">+{riskFlags.length - 2} more</p>}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function PrePostPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pre-Post Analysis</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Content scored before publishing · 5 dimensions: engagement, cultural resonance, tone, clarity, risk
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <kbd className="text-[10px] text-muted-foreground border rounded px-1.5 py-0.5">⌘⇧P</kbd>
          <span className="text-xs text-muted-foreground">to open widget</span>
        </div>
      </div>

      <Suspense fallback={
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      }>
        <PrePostHistory />
      </Suspense>
    </div>
  )
}
