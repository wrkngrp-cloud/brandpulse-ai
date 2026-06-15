import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, Minus, MessageCircle, AlertTriangle, Info } from 'lucide-react'
import { TriggerCrawlButton } from './trigger-crawl-button'
import { CrawlHistory } from './crawl-history'
import { SentimentTrendChart } from './sentiment-trend-chart'
import { EmotionWheel } from './emotion-wheel'
import { TopicClusters } from './topic-clusters'
import { SentimentHeatmap } from '@/components/dashboard/sentiment-heatmap'
import { MentionsList } from './mentions-list'

const SENTIMENT_BAR: Record<string, string> = {
  positive: 'bg-green-500',
  neutral:  'bg-muted-foreground/40',
  negative: 'bg-red-400',
}

const PLATFORM_LABEL: Record<string, string> = {
  twitter:   'X',
  instagram: 'IG',
}

interface DayRow {
  day: string
  social_score: number
  positive_pct: number
  neutral_pct: number
  negative_pct: number
  emotion_distribution: Record<string, number> | null
  platform_breakdown: Record<string, {
    volume: number; score: number
    positive_pct: number; neutral_pct: number; negative_pct: number
  }> | null
}

interface Alert {
  type:     'crash' | 'spike' | 'sustained_negative'
  severity: 'watch' | 'warning' | 'critical'
  date:     string
  message:  string
}

function computeAlerts(daily: DayRow[]): Alert[] {
  if (daily.length < 2) return []
  const sorted = [...daily].sort((a, b) => a.day.localeCompare(b.day))
  const alerts: Alert[] = []

  for (let i = 1; i < sorted.length; i++) {
    const prev  = sorted[i - 1]
    const curr  = sorted[i]
    const delta = curr.social_score - prev.social_score

    if (delta <= -20) {
      alerts.push({ type: 'crash', severity: 'critical', date: curr.day,
        message: `Sentiment crashed ${Math.abs(Math.round(delta))} points on ${new Date(curr.day).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}` })
    } else if (delta <= -10) {
      alerts.push({ type: 'crash', severity: 'warning', date: curr.day,
        message: `Sentiment dropped ${Math.abs(Math.round(delta))} points on ${new Date(curr.day).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}` })
    } else if (delta >= 20) {
      alerts.push({ type: 'spike', severity: 'watch', date: curr.day,
        message: `Positive surge of ${Math.round(delta)} points on ${new Date(curr.day).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })} — capture what drove this` })
    }
  }

  // Sustained negative
  let negStreak = 0
  for (const day of sorted) {
    if ((day.negative_pct ?? 0) > 60) {
      negStreak++
      if (negStreak >= 3) {
        alerts.push({ type: 'sustained_negative', severity: 'warning', date: day.day,
          message: `Negative mentions exceeded 60% for ${negStreak}+ consecutive days — review recent campaigns` })
        break
      }
    } else { negStreak = 0 }
  }

  return alerts.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
}

function weeklyAggregate(daily: DayRow[]): { weekLabel: string; score: number; positive: number; negative: number }[] {
  const sorted = [...daily].sort((a, b) => a.day.localeCompare(b.day))
  const weeks: { weekLabel: string; score: number; positive: number; negative: number }[] = []

  for (let i = 0; i < sorted.length; i += 7) {
    const slice = sorted.slice(i, i + 7)
    if (!slice.length) continue
    const avg = (key: keyof DayRow) =>
      slice.reduce((s, d) => s + ((d[key] as number) ?? 0), 0) / slice.length
    weeks.push({
      weekLabel: slice[0].day,
      score:     avg('social_score'),
      positive:  avg('positive_pct'),
      negative:  avg('negative_pct'),
    })
  }
  return weeks
}

async function SentimentData() {
  const supabase = await createClient()

  const [{ data: daily }, { data: mentions }, { data: lastRun }, { data: heatmapRaw }] = await Promise.all([
    supabase
      .from('sentiment_daily')
      .select('day, social_score, positive_pct, neutral_pct, negative_pct, emotion_distribution, platform_breakdown')
      .order('day', { ascending: false })
      .limit(84),   // 12 weeks
    supabase
      .from('mentions')
      .select('id, content, author_handle, platform, sentiment_label, emotion_tags, reach, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('crawl_runs')
      .select('id, status, mentions_found')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('sentiment_daily')
      .select('day, social_score, positive_pct, negative_pct')
      .order('day', { ascending: true })
      .limit(400),   // ~13 months for heatmap
  ])

  const latest       = daily?.[0] ?? null
  const hasRanBefore = Boolean(lastRun)

  if (!latest && !mentions?.length) {
    return (
      <div className="border rounded-xl p-12 text-center space-y-4">
        <MessageCircle className="h-8 w-8 text-muted-foreground/40 mx-auto" />
        <div className="space-y-1">
          <p className="text-sm font-medium">No mentions crawled yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Your first crawl pulls the last 24 hours of mentions from your connected
            X and Instagram accounts. The nightly job runs at 4 AM Lagos time, or kick it off now.
          </p>
        </div>
        <TriggerCrawlButton hasRanBefore={hasRanBefore} />
      </div>
    )
  }

  const dailyRows = (daily ?? []) as DayRow[]
  const alerts    = computeAlerts(dailyRows)
  const weekly    = weeklyAggregate(dailyRows)

  const platformBreakdown = (latest?.platform_breakdown ?? {}) as NonNullable<DayRow['platform_breakdown']>
  const platformEntries   = Object.entries(platformBreakdown).sort((a, b) => b[1].volume - a[1].volume)

  // Aggregate emotion distribution across all 12 weeks
  const emotionTotals: Record<string, number> = {}
  for (const day of dailyRows) {
    const dist = day.emotion_distribution ?? {}
    for (const [emotion, count] of Object.entries(dist)) {
      emotionTotals[emotion] = (emotionTotals[emotion] ?? 0) + (count as number)
    }
  }

  const mentionTexts = (mentions ?? [])
    .filter(m => m.content && m.content.length > 10)
    .map(m => m.content as string)

  const heatmapData = (heatmapRaw ?? []).map(r => ({
    date:         r.day as string,
    score:        r.social_score as number | null,
    positive_pct: r.positive_pct as number | null,
    negative_pct: r.negative_pct as number | null,
  }))

  return (
    <div className="space-y-6">
      {/* Alert feed */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => {
            const Icon      = a.severity === 'critical' ? AlertTriangle : a.type === 'spike' ? TrendingUp : Info
            const colorClass =
              a.severity === 'critical' ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400' :
              a.severity === 'warning'  ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400' :
              'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-400'
            return (
              <div key={i} className={`flex items-start gap-2.5 border rounded-lg px-3.5 py-2.5 text-sm ${colorClass}`}>
                <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{a.message}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="border rounded-2xl p-5 bg-card card-shadow space-y-1.5">
          <p className="eyebrow">Sentiment score</p>
          <div className="flex items-baseline gap-1.5">
            <p className={`metric text-[34px] ${latest
              ? latest.social_score >= 60 ? 'text-green-500'
                : latest.social_score <= 40 ? 'text-red-500' : 'text-amber-500'
              : 'text-muted-foreground/30'}`}>
              {latest ? Math.round(latest.social_score) : '—'}
            </p>
            {latest && (
              latest.social_score >= 60
                ? <TrendingUp   className="h-4 w-4 text-green-500 mb-1" />
                : latest.social_score <= 40
                  ? <TrendingDown className="h-4 w-4 text-red-500 mb-1" />
                  : <Minus        className="h-4 w-4 text-muted-foreground/40 mb-1" />
            )}
          </div>
          {platformEntries.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {platformEntries.map(([p, s]) => (
                <span key={p} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border bg-muted/40 text-muted-foreground">
                  {PLATFORM_LABEL[p] ?? p}
                  <span className="font-bold text-foreground">{Math.round(s.score)}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="border rounded-2xl p-5 bg-card card-shadow space-y-1.5">
          <p className="eyebrow">Positive</p>
          <p className="metric text-[34px] text-green-500">
            {latest ? `${Math.round(latest.positive_pct)}%` : '—'}
          </p>
          <p className="text-[11px] text-muted-foreground/50">of mentions</p>
        </div>

        <div className="border rounded-2xl p-5 bg-card card-shadow space-y-1.5">
          <p className="eyebrow">Negative</p>
          <p className="metric text-[34px] text-red-500">
            {latest ? `${Math.round(latest.negative_pct)}%` : '—'}
          </p>
          <p className="text-[11px] text-muted-foreground/50">of mentions</p>
        </div>

        <div className="border rounded-2xl p-5 bg-card card-shadow space-y-1.5">
          <p className="eyebrow">Mentions</p>
          <p className="metric text-[34px]">{mentions?.length ?? 0}</p>
          <p className="text-[11px] text-muted-foreground/50">latest 50 shown</p>
        </div>
      </div>

      {/* 12-week trend */}
      {weekly.length >= 2 && (
        <div className="border rounded-2xl bg-card card-shadow p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow mb-1">12-Week Trend</p>
              <h3 className="text-[15px] font-semibold tracking-tight">Sentiment over time</h3>
            </div>
            <div className="flex items-center gap-4">
              {[
                { label: 'Score', color: '#2B59FF' },
                { label: 'Positive', color: '#22c55e' },
                { label: 'Negative', color: '#f87171' },
              ].map(l => (
                <div key={l.label} className="hidden sm:flex items-center gap-1.5">
                  <span className="h-[3px] w-4 rounded-full" style={{ background: l.color }} />
                  <span className="text-[11px] text-muted-foreground/55 font-medium">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <SentimentTrendChart data={weekly} weekly />
        </div>
      )}

      {/* Sentiment calendar heatmap */}
      {heatmapData.length > 0 && (
        <div className="border rounded-2xl bg-card card-shadow p-5 sm:p-6">
          <SentimentHeatmap data={heatmapData} />
        </div>
      )}

      {/* Platform breakdown + Emotion wheel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Platform breakdown */}
        {platformEntries.length > 0 && (
          <div className="border rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold">By platform</p>
            {platformEntries.map(([platform, stats]) => (
              <div key={platform} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">
                    {platform === 'twitter' ? 'X (Twitter)' : 'Instagram'}
                  </span>
                  <span className="text-xs text-muted-foreground">{stats.volume} mentions</span>
                </div>
                {(['positive', 'neutral', 'negative'] as const).map(label => {
                  const pct =
                    label === 'positive' ? stats.positive_pct :
                    label === 'negative' ? stats.negative_pct :
                    stats.neutral_pct
                  return (
                    <div key={label} className="space-y-0.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="capitalize">{label}</span>
                        <span>{Math.round(pct)}%</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${SENTIMENT_BAR[label]}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* Emotion wheel */}
        {Object.keys(emotionTotals).length > 0 && (
          <div className="border rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold">Emotion distribution</p>
            <p className="text-xs text-muted-foreground -mt-1">Aggregated across 12 weeks</p>
            <EmotionWheel distribution={emotionTotals} />
          </div>
        )}
      </div>

      {/* Topic clusters */}
      {mentionTexts.length >= 3 && (
        <TopicClusters mentions={mentionTexts} />
      )}

      {/* Recent mentions with dispute feedback */}
      {mentions && mentions.length > 0 && (
        <MentionsList initialMentions={mentions as Parameters<typeof MentionsList>[0]['initialMentions']} />
      )}

      <div className="flex justify-end">
        <TriggerCrawlButton hasRanBefore />
      </div>
    </div>
  )
}

export default function SentimentPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sentiment</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Public perception · X and Instagram · 12-week view · nightly at 4 AM Lagos time
          </p>
        </div>
        <CrawlHistory />
      </div>

      <Suspense fallback={
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-56 rounded-xl" />
        </div>
      }>
        <SentimentData />
      </Suspense>
    </div>
  )
}
