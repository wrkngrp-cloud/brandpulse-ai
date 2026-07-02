import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Zap } from 'lucide-react'
import { AnalysisCard } from './analysis-card'
import { TourTrigger } from '@/components/tours/tour-trigger'

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
            Use the Pre-Post widget (the lightning button or press Cmd+Shift+P) to score content before you publish. Your history will appear here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {analyses.map(a => (
        <AnalysisCard key={a.id} analysis={a} />
      ))}
    </div>
  )
}

export default async function PrePostPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

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
          <TourTrigger module="pre_post" autoStart />
          <kbd className="text-[10px] text-muted-foreground border rounded px-1.5 py-0.5">⌘⇧P</kbd>
          <span className="text-xs text-muted-foreground">to open widget</span>
        </div>
      </div>

      <Suspense fallback={
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      }>
        <div data-tour="prepost-main">
          <PrePostHistory />
        </div>
      </Suspense>
    </div>
  )
}
