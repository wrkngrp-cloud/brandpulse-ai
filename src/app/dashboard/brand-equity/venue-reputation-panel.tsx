'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Star, MapPin, RefreshCw, TrendingUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface RecentReview {
  text?:   string
  rating?: number
  author?: string
  time?:   number
}

interface VenueSnapshot {
  rating:          number | null
  review_count:    number | null
  review_velocity: number | null
  period_end:      string | null
  metadata:        { recent_reviews?: RecentReview[] } | null
}

interface Props {
  snapshot:    VenueSnapshot | null
  hasPlaceId:  boolean
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => {
        const fill = Math.max(0, Math.min(1, rating - (i - 1)))
        return (
          <div key={i} className="relative h-5 w-5">
            <Star className="absolute inset-0 h-5 w-5 text-amber-300/40" />
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function VenueReputationPanel({ snapshot, hasPlaceId }: Props) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)

  async function handleSync() {
    setSyncing(true)
    try {
      const res  = await fetch('/api/venue/sync-maps', { method: 'POST' })
      const data = await res.json() as { success?: boolean; rating?: number; error?: string }
      if (!res.ok || !data.success) {
        toast.error(data.error ?? 'Sync failed')
        return
      }
      toast.success(`Synced — Google Maps rating ${data.rating?.toFixed(1)} ★`)
      router.refresh()
    } catch {
      toast.error('Network error during sync')
    } finally {
      setSyncing(false)
    }
  }

  // ── Empty state: no Place ID configured ───────────────────────────────────
  if (!hasPlaceId) {
    return (
      <div className="rounded-xl border bg-card p-5 space-y-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          <h2 className="text-sm font-semibold">Venue Reputation</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Add your Google Place ID in Brand Settings to track your venue reputation — star
          rating, review volume, and how fast new reviews are coming in.
        </p>
      </div>
    )
  }

  const rating   = snapshot?.rating ?? null
  const count    = snapshot?.review_count ?? null
  const velocity = snapshot?.review_velocity ?? null
  const reviews  = (snapshot?.metadata?.recent_reviews ?? []).slice(0, 3)

  const lastSynced = snapshot?.period_end
    ? new Date(snapshot.period_end).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="rounded-xl border bg-card p-5 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <h2 className="text-sm font-semibold">Venue Reputation</h2>
            <p className="text-xs text-muted-foreground">Google Maps star rating and review velocity</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
          {syncing
            ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
          Sync now
        </Button>
      </div>

      {rating == null ? (
        <p className="text-sm text-muted-foreground">
          No reputation data yet. Press Sync now to pull your latest Google Maps rating.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold tabular-nums">{rating.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">/ 5</span>
              </div>
              <div className="mt-1.5"><Stars rating={rating} /></div>
            </div>

            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {count != null ? count.toLocaleString('en-NG') : '—'}
              </p>
              <p className="text-xs text-muted-foreground">total reviews</p>
            </div>

            <div>
              <p className={cn(
                'text-2xl font-semibold tabular-nums flex items-center gap-1',
                velocity && velocity > 0 ? 'text-green-600' : 'text-muted-foreground',
              )}>
                {velocity && velocity > 0 && <TrendingUp className="h-4 w-4" />}
                {velocity != null ? `+${velocity}` : '—'}
              </p>
              <p className="text-xs text-muted-foreground">new this period</p>
            </div>
          </div>

          {reviews.length > 0 && (
            <div className="space-y-2.5 border-t pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recent reviews
              </p>
              {reviews.map((r, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  {r.rating != null && (
                    <span className="shrink-0 mt-0.5 inline-flex items-center gap-0.5 text-xs font-medium text-amber-600">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {r.rating}
                    </span>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {r.text ? (r.text.length > 120 ? `${r.text.slice(0, 120)}…` : r.text) : 'No comment'}
                  </p>
                </div>
              ))}
            </div>
          )}

          {lastSynced && (
            <p className="text-xs text-muted-foreground">Last synced {lastSynced}</p>
          )}
        </>
      )}
    </div>
  )
}
