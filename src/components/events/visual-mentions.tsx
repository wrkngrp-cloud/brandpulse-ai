'use client'

import { useState } from 'react'
import { Camera, ExternalLink, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react'

interface VisualMention {
  id:                string
  post_url:          string | null
  media_url:         string
  hashtag:           string | null
  creator_username:  string | null
  post_caption:      string | null
  post_likes:        number
  post_comments:     number
  brand_visible:     boolean
  confidence:        string | null
  detected_elements: string[] | null
  visual_sentiment:  string | null
  ai_description:    string | null
  detected_at:       string
}

interface Props {
  eventId:       string
  initialData:   VisualMention[]
  hasIgConnection: boolean
  hasHashtags:   boolean
}

const CONFIDENCE_STYLE: Record<string, string> = {
  high:   'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  low:    'bg-muted text-muted-foreground',
}

const SENTIMENT_DOT: Record<string, string> = {
  positive: 'bg-green-500',
  neutral:  'bg-muted-foreground',
  negative: 'bg-red-500',
}

function MentionCard({ m }: { m: VisualMention }) {
  return (
    <div className={`border rounded-xl overflow-hidden bg-card ${!m.brand_visible ? 'opacity-50' : ''}`}>
      {/* Image */}
      <div className="relative w-full aspect-square bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={m.media_url}
          alt={m.ai_description ?? 'Event photo'}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {/* Visibility badge */}
        <div className="absolute top-2 left-2">
          {m.brand_visible
            ? <CheckCircle2 className="h-5 w-5 text-green-500 drop-shadow" />
            : <XCircle      className="h-5 w-5 text-muted-foreground/60 drop-shadow" />}
        </div>
        {/* Confidence */}
        {m.confidence && (
          <span className={`absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${CONFIDENCE_STYLE[m.confidence] ?? ''}`}>
            {m.confidence}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        {/* Detected elements */}
        {m.brand_visible && (m.detected_elements ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(m.detected_elements ?? []).map(el => (
              <span key={el} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md capitalize">
                {el}
              </span>
            ))}
          </div>
        )}

        {/* AI description */}
        {m.ai_description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {m.ai_description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {m.visual_sentiment && (
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${SENTIMENT_DOT[m.visual_sentiment] ?? 'bg-muted'}`} />
            )}
            {m.creator_username && <span>@{m.creator_username}</span>}
            {m.hashtag && <span className="text-muted-foreground/50">#{m.hashtag}</span>}
          </div>
          {m.post_url && (
            <a
              href={m.post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export function VisualMentions({ eventId, initialData, hasIgConnection, hasHashtags }: Props) {
  const [mentions, setMentions] = useState<VisualMention[]>(initialData)
  const [scanning, setScanning] = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [lastScan, setLastScan] = useState<{ processed: number; brandDetected: number } | null>(null)

  const visible    = mentions.filter(m => m.brand_visible)
  const notVisible = mentions.filter(m => !m.brand_visible)

  async function runScan() {
    setScanning(true)
    setError(null)
    try {
      const res = await fetch('/api/event/visual-scan', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ eventId }),
      })
      const data = await res.json() as {
        processed?: number
        brandDetected?: number
        mentions?: VisualMention[]
        error?: string
      }
      if (!res.ok || data.error) {
        setError(data.error ?? 'Scan failed')
        return
      }
      if (data.mentions) setMentions(data.mentions)
      setLastScan({ processed: data.processed ?? 0, brandDetected: data.brandDetected ?? 0 })
    } catch {
      setError('Network error — please try again')
    } finally {
      setScanning(false)
    }
  }

  const canScan = hasIgConnection && hasHashtags

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Visual brand mentions</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            BrandPulse AI scans event hashtag photos for logos, merch, and branded materials
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning || !canScan}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {scanning
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : mentions.length > 0
              ? <RefreshCw className="h-3.5 w-3.5" />
              : <Camera className="h-3.5 w-3.5" />}
          {scanning ? 'Scanning…' : mentions.length > 0 ? 'Re-scan' : 'Scan now'}
        </button>
      </div>

      {/* Blockers */}
      {!hasIgConnection && (
        <div className="border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-400">
          Connect Instagram in Settings to enable visual brand detection.
        </div>
      )}
      {hasIgConnection && !hasHashtags && (
        <div className="border rounded-xl p-4 text-sm text-muted-foreground">
          Add hashtags to this event to enable visual detection.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Scan summary */}
      {lastScan && (
        <div className="border rounded-xl px-4 py-3 bg-card flex items-center gap-6 text-sm">
          <span><span className="font-semibold">{lastScan.processed}</span> photos scanned</span>
          <span><span className="font-semibold text-green-600">{lastScan.brandDetected}</span> brand visible</span>
          <span className="text-muted-foreground">{lastScan.processed - lastScan.brandDetected} not detected</span>
        </div>
      )}

      {/* Empty */}
      {!scanning && mentions.length === 0 && canScan && !error && (
        <div className="border rounded-xl p-8 text-center text-sm text-muted-foreground">
          <Camera className="h-8 w-8 mx-auto mb-3 opacity-30" />
          No scans yet. Click "Scan now" to detect brand presence in event photos.
        </div>
      )}

      {/* Brand-visible grid */}
      {visible.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-green-600">
            Brand detected — {visible.length} photo{visible.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {visible.map(m => <MentionCard key={m.id} m={m} />)}
          </div>
        </div>
      )}

      {/* Not-detected grid (collapsed by default if there are visible ones) */}
      {notVisible.length > 0 && visible.length > 0 && (
        <details className="group">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-1 select-none">
            <span className="group-open:hidden">▶</span>
            <span className="hidden group-open:inline">▼</span>
            {notVisible.length} photo{notVisible.length !== 1 ? 's' : ''} — brand not detected
          </summary>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
            {notVisible.map(m => <MentionCard key={m.id} m={m} />)}
          </div>
        </details>
      )}

      {/* All not-detected (no brand visible at all) */}
      {notVisible.length > 0 && visible.length === 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Brand not detected in any of the {notVisible.length} scanned photo{notVisible.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {notVisible.map(m => <MentionCard key={m.id} m={m} />)}
          </div>
        </div>
      )}
    </div>
  )
}
