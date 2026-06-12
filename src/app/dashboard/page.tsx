import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { Suspense } from 'react'
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react'
import { computeBHI } from '@/lib/bhi'
import { BHIGauge } from '@/components/dashboard/bhi-gauge'

function TrendIcon({ value, threshold = 50 }: { value: number | null; threshold?: number }) {
  if (value === null) return null
  if (value >= threshold + 10) return <TrendingUp className="h-4 w-4 text-green-600" />
  if (value <= threshold - 10) return <TrendingDown className="h-4 w-4 text-red-500" />
  return <Minus className="h-4 w-4 text-muted-foreground" />
}

async function DashboardContent() {
  const supabase = await createClient()

  const [
    { data: brand },
    { data: sentimentRow },
    { data: sovRow },
    { data: surveyResponses },
    { data: bhiHistory },
  ] = await Promise.all([
    supabase
      .from('brands')
      .select('id, name, category')
      .limit(1)
      .single(),

    supabase
      .from('sentiment_daily')
      .select('social_score, day, positive_pct, negative_pct')
      .order('day', { ascending: false })
      .limit(1)
      .single(),

    supabase
      .from('sov_snapshots')
      .select('social_sov, snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single(),

    // NPS from survey responses: q2 answer, quality ok only
    supabase
      .from('survey_responses')
      .select('answers, quality_flag')
      .eq('quality_flag', 'ok'),

    supabase
      .from('brand_health_snapshots')
      .select('bhi, snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(30),
  ])

  // Derive survey NPS score (0–100)
  const npsScores = (surveyResponses ?? [])
    .map(r => (r.answers as Record<string, unknown>)?.q2 as number | undefined)
    .filter((s): s is number => typeof s === 'number' && s >= 0 && s <= 10)
  const avgNps = npsScores.length
    ? npsScores.reduce((a, b) => a + b, 0) / npsScores.length
    : null
  const surveyScore = avgNps !== null ? avgNps * 10 : null

  const sentimentScore = sentimentRow?.social_score ?? null
  const sovScore       = sovRow?.social_sov ?? null

  const bhi = computeBHI({ sentimentScore, sovScore, surveyScore })

  // Sparkline from stored snapshots (oldest → newest for left→right)
  const sparkline = [...(bhiHistory ?? [])]
    .reverse()
    .map(r => ({ date: r.snapshot_date, score: Number(r.bhi) }))

  const hasAnyData = sentimentScore !== null || sovScore !== null || surveyScore !== null

  return (
    <div className="space-y-6">
      {/* Brand header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{brand?.name ?? 'Your brand'}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{brand?.category ?? 'Overview'}</p>
      </div>

      {/* Main stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
        {/* BHI card — gauge */}
        <div className="border rounded-xl p-5 bg-card space-y-1">
          <p className="text-sm text-muted-foreground font-medium">Brand Health Index</p>
          {hasAnyData ? (
            <BHIGauge bhi={bhi} sparkline={sparkline} />
          ) : (
            <div className="py-8 text-center space-y-1">
              <Activity className="h-6 w-6 text-muted-foreground/30 mx-auto" />
              <p className="text-xs text-muted-foreground">
                Connect social accounts and run at least one survey to see your BHI.
              </p>
            </div>
          )}
        </div>

        {/* Sentiment card */}
        <div className="border rounded-xl p-5 bg-card space-y-2">
          <p className="text-sm text-muted-foreground font-medium">Sentiment Score</p>
          {sentimentScore !== null ? (
            <>
              <div className="flex items-end gap-2">
                <p className="text-4xl font-bold">{Math.round(sentimentScore)}</p>
                <TrendIcon value={sentimentScore} />
              </div>
              <p className="text-xs text-muted-foreground">out of 100</p>
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Positive</span>
                  <span className="text-green-600 font-medium">
                    {Math.round(sentimentRow!.positive_pct)}%
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${sentimentRow!.positive_pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Negative</span>
                  <span className="text-red-500 font-medium">
                    {Math.round(sentimentRow!.negative_pct)}%
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-400 rounded-full"
                    style={{ width: `${sentimentRow!.negative_pct}%` }}
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground pt-1">
                From {new Date(sentimentRow!.day).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
              </p>
            </>
          ) : (
            <div className="py-6 text-center space-y-1">
              <p className="text-3xl font-bold text-muted-foreground/30">—</p>
              <p className="text-xs text-muted-foreground">
                No crawl data yet. Go to Sentiment and click Run crawl now.
              </p>
            </div>
          )}
        </div>

        {/* SOV card */}
        <div className="border rounded-xl p-5 bg-card space-y-2">
          <p className="text-sm text-muted-foreground font-medium">Share of Voice</p>
          {sovScore !== null ? (
            <>
              <div className="flex items-end gap-2">
                <p className="text-4xl font-bold">{Math.round(sovScore)}%</p>
                <TrendIcon value={sovScore} threshold={25} />
              </div>
              <p className="text-xs text-muted-foreground">social SOV</p>
              <p className="text-[10px] text-muted-foreground pt-1">
                From {new Date(sovRow!.snapshot_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
              </p>
            </>
          ) : (
            <div className="py-6 text-center space-y-1">
              <p className="text-3xl font-bold text-muted-foreground/30">—</p>
              <p className="text-xs text-muted-foreground">
                SOV is computed after the first mention crawl
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Onboarding nudge when truly empty */}
      {!hasAnyData && (
        <div className="border rounded-xl p-8 text-center space-y-2">
          <p className="text-sm font-medium">Your dashboard is ready</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Connect your social accounts on the Content page and create your first survey to start seeing brand intelligence here.
          </p>
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
