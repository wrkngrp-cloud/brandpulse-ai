'use client'

import { MessageSquareText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AspectScore {
  aspect: string
  sentiment: 'positive' | 'neutral' | 'negative'
  score: number
  mention_count: number
}

interface Props {
  aspects: AspectScore[]
  platform: string // 'google_maps' | 'app_store' | 'play_store'
  brandType: string
}

const ASPECT_LABELS: Record<string, string> = {
  food:            'Food & Drinks',
  service:         'Service',
  ambiance:        'Atmosphere',
  value:           'Value for Money',
  reliability:     'Reliability',
  feature_quality: 'Product Features',
  support:         'Customer Support',
  price_fairness:  'Pricing',
  music:           'Music & Vibe',
  cleanliness:     'Cleanliness',
}

const PLATFORM_LABELS: Record<string, string> = {
  google_maps: 'Google Maps',
  app_store:   'App Store',
  play_store:  'Play Store',
}

const SENTIMENT_STYLES: Record<AspectScore['sentiment'], { badge: string; bar: string; label: string }> = {
  positive: { badge: 'bg-green-100 text-green-700', bar: 'bg-green-500',  label: 'Positive' },
  neutral:  { badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-400',  label: 'Neutral'  },
  negative: { badge: 'bg-red-100 text-red-700',     bar: 'bg-red-500',    label: 'Negative' },
}

export function AspectSentimentPanel({ aspects, platform }: Props) {
  const sorted = [...aspects]
    .sort((a, b) => b.mention_count - a.mention_count)
    .slice(0, 8)

  return (
    <div className="rounded-xl border bg-card p-5 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <h2 className="text-sm font-semibold">Review Aspects</h2>
            <p className="text-xs text-muted-foreground">What people praise and complain about</p>
          </div>
        </div>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          {PLATFORM_LABELS[platform] ?? platform}
        </span>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Not enough review text yet — aspects will appear once reviews are collected.
        </p>
      ) : (
        <div className="space-y-4">
          {sorted.map((a) => {
            const styles = SENTIMENT_STYLES[a.sentiment]
            return (
              <div key={`${a.aspect}`} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">
                      {ASPECT_LABELS[a.aspect] ?? a.aspect}
                    </span>
                    <span className={cn('text-[11px] font-medium px-1.5 py-0.5 rounded-full shrink-0', styles.badge)}>
                      {styles.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold tabular-nums">{a.score}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {a.mention_count} {a.mention_count === 1 ? 'mention' : 'mentions'}
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', styles.bar)}
                    style={{ width: `${Math.max(0, Math.min(100, a.score))}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
