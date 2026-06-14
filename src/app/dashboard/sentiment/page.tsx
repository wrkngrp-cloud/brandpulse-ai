import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, Minus, MessageCircle, AlertTriangle, Info } from 'lucide-react'
import { TriggerCrawlButton } from './trigger-crawl-button'
import { CrawlHistory } from './crawl-history'
import { SentimentTrendChart } from './sentiment-trend-chart'
import { EmotionWheel } from './emotion-wheel'
import { TopicClusters } from './topic-clusters'

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

  const [{ data: daily }, { data: mentions }, { data: lastRun }] = await Promise.all([
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
        <div className="border rounded-xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Sentiment score</p>
          <div className="flex items-center gap-1.5">
            <p className="text-2xl font-bold">
              {latest ? Math.round(latest.social_score) : '—'}
            </p>
            {latest && (
              latest.social_score >= 60
                ? <TrendingUp   className="h-4 w-4 text-green-600" />
                : latest.social_score <= 40
                  ? <TrendingDown className="h-4 w-4 text-red-500" />
                  : <Minus        className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          {platformEntries.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {platformEntries.map(([p, s]) => (
                <span key={p} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border bg-muted/40 text-muted-foreground">
                  {PLATFORM_LABEL[p] ?? p}
                  <span className="font-bold text-foreground">{Math.round(s.score)}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="border rounded-xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Positive</p>
          <p className="text-2xl font-bold text-green-600">
            {latest ? `${Math.round(latest.positive_pct)}%` : '—'}
          </p>
          <p className="text-xs text-muted-foreground">of mentions</p>
        </div>

        <div className="border rounded-xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Negative</p>
          <p className="text-2xl font-bold text-red-500">
            {latest ? `${Math.round(latest.negative_pct)}%` : '—'}
          </p>
          <p className="text-xs text-muted-foreground">of mentions</p>
        </div>

        <div className="border rounded-xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Mentions crawled</p>
          <p className="text-2xl font-bold">{mentions?.length ?? 0}</p>
          <p className="text-xs text-muted-foreground">shown (latest 50)</p>
        </div>
      </div>

      {/* 12-week trend */}
      {weekly.length >= 2 && (
        <div className="border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">12-week sentiment trend</p>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-foreground" />score</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-green-500 opacity-70" />positive</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-red-400 opacity-70" />negative</span>
            </div>
          </div>
          <SentimentTrendChart data={weekly} weekly />
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

      {/* Recent mentions */}
      {mentions && mentions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Recent mentions</p>
          <div className="border rounded-xl divide-y overflow-hidden">
            {mentions.slice(0, 20).map(m => (
              <div key={m.id} className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                      {PLATFORM_LABEL[m.platform as string] ?? m.platform}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {m.author_handle ? `@${m.author_handle}` : 'unknown'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {m.sentiment_label && (
                      <span className={`text-xs font-medium capitalize ${
                        m.sentiment_label === 'positive' ? 'text-green-600' :
                        m.sentiment_label === 'negative' ? 'text-red-500' :
                        m.sentiment_label === 'mixed'    ? 'text-amber-500' :
                        'text-muted-foreground'
                      }`}>
                        {m.sentiment_label}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(m.created_at as string).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
                <p className="text-sm leading-snug line-clamp-2">{m.content}</p>
              </div>
            ))}
          </div>
        </div>
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
