'use client'

import { useRouter }    from 'next/navigation'
import { Badge }        from '@/components/ui/badge'
import { Button }       from '@/components/ui/button'
import { Card }         from '@/components/ui/card'
import { Progress }     from '@/components/ui/progress'
import { cn }           from '@/lib/utils'
import { AlertTriangle, Eye, RefreshCw, Wand2, FlaskConical, Images, TrendingDown, CheckCircle2 } from 'lucide-react'
import type { FatiguedAsset } from './page'

interface Props {
  brandName:   string
  assets:      FatiguedAsset[]
  totalActive: number
}

const LEVEL_META = {
  critical: { label: 'Critical',       color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',    border: 'border-red-200 dark:border-red-800',    icon: AlertTriangle },
  watch:    { label: 'Watch',          color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800', icon: Eye },
  refresh:  { label: 'Refresh Soon',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',  border: 'border-blue-200 dark:border-blue-800',  icon: RefreshCw },
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  image: 'Image', video: 'Video', copy: 'Copy', carousel: 'Carousel', audio: 'Audio',
}

function fmtPct(n: number | null | undefined) {
  return n == null ? '—' : `${n.toFixed(2)}%`
}

function FatigueBar({ score, level }: { score: number; level: FatiguedAsset['fatigue_level'] }) {
  const color = level === 'critical' ? 'bg-red-500' : level === 'watch' ? 'bg-amber-500' : 'bg-blue-500'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Fatigue score</span>
        <span className="font-medium">{score}/100</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

function AssetCard({ asset }: { asset: FatiguedAsset }) {
  const router = useRouter()
  const meta = LEVEL_META[asset.fatigue_level]
  const LevelIcon = meta.icon
  const p = asset.performance ?? {}
  const daysRunning = Math.floor((Date.now() - new Date(asset.created_at).getTime()) / 86_400_000)

  return (
    <Card className={cn('p-5 space-y-4 border-l-4', meta.border)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', meta.color)}>
              <LevelIcon className="h-3 w-3" />
              {meta.label}
            </span>
            <Badge variant="outline" className="text-xs">{ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type}</Badge>
            {asset.platform && <Badge variant="secondary" className="text-xs">{asset.platform}</Badge>}
            {asset.fit_for_ads && <Badge className="text-xs bg-emerald-600 text-white hover:bg-emerald-700">Fit for Ads</Badge>}
          </div>
          <h3 className="font-semibold text-sm truncate">{asset.title}</h3>
          {asset.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{asset.description}</p>
          )}
        </div>
      </div>

      {/* Fatigue score */}
      <FatigueBar score={asset.fatigue_score} level={asset.fatigue_level} />

      {/* Signals */}
      <div className="space-y-1.5">
        {asset.fatigue_signals.map((s, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
            <TrendingDown className="h-3 w-3 mt-0.5 shrink-0 text-red-500" />
            <span>{s}</span>
          </div>
        ))}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 pt-1">
        <div className="text-center">
          <div className="text-sm font-semibold tabular-nums">{fmtPct(p.ctr)}</div>
          <div className="text-xs text-muted-foreground">CTR</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold tabular-nums">{p.frequency != null ? `${(p.frequency as number).toFixed(1)}×` : '—'}</div>
          <div className="text-xs text-muted-foreground">Frequency</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold tabular-nums">{daysRunning}d</div>
          <div className="text-xs text-muted-foreground">Running</div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fix with Creative Lab</p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm" variant="outline" className="h-8 text-xs gap-1.5"
            onClick={() => router.push(`/dashboard/voice-builder?mode=retune&title=${encodeURIComponent(asset.title)}`)}
          >
            <Wand2 className="h-3.5 w-3.5" />
            Retune Caption
          </Button>
          <Button
            size="sm" variant="outline" className="h-8 text-xs gap-1.5"
            onClick={() => router.push(`/dashboard/creative-library?replace=${asset.id}&type=${asset.asset_type}`)}
          >
            <Images className="h-3.5 w-3.5" />
            Find Replacement
          </Button>
          <Button
            size="sm" variant="outline" className="h-8 text-xs gap-1.5"
            onClick={() => router.push(`/dashboard/experiments?new=1&source_asset=${asset.id}`)}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            A/B Test
          </Button>
        </div>
      </div>
    </Card>
  )
}

export function FatigueClient({ brandName, assets, totalActive }: Props) {
  const critical = assets.filter(a => a.fatigue_level === 'critical')
  const watch    = assets.filter(a => a.fatigue_level === 'watch')
  const refresh  = assets.filter(a => a.fatigue_level === 'refresh')
  const healthy  = totalActive - assets.length

  return (
    <div className="max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Creative Fatigue Monitor</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Active creatives for {brandName} showing frequency, CTR, and age signals. Refresh before they hurt performance.
        </p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Critical',     count: critical.length, color: 'text-red-600',   bg: 'bg-red-50 dark:bg-red-900/10'    },
          { label: 'Watch',        count: watch.length,    color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/10'},
          { label: 'Refresh Soon', count: refresh.length,  color: 'text-blue-600',  bg: 'bg-blue-50 dark:bg-blue-900/10'  },
          { label: 'Healthy',      count: healthy,         color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10'},
        ].map(t => (
          <div key={t.label} className={cn('rounded-lg p-4 text-center', t.bg)}>
            <div className={cn('text-3xl font-bold tabular-nums', t.color)}>{t.count}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{t.label}</div>
          </div>
        ))}
      </div>

      {assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="font-medium">All active creatives are healthy</p>
          <p className="text-sm text-muted-foreground">No fatigue signals detected. Check back after your next campaign run.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {critical.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Critical — Pause or Replace Now
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {critical.map(a => <AssetCard key={a.id} asset={a} />)}
              </div>
            </section>
          )}

          {watch.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-2">
                <Eye className="h-4 w-4" /> Watch — Plan Refresh This Week
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {watch.map(a => <AssetCard key={a.id} asset={a} />)}
              </div>
            </section>
          )}

          {refresh.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wide flex items-center gap-2">
                <RefreshCw className="h-4 w-4" /> Refresh Soon — Schedule Within 2 Weeks
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {refresh.map(a => <AssetCard key={a.id} asset={a} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
