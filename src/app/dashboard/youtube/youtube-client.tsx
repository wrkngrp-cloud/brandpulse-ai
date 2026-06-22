'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  PlayCircle, ExternalLink, Eye, ThumbsUp, MessageSquare,
  RefreshCw, Plus, Settings, CheckCircle2,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface YtMention {
  id: string
  video_id: string
  video_title: string | null
  channel_name: string | null
  view_count: number
  like_count: number
  comment_count: number
  published_at: string | null
  sentiment_score: number | null
  comment_sample: { text: string; like_count: number }[] | null
  is_partnership: boolean
  found_at: string
}

interface YtDeal {
  id: string
  channel_name: string
  channel_url: string | null
  video_url: string | null
  video_id: string | null
  deliverables: string | null
  fee_ngn: number | null
  promo_code: string | null
  view_guarantee: number | null
  actual_views: number | null
  linked_campaign_id: string | null
  deal_date: string | null
  created_at: string
}

interface Campaign {
  id: string
  name: string
}

interface Props {
  mentions:      YtMention[]
  deals:         YtDeal[]
  campaigns:     Campaign[]
  isConnected:   boolean
  lastSyncedAt:  string | null
  brandId:       string
}

function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K views`
  return `${n} views`
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtNGN(n: number | null): string {
  if (n == null) return '—'
  return `₦${Number(n).toLocaleString('en-NG')}`
}

function SentimentBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>
  const label = score >= 65 ? 'Positive' : score >= 40 ? 'Mixed' : 'Negative'
  const cls   = score >= 65
    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    : score >= 40
    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cls)}>
      {label} ({score})
    </span>
  )
}

function SetupPrompt({ onSaved }: { onSaved: () => void }) {
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!apiKey.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/connectors/youtube/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return }
      toast.success('YouTube API key saved')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border rounded-xl p-5 bg-card space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
          <PlayCircle className="h-4 w-4 text-red-600" />
        </div>
        <div>
          <p className="text-sm font-semibold">Connect YouTube Data API</p>
          <p className="text-xs text-muted-foreground">Add a Google Cloud project API key to start monitoring brand mentions.</p>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="yt-api-key">YouTube Data API v3 key</Label>
        <div className="flex gap-2">
          <Input
            id="yt-api-key"
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="AIza..."
            className="flex-1"
          />
          <Button onClick={handleSave} disabled={saving || !apiKey.trim()} size="sm">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Create a key in{' '}
          <a
            href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Google Cloud Console
          </a>
          {' '}with YouTube Data API v3 enabled.
        </p>
      </div>
    </div>
  )
}

interface DealFormData {
  channel_name:       string
  channel_url:        string
  video_url:          string
  deliverables:       string
  fee_ngn:            string
  promo_code:         string
  view_guarantee:     string
  linked_campaign_id: string
  deal_date:          string
}

const DEAL_INIT: DealFormData = {
  channel_name: '', channel_url: '', video_url: '', deliverables: '',
  fee_ngn: '', promo_code: '', view_guarantee: '', linked_campaign_id: '', deal_date: '',
}

function AddDealDialog({ campaigns, brandId, onAdded }: { campaigns: Campaign[]; brandId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<DealFormData>(DEAL_INIT)
  const [saving, setSaving] = useState(false)

  function setF(key: keyof DealFormData, val: string) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function handleSubmit() {
    if (!form.channel_name.trim()) { toast.error('Channel name is required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/youtube/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_name:       form.channel_name.trim(),
          channel_url:        form.channel_url.trim() || null,
          video_url:          form.video_url.trim() || null,
          deliverables:       form.deliverables.trim() || null,
          fee_ngn:            form.fee_ngn ? parseFloat(form.fee_ngn) : null,
          promo_code:         form.promo_code.trim() || null,
          view_guarantee:     form.view_guarantee ? parseInt(form.view_guarantee) : null,
          linked_campaign_id: form.linked_campaign_id || null,
          deal_date:          form.deal_date || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to save deal'); return }
      toast.success('Creator deal logged')
      setOpen(false)
      setForm(DEAL_INIT)
      onAdded()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add deal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log creator deal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Channel name *</Label>
            <Input value={form.channel_name} onChange={e => setF('channel_name', e.target.value)} placeholder="e.g. TechNaija" />
          </div>
          <div className="space-y-2">
            <Label>Channel URL</Label>
            <Input value={form.channel_url} onChange={e => setF('channel_url', e.target.value)} placeholder="https://youtube.com/@..." />
          </div>
          <div className="space-y-2">
            <Label>Video URL</Label>
            <Input value={form.video_url} onChange={e => setF('video_url', e.target.value)} placeholder="https://youtube.com/watch?v=..." />
          </div>
          <div className="space-y-2">
            <Label>Deliverables</Label>
            <Input value={form.deliverables} onChange={e => setF('deliverables', e.target.value)} placeholder="e.g. 60s integration + end card" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fee (₦)</Label>
              <Input type="number" min={0} value={form.fee_ngn} onChange={e => setF('fee_ngn', e.target.value)} placeholder="500000" />
            </div>
            <div className="space-y-2">
              <Label>Promo code</Label>
              <Input value={form.promo_code} onChange={e => setF('promo_code', e.target.value)} placeholder="BRAND20" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>View guarantee</Label>
              <Input type="number" min={0} value={form.view_guarantee} onChange={e => setF('view_guarantee', e.target.value)} placeholder="50000" />
            </div>
            <div className="space-y-2">
              <Label>Deal date</Label>
              <Input type="date" value={form.deal_date} onChange={e => setF('deal_date', e.target.value)} />
            </div>
          </div>
          {campaigns.length > 0 && (
            <div className="space-y-2">
              <Label>Link to campaign</Label>
              <Select value={form.linked_campaign_id} onValueChange={v => setF('linked_campaign_id', v === '__none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select campaign (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {campaigns.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving…' : 'Log deal'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function PlayCircleClient({ mentions, deals, campaigns, isConnected, lastSyncedAt, brandId }: Props) {
  const [tab, setTab] = useState<'mentions' | 'deals'>('mentions')
  const [connected, setConnected] = useState(isConnected)
  const [running, startRun] = useTransition()
  const [localDeals, setLocalDeals] = useState<YtDeal[]>(deals)

  function handleRunMonitor() {
    startRun(async () => {
      const res = await fetch('/api/inngest/trigger-youtube', { method: 'POST' })
      if (!res.ok) { toast.error('Failed to trigger monitor'); return }
      toast.success('YouTube monitor triggered — results will appear shortly.')
    })
  }

  const viewDeliveryPct = (deal: YtDeal) => {
    if (!deal.view_guarantee || !deal.actual_views) return null
    return Math.round((deal.actual_views / deal.view_guarantee) * 100)
  }

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center gap-0 border-b">
        {(['mentions', 'deals'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize',
              tab === t
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'mentions' ? <PlayCircle className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
            {t === 'mentions' ? 'Brand Mentions' : 'Creator Deals'}
          </button>
        ))}
      </div>

      {/* Brand Mentions tab */}
      {tab === 'mentions' && (
        <div className="space-y-4">
          {/* Connection status card */}
          {!connected ? (
            <SetupPrompt onSaved={() => setConnected(true)} />
          ) : (
            <div className="border rounded-xl p-4 bg-card flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">YouTube monitoring active</p>
                  {lastSyncedAt && (
                    <p className="text-xs text-muted-foreground">Last sync: {fmtDate(lastSyncedAt)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/dashboard/connectors" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <Settings className="h-3 w-3" />
                  Settings
                </Link>
                <Button size="sm" variant="outline" onClick={handleRunMonitor} disabled={running}>
                  {running
                    ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />Running…</>
                    : <><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Run monitor</>
                  }
                </Button>
              </div>
            </div>
          )}

          {/* Mention cards */}
          {mentions.length === 0 ? (
            <div className="border rounded-xl p-12 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                <PlayCircle className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">No YouTube mentions found yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {connected
                    ? 'Run the monitor above to fetch recent mentions of your brand.'
                    : 'Add your YouTube API key in Connectors to start monitoring.'}
                </p>
              </div>
              {!connected && (
                <Link href="/dashboard/connectors" className="text-xs text-primary underline">
                  Go to Connectors
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {mentions.map(m => (
                <div key={m.id} className="border rounded-xl p-5 bg-card space-y-4">
                  <div className="flex items-start gap-4">
                    {/* Thumbnail */}
                    <div className="shrink-0 w-28 h-16 rounded-lg overflow-hidden bg-muted">
                      <img
                        src={`https://img.youtube.com/vi/${m.video_id}/mqdefault.jpg`}
                        alt={m.video_title ?? 'Video thumbnail'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold line-clamp-2">
                            {m.video_title ?? 'Untitled video'}
                          </p>
                          <p className="text-xs text-muted-foreground">{m.channel_name}</p>
                        </div>
                        <a
                          href={`https://youtube.com/watch?v=${m.video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {fmtViews(m.view_count)}
                        </span>
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          {m.like_count.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {m.comment_count.toLocaleString()}
                        </span>
                        {m.published_at && (
                          <span>{fmtDate(m.published_at)}</span>
                        )}
                        <SentimentBadge score={m.sentiment_score} />
                      </div>
                    </div>
                  </div>

                  {/* Comment snippets */}
                  {m.comment_sample && m.comment_sample.length > 0 && (
                    <div className="border-t pt-3 space-y-2">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Top comments
                      </p>
                      {m.comment_sample.slice(0, 3).map((c, i) => (
                        <p key={i} className="text-xs text-muted-foreground line-clamp-2 pl-2 border-l-2 border-border">
                          {c.text}
                          {c.like_count > 0 && (
                            <span className="ml-2 text-muted-foreground/60">· {c.like_count} likes</span>
                          )}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Creator Deals tab */}
      {tab === 'deals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {localDeals.length} deal{localDeals.length !== 1 ? 's' : ''} logged
            </p>
            <AddDealDialog
              campaigns={campaigns}
              brandId={brandId}
              onAdded={() => {
                // Refresh the page to get updated deals
                window.location.reload()
              }}
            />
          </div>

          {localDeals.length === 0 ? (
            <div className="border rounded-xl p-12 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                <TrendingUp className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">No creator deals yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Log your first YouTube creator partnership to track views and ROI.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {localDeals.map(deal => {
                const delivPct = viewDeliveryPct(deal)
                return (
                  <div key={deal.id} className="border rounded-xl p-5 bg-card space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold">{deal.channel_name}</p>
                        {deal.deliverables && (
                          <p className="text-xs text-muted-foreground">{deal.deliverables}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        <p className="text-sm font-semibold">{fmtNGN(deal.fee_ngn)}</p>
                        {deal.deal_date && (
                          <p className="text-xs text-muted-foreground">{fmtDate(deal.deal_date)}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      {deal.video_url && (
                        <a
                          href={deal.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View video
                        </a>
                      )}
                      {deal.promo_code && (
                        <span className="bg-muted px-2 py-0.5 rounded font-mono">{deal.promo_code}</span>
                      )}
                      {deal.view_guarantee && (
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {deal.view_guarantee.toLocaleString()} view guarantee
                        </span>
                      )}
                    </div>

                    {deal.view_guarantee != null && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">View delivery</span>
                          <span className={cn(
                            'font-medium',
                            delivPct == null ? 'text-muted-foreground'
                              : delivPct >= 100 ? 'text-green-600'
                              : delivPct >= 70 ? 'text-amber-500'
                              : 'text-red-500',
                          )}>
                            {deal.actual_views != null
                              ? `${deal.actual_views.toLocaleString()} / ${deal.view_guarantee.toLocaleString()} (${delivPct ?? 0}%)`
                              : 'Pending'}
                          </span>
                        </div>
                        {deal.actual_views != null && (
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                (delivPct ?? 0) >= 100 ? 'bg-green-500'
                                  : (delivPct ?? 0) >= 70 ? 'bg-amber-500'
                                  : 'bg-red-500',
                              )}
                              style={{ width: `${Math.min(delivPct ?? 0, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {deal.fee_ngn != null && deal.actual_views != null && deal.actual_views > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Cost per view: ₦{(deal.fee_ngn / deal.actual_views).toFixed(2)}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
