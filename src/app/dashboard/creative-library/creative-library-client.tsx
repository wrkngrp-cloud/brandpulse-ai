'use client'

import { useState, useMemo } from 'react'
import { useRouter }          from 'next/navigation'
import { toast }              from 'sonner'
import {
  Image as ImageIcon, Video, FileText, LayoutGrid, Sparkles,
  Filter, CheckSquare, Square, Zap, ExternalLink, Tag,
  TrendingUp, BookOpen, Copy, Star, Eye,
} from 'lucide-react'
import { Button }  from '@/components/ui/button'
import { Badge }   from '@/components/ui/badge'
import { cn, formatPlatformLabel, toSentenceCase } from '@/lib/utils'
import type { CreativeAsset } from './page'
import { TourTrigger } from '@/components/tours/tour-trigger'

// ── Constants ─────────────────────────────────────────────────────────────────

const ASSET_ICON: Record<string, React.ElementType> = {
  image:    ImageIcon,
  video:    Video,
  copy:     FileText,
  carousel: LayoutGrid,
  audio:    Sparkles,
}

const ASSET_COLOR: Record<string, string> = {
  image:    'bg-blue-500/10 text-blue-600',
  video:    'bg-purple-500/10 text-purple-600',
  copy:     'bg-amber-500/10 text-amber-600',
  carousel: 'bg-teal-500/10 text-teal-600',
  audio:    'bg-pink-500/10 text-pink-600',
}

const STATUS_BADGE: Record<string, string> = {
  draft:    'bg-muted text-muted-foreground',
  active:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  vetted:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  archived: 'bg-muted/60 text-muted-foreground/60',
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

// ── Asset card ────────────────────────────────────────────────────────────────

function AssetCard({
  asset, selected, onSelect, onView,
}: {
  asset: CreativeAsset
  selected: boolean
  onSelect: () => void
  onView: () => void
}) {
  const Icon = ASSET_ICON[asset.asset_type] ?? FileText
  const perf = asset.performance ?? {}

  return (
    <div
      className={cn(
        'group relative rounded-2xl border bg-card transition-all duration-150 overflow-hidden',
        selected ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/30',
      )}
    >
      {/* Thumbnail / placeholder */}
      <div
        className={cn(
          'relative h-36 flex items-center justify-center cursor-pointer',
          'bg-gradient-to-br from-muted/60 to-muted',
        )}
        onClick={onView}
      >
        {asset.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.thumbnail_url} alt={asset.title} className="w-full h-full object-cover" />
        ) : (
          <Icon className="h-10 w-10 text-muted-foreground/25" />
        )}

        {/* Overlay badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {asset.fit_for_ads && (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-primary text-primary-foreground rounded px-1.5 py-0.5">
              <Zap className="h-2.5 w-2.5" />Ads-ready
            </span>
          )}
          <span className={cn('text-[10px] font-medium capitalize rounded px-1.5 py-0.5', STATUS_BADGE[asset.status])}>
            {asset.status}
          </span>
        </div>

        {/* Select checkbox */}
        <button
          onClick={e => { e.stopPropagation(); onSelect() }}
          className={cn(
            'absolute top-2 right-2 transition-opacity',
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          {selected
            ? <CheckSquare className="h-5 w-5 text-primary fill-primary" />
            : <Square className="h-5 w-5 text-white/80 drop-shadow" />}
        </button>
      </div>

      {/* Body */}
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-start gap-2">
          <span className={cn('h-5 w-5 rounded flex items-center justify-center shrink-0 mt-0.5', ASSET_COLOR[asset.asset_type])}>
            <Icon className="h-3 w-3" />
          </span>
          <p className="text-[13px] font-medium leading-snug line-clamp-2 flex-1">{asset.title}</p>
        </div>

        {/* Platform + format */}
        <div className="flex flex-wrap gap-1">
          {asset.platform && (
            <span className="text-[10px] bg-muted rounded px-1.5 py-0.5 text-muted-foreground">{formatPlatformLabel(asset.platform)}</span>
          )}
          {asset.format && (
            <span className="text-[10px] bg-muted rounded px-1.5 py-0.5 text-muted-foreground">{asset.format === 'ooh' ? 'OOH' : toSentenceCase(asset.format)}</span>
          )}
        </div>

        {/* Performance mini-row */}
        {(perf.impressions || perf.ctr) ? (
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            {perf.impressions && (
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />{fmtNum(perf.impressions)}
              </span>
            )}
            {perf.ctr && (
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />{perf.ctr.toFixed(1)}% CTR
              </span>
            )}
            {perf.roas && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3" />{perf.roas.toFixed(1)}x ROAS
              </span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── Asset drawer ──────────────────────────────────────────────────────────────

function AssetDrawer({ asset, onClose }: { asset: CreativeAsset; onClose: () => void }) {
  const Icon = ASSET_ICON[asset.asset_type] ?? FileText
  const perf = asset.performance ?? {}

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background border-l shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="p-5 border-b flex items-start gap-3">
          <span className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', ASSET_COLOR[asset.asset_type])}>
            <Icon className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold leading-snug">{asset.title}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5 capitalize">
              {asset.asset_type} · {asset.platform ?? 'No platform'} · {asset.format ?? 'No format'}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none shrink-0">×</button>
        </div>

        <div className="flex-1 divide-y divide-border/40">
          {/* Status + ads-ready */}
          <div className="p-5 flex items-center gap-3">
            <span className={cn('text-[11px] font-medium capitalize rounded-full px-2.5 py-1', STATUS_BADGE[asset.status])}>
              {asset.status}
            </span>
            {asset.fit_for_ads && (
              <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                <Zap className="h-3 w-3" />Approved for ads
              </span>
            )}
          </div>

          {/* Description */}
          {asset.description && (
            <div className="p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Description</p>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{asset.description}</p>
            </div>
          )}

          {/* Performance */}
          {Object.keys(perf).length > 0 && (
            <div className="p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Performance</p>
              <div className="grid grid-cols-3 gap-2">
                {perf.impressions && (
                  <div className="bg-muted/40 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground">Impressions</p>
                    <p className="text-[13px] font-semibold tabular-nums">{fmtNum(perf.impressions)}</p>
                  </div>
                )}
                {perf.clicks && (
                  <div className="bg-muted/40 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground">Clicks</p>
                    <p className="text-[13px] font-semibold tabular-nums">{fmtNum(perf.clicks)}</p>
                  </div>
                )}
                {perf.ctr && (
                  <div className="bg-muted/40 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground">CTR</p>
                    <p className="text-[13px] font-semibold tabular-nums">{perf.ctr.toFixed(2)}%</p>
                  </div>
                )}
                {perf.conversions && (
                  <div className="bg-muted/40 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground">Conversions</p>
                    <p className="text-[13px] font-semibold tabular-nums">{fmtNum(perf.conversions)}</p>
                  </div>
                )}
                {perf.spend && (
                  <div className="bg-muted/40 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground">Spend</p>
                    <p className="text-[13px] font-semibold tabular-nums">₦{fmtNum(perf.spend)}</p>
                  </div>
                )}
                {perf.roas && (
                  <div className="bg-muted/40 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground">ROAS</p>
                    <p className="text-[13px] font-semibold tabular-nums">{perf.roas.toFixed(1)}x</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Replication elements */}
          {asset.replication_elements?.length > 0 && (
            <div className="p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                What made it work — replicate these
              </p>
              <ul className="space-y-2">
                {asset.replication_elements.map((el, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px]">
                    <Copy className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    {el}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          {asset.notes && (
            <div className="p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Notes</p>
              <p className="text-[12.5px] text-muted-foreground leading-relaxed">{asset.notes}</p>
            </div>
          )}

          {/* Tags */}
          {asset.tags?.length > 0 && (
            <div className="p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {asset.tags.map(t => (
                  <span key={t} className="text-[11px] bg-muted rounded-full px-2.5 py-1 text-muted-foreground">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Asset link */}
          {asset.asset_url && (
            <div className="p-5">
              <a
                href={asset.asset_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[12.5px] text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />View asset file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  brandId:   string
  brandName: string
  assets:    CreativeAsset[]
}

type FilterType = 'all' | 'image' | 'video' | 'copy' | 'carousel' | 'fit_for_ads'

export function CreativeLibraryClient({ brandId, brandName, assets }: Props) {
  const router = useRouter()
  const [filter, setFilter]           = useState<FilterType>('all')
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [viewAsset, setViewAsset]     = useState<CreativeAsset | null>(null)
  const [creatingAd, setCreatingAd]   = useState(false)

  const filtered = useMemo(() => {
    if (filter === 'all')        return assets
    if (filter === 'fit_for_ads') return assets.filter(a => a.fit_for_ads)
    return assets.filter(a => a.asset_type === filter)
  }, [assets, filter])

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedAssets = assets.filter(a => selected.has(a.id))
  const adReadySelected = selectedAssets.filter(a => a.fit_for_ads)

  async function createAdSet() {
    if (!adReadySelected.length) {
      toast.error('Select at least one "Ads-ready" creative to create an ad set')
      return
    }
    setCreatingAd(true)
    try {
      const ids = adReadySelected.map(a => a.id).join(',')
      router.push(`/dashboard/digital?from_library=${ids}`)
    } finally {
      setCreatingAd(false)
    }
  }

  const FILTER_TABS: { id: FilterType; label: string; icon: React.ElementType }[] = [
    { id: 'all',         label: 'All',         icon: BookOpen      },
    { id: 'image',       label: 'Images',      icon: ImageIcon     },
    { id: 'video',       label: 'Video',       icon: Video         },
    { id: 'copy',        label: 'Copy',        icon: FileText      },
    { id: 'carousel',    label: 'Carousel',    icon: LayoutGrid    },
    { id: 'fit_for_ads', label: 'Ads-ready',   icon: Zap           },
  ]

  if (assets.length === 0) {
    return (
      <div className="space-y-6 max-w-[1100px]">
        <div>
          <p className="eyebrow mb-1">Creative Intelligence</p>
          <h1 className="h-display text-[28px] leading-none">Creative Library</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground/60">
            Your vault of vetted creatives — with performance data, replication learnings, and one-click ad set creation.
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-12 flex flex-col items-center gap-4 text-center">
          <div className="h-14 w-14 rounded-full bg-muted/40 flex items-center justify-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground/25" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">No creative assets yet</p>
            <p className="text-[13px] text-muted-foreground max-w-sm">
              Your vetted creatives, performance learnings, and ad-ready assets will appear here as your team uploads and reviews them.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-[1100px]">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-1">Creative Intelligence</p>
          <h1 className="h-display text-[28px] leading-none">Creative Library</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground/60">
            {assets.length} assets · {assets.filter(a => a.fit_for_ads).length} ads-ready · {assets.filter(a => a.status === 'vetted').length} vetted
          </p>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5">
            <span className="text-[13px] font-medium">{selected.size} selected</span>
            {adReadySelected.length > 0 && (
              <Button size="sm" onClick={createAdSet} disabled={creatingAd}>
                <Zap className="h-3.5 w-3.5 mr-1.5" />Create Ad Set ({adReadySelected.length})
              </Button>
            )}
            <button onClick={() => setSelected(new Set())} className="text-[12px] text-muted-foreground hover:text-foreground">
              Clear
            </button>
          </div>
        )}
        <TourTrigger module="creative_library" autoStart />
      </div>

      <div data-tour="library-main">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
        {FILTER_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors',
              filter === id
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
            {id === 'fit_for_ads' && (
              <span className="ml-0.5 text-[10px] bg-primary/15 text-primary rounded px-1">
                {assets.filter(a => a.fit_for_ads).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map(asset => (
          <AssetCard
            key={asset.id}
            asset={asset}
            selected={selected.has(asset.id)}
            onSelect={() => toggleSelect(asset.id)}
            onView={() => setViewAsset(asset)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-[13px]">
          No assets match this filter.
        </div>
      )}
      </div>

      {/* Drawer */}
      {viewAsset && <AssetDrawer asset={viewAsset} onClose={() => setViewAsset(null)} />}
    </div>
  )
}
