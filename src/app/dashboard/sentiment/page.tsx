import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, Minus, MessageCircle } from 'lucide-react'
import { TriggerCrawlButton } from './trigger-crawl-button'
import { CrawlHistory } from './crawl-history'
import { SentimentTrendChart } from './sentiment-trend-chart'

const SENTIMENT_COLOURS: Record<string, string> = {
  positive: 'text-green-600',
  neutral:  'text-muted-foreground',
  negative: 'text-red-500',
  mixed:    'text-amber-500',
}

const SENTIMENT_BAR: Record<string, string> = {
  positive: 'bg-green-500',
  neutral:  'bg-muted-foreground/40',
  negative: 'bg-red-400',
}

const PLATFORM_LABEL: Record<string, string> = {
  twitter:   'X',
  instagram: 'IG',
}

function ScoreIcon({ score }: { score: number }) {
  if (score >= 60) return <TrendingUp className="h-4 w-4 text-green-600" />
  if (score <= 40) return <TrendingDown className="h-4 w-4 text-red-500" />
  return <Minus className="h-4 w-4 text-muted-foreground" />
}

function PlatformPill({ platform, score, volume }: { platform: string; score: number; volume: number }) {
  const label = PLATFORM_LABEL[platform] ?? platform
  const colour =
    score >= 65 ? 'bg-green-50 text-green-700 border-green-200' :
    score <= 40 ? 'bg-red-50 text-red-600 border-red-200' :
    'bg-muted text-muted-foreground border-border'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${colour}`}>
      {label}
      <span className="font-bold">{Math.round(score)}</span>
      <span className="opacity-60">· {volume}</span>
    </span>
  )
}

async function SentimentData() {
  const supabase = await createClient()

  const [{ data: daily }, { data: mentions }, { data: lastRun }] = await Promise.all([
    supabase
      .from('sentiment_daily')
      .select('day, social_score, positive_pct, neutral_pct, negative_pct, emotion_distribution, platform_breakdown')
      .order('day', { ascending: false })
      .limit(7),
    supabase
      .from('mentions')
      .select('id, content, author_handle, platform, sentiment_label, emotion_tags, reach, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('crawl_runs')
      .select('id, status, mentions_found')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const latest        = daily?.[0]
  const totalMentions = mentions?.length ?? 0
  const hasRanBefore  = Boolean(lastRun)

  const platformBreakdown = (latest?.platform_breakdown ?? {}) as Record<string, {
    volume: number; score: number; positive_pct: number; neutral_pct: number; negative_pct: number
  }>
  const platformEntries = Object.entries(platformBreakdown).sort((a, b) => b[1].volume - a[1].volume)

  if (!latest && totalMentions === 0) {
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

  const emotionDist = (latest?.emotion_distribution ?? {}) as Record<string, number>
  const topEmotions = Object.entries(emotionDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  return (
    <div className="space-y-6">
      {/* Score cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="border rounded-xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Sentiment score</p>
          <div className="flex items-center gap-1.5">
            <p className="text-2xl font-bold">
              {latest ? Math.round(latest.social_score) : '—'}
            </p>
            {latest && <ScoreIcon score={latest.social_score} />}
          </div>
          {/* Per-platform pills */}
          {platformEntries.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {platformEntries.map(([platform, stats]) => (
                <PlatformPill
                  key={platform}
                  platform={platform}
                  score={stats.score}
                  volume={stats.volume}
                />
              ))}
            </div>
          )}
          {platformEntries.length === 0 && (
            <p className="text-xs text-muted-foreground">out of 100</p>
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
          <p className="text-2xl font-bold">{totalMentions}</p>
          <p className="text-xs text-muted-foreground">last 24 h</p>
        </div>
      </div>

      {/* Per-platform breakdown panel (only when both platforms have data) */}
      {platformEntries.length > 1 && (
        <div className="border rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium">By platform</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {platformEntries.map(([platform, stats]) => (
              <div key={platform} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">
                    {platform === 'twitter' ? 'X (Twitter)' : 'Instagram'}
                  </span>
                  <span className="text-xs text-muted-foreground">{stats.volume} mentions</span>
                </div>
                {(['positive', 'neutral', 'negative'] as const).map(label => {
                  const pct = label === 'positive'
                    ? stats.positive_pct
                    : label === 'negative'
                      ? stats.negative_pct
                      : stats.neutral_pct
                  return (
                    <div key={label} className="space-y-0.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="capitalize">{label}</span>
                        <span>{Math.round(pct)}%</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${SENTIMENT_BAR[label]}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                <p className="text-xs text-muted-foreground pt-0.5">
                  Score: <span className="font-medium text-foreground">{Math.round(stats.score)}</span> / 100
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sentiment bar + emotions */}
      {latest && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium">Overall breakdown</p>
            {(['positive', 'neutral', 'negative'] as const).map(label => {
              const pct = label === 'positive'
                ? latest.positive_pct
                : label === 'negative'
                  ? latest.negative_pct
                  : latest.neutral_pct
              return (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="capitalize text-muted-foreground">{label}</span>
                    <span className="font-medium">{Math.round(pct)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${SENTIMENT_BAR[label]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {topEmotions.length > 0 && (
            <div className="border rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium">Top emotions</p>
              {topEmotions.map(([emotion, count]) => (
                <div key={emotion} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-muted-foreground">{emotion}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 7-day trend — Recharts line chart */}
      {daily && daily.length > 1 && (
        <div className="border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">7-day trend</p>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-foreground" /> sentiment score</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-green-500" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #22c55e 0, #22c55e 4px, transparent 4px, transparent 6px)' }} /> positive %</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-red-400" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #f87171 0, #f87171 4px, transparent 4px, transparent 6px)' }} /> negative %</span>
            </div>
          </div>
          <SentimentTrendChart
            data={[...daily].reverse().map(d => ({
              day:      d.day,
              score:    d.social_score,
              positive: d.positive_pct,
              negative: d.negative_pct,
            }))}
          />
        </div>
      )}

      {/* Recent mentions */}
      {mentions && mentions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Recent mentions</p>
          <div className="border rounded-xl divide-y overflow-hidden">
            {mentions.map(m => (
              <div key={m.id} className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                      {PLATFORM_LABEL[m.platform] ?? m.platform}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {m.author_handle ? `@${m.author_handle}` : 'unknown'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {m.sentiment_label && (
                      <span className={`text-xs font-medium capitalize ${SENTIMENT_COLOURS[m.sentiment_label] ?? ''}`}>
                        {m.sentiment_label}
                      </span>
                    )}
                    {!m.sentiment_label && (
                      <span className="text-xs text-muted-foreground/50">unclassified</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
                <p className="text-sm leading-snug line-clamp-2">{m.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual crawl trigger */}
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
            Public perception · X and Instagram · nightly at 4 AM Lagos time
          </p>
        </div>
        <CrawlHistory />
      </div>

      <Suspense fallback={
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-48 rounded-xl" />
        </div>
      }>
        <SentimentData />
      </Suspense>
    </div>
  )
}
