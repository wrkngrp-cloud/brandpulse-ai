import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, Minus, MessageCircle } from 'lucide-react'
import { TriggerCrawlButton } from './trigger-crawl-button'

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

function ScoreIcon({ score }: { score: number }) {
  if (score >= 60) return <TrendingUp className="h-4 w-4 text-green-600" />
  if (score <= 40) return <TrendingDown className="h-4 w-4 text-red-500" />
  return <Minus className="h-4 w-4 text-muted-foreground" />
}

async function SentimentData() {
  const supabase = await createClient()

  const [{ data: daily }, { data: mentions }] = await Promise.all([
    supabase
      .from('sentiment_daily')
      .select('day, social_score, positive_pct, neutral_pct, negative_pct, emotion_distribution')
      .order('day', { ascending: false })
      .limit(7),
    supabase
      .from('mentions')
      .select('id, content, author_handle, sentiment_label, emotion_tags, reach, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const latest = daily?.[0]
  const totalMentions = mentions?.length ?? 0

  if (!latest && totalMentions === 0) {
    return (
      <div className="border rounded-xl p-12 text-center space-y-4">
        <MessageCircle className="h-8 w-8 text-muted-foreground/40 mx-auto" />
        <div className="space-y-1">
          <p className="text-sm font-medium">No mentions crawled yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Your first crawl pulls the last 24 hours of X mentions for your brand.
            The nightly job runs at 4 AM Lagos time, or kick it off now.
          </p>
        </div>
        <TriggerCrawlButton />
      </div>
    )
  }

  // Top emotions
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
          <p className="text-xs text-muted-foreground">out of 100</p>
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

      {/* Sentiment bar + emotions */}
      {latest && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium">Sentiment breakdown</p>
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

      {/* 7-day trend */}
      {daily && daily.length > 1 && (
        <div className="border rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium">7-day trend</p>
          <div className="flex items-end gap-1.5 h-16">
            {[...daily].reverse().map(d => {
              const height = Math.max(4, Math.round((d.social_score / 100) * 64))
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-sm bg-foreground/20 hover:bg-foreground/40 transition-colors"
                    style={{ height: `${height}px` }}
                    title={`${d.day}: ${Math.round(d.social_score)}`}
                  />
                  <span className="text-[9px] text-muted-foreground">
                    {new Date(d.day).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              )
            })}
          </div>
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
                  <span className="text-xs text-muted-foreground">
                    @{m.author_handle || 'unknown'}
                  </span>
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
    </div>
  )
}

export default function SentimentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sentiment</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Public perception · X mentions · nightly at 4 AM Lagos time
        </p>
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
