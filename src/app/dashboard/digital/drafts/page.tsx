'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon as ArrowLeft, PlusIcon as Plus, TrashIcon as Trash2, FileIcon as FileText, ClockIcon as Clock, ExternalLinkIcon as ExternalLink } from '@/components/brand/icon'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

interface Draft {
  id:            string
  platform:      string
  headline:      string | null
  campaign_name: string | null
  ad_name:       string | null
  objective:     string | null
  ad_format:     string | null
  status:        string
  budget_daily:  number | null
  budget_total:  number | null
  start_date:    string | null
  end_date:      string | null
  created_at:    string
  updated_at:    string
}

function fmtNGN(v: number) {
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `₦${(v / 1_000).toFixed(0)}K`
  return `₦${Math.round(v)}`
}

function platformLabel(p: string) {
  const map: Record<string, string> = {
    meta: 'Meta Ads', google: 'Google Ads', tiktok: 'TikTok Ads',
    linkedin: 'LinkedIn Ads', twitter: 'X (Twitter) Ads',
  }
  return map[p] ?? p
}

function platformColor(p: string) {
  const map: Record<string, string> = {
    meta:     'bg-flare/10 text-tx-flare dark:text-tx-2',
    google:   'bg-flare/10 text-tx-flare dark:text-tx-flare',
    tiktok:   'bg-ink/10 text-tx-2 dark:text-tx-inv-2',
    linkedin: 'bg-flare/10 text-tx-flare dark:text-tx-2',
    twitter:  'bg-neu/10 text-tx-2 dark:text-tx-3',
  }
  return map[p] ?? 'bg-muted text-muted-foreground'
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' })
}

export default function DraftsPage() {
  const [drafts, setDrafts]          = useState<Draft[]>([])
  const [loading, setLoading]        = useState(true)
  const [, startTransition]          = useTransition()

  useEffect(() => {
    fetch('/api/ads/drafts')
      .then(r => r.json())
      .then((d: { drafts?: Draft[] }) => setDrafts(d.drafts ?? []))
      .catch(() => toast.error('Could not load drafts'))
      .finally(() => setLoading(false))
  }, [])

  function deleteDraft(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/ads/drafts?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setDrafts(prev => prev.filter(d => d.id !== id))
        toast.success('Draft deleted')
      } else {
        toast.error('Could not delete draft')
      }
    })
  }

  return (
    <div className="max-w-4xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Link
            href="/dashboard/digital"
            className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border text-muted-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Ad Drafts</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Saved ad drafts. Connect your ad account to publish directly from here.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/digital/create-ad"
          className="inline-flex items-center gap-1.5 rounded-lg border bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New Ad
        </Link>
      </div>

      {/* How publishing works */}
      <div className="rounded-xl border border-line-strong bg-flare-wash dark:border-line-strong dark:bg-shell/30 px-4 py-3 space-y-1">
        <p className="text-sm font-medium text-tx-flare dark:text-tx-2">How publishing works</p>
        <p className="text-xs text-tx-flare dark:text-tx-2">
          Drafts are saved here until you are ready to go live. Once you connect your Meta or Google Ads account, use the
          {' '}<strong>Publish</strong> button to send the campaign to the platform. Until then, drafts remain private on BrandGauge.
        </p>
      </div>

      {/* Draft list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : drafts.length === 0 ? (
        <Card className="border rounded-xl p-12 text-center space-y-3">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-base font-medium">No drafts yet</p>
          <p className="text-sm text-muted-foreground">
            Create an ad and save it as a draft — it will appear here so you can review and publish it.
          </p>
          <Link
            href="/dashboard/digital/create-ad"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> Create your first ad
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {drafts.map(draft => (
            <Card key={draft.id} className="border rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-[10px] border-0 ${platformColor(draft.platform)}`}>
                      {platformLabel(draft.platform)}
                    </Badge>
                    {draft.objective && (
                      <Badge variant="outline" className="text-[10px] capitalize">{draft.objective}</Badge>
                    )}
                    {draft.ad_format && (
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {draft.ad_format.replace(/_/g, ' ')}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] text-tx-2 border-line bg-shell dark:bg-shell/30">
                      Draft
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold truncate">
                    {draft.campaign_name ?? draft.headline ?? 'Untitled campaign'}
                  </p>
                  {draft.campaign_name && draft.headline && (
                    <p className="text-xs text-muted-foreground truncate">{draft.headline}</p>
                  )}
                </div>
                <button
                  onClick={() => deleteDraft(draft.id)}
                  className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-tx-flare hover:bg-flare-wash dark:hover:bg-shell/30 transition-colors bg-press"
                  title="Delete draft"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                {draft.budget_daily && (
                  <span className="bg-num">{fmtNGN(draft.budget_daily)}/day</span>
                )}
                {draft.budget_total && (
                  <span className="bg-num"><span className="bg-num">{fmtNGN(draft.budget_total)}</span> total</span>
                )}
                {draft.start_date && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Starts {fmtDate(draft.start_date)}
                  </span>
                )}
                <span className="ml-auto bg-num">Saved {fmtDate(draft.created_at)}</span>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  disabled
                  title="Connect your ad account to publish"
                >
                  <ExternalLink className="h-3 w-3" />
                  Publish to {platformLabel(draft.platform)}
                </Button>
                <span className="text-[10px] text-muted-foreground">
                  Connect your {platformLabel(draft.platform)} account on the{' '}
                  <Link href="/dashboard/digital" className="underline">Digital page</Link> to enable publishing.
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
