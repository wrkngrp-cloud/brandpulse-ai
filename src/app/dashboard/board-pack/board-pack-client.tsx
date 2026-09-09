'use client'

import { useCallback } from 'react'
import { MailIcon as Mail, LinkIcon as Link2, FallingIcon as TrendingDown, RemoveIcon as Minus } from '@/components/brand/icon'
import { ExportIcon as Download, TrendIcon as TrendingUp } from '@/components/brand/icon'
import { cn } from '@/lib/utils'
import { TourTrigger } from '@/components/tours/tour-trigger'
import {
  visibleCommercialMetrics,
  type CommercialMetrics,
  type CommercialMetricId,
} from '@/lib/commercial-metrics'
import type { BrandType } from '@/lib/bhi'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  brand: {
    name:     string
    category: string | null
  }
  bhi:                   number | null
  sentiment:             number | null
  sov:                   number | null
  activeCampaignCount:   number
  allCampaignCount:      number
  totalBudget:           number
  topCampaign:           string | null
  recentEventCount:      number
  ambassadorInteractions: number
  avgNps:                number | null
  commercial:            CommercialMetrics
  brandType:             BrandType
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNGN(n: number): string {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `₦${(n / 1_000).toFixed(0)}K`
  return `₦${n.toLocaleString('en-NG')}`
}

function fmtNGNFull(n: number): string {
  return `₦${n.toLocaleString('en-NG')}`
}

function bhiLabel(bhi: number | null): string {
  if (bhi == null) return 'Awaiting data'
  if (bhi >= 75)   return 'STRONG'
  if (bhi >= 50)   return 'MODERATE'
  return 'BUILDING'
}

function bhiColor(bhi: number | null): string {
  if (bhi == null) return 'text-muted-foreground'
  if (bhi >= 75)   return 'text-pos'
  if (bhi >= 50)   return 'text-tx-2'
  return 'text-tx-2'
}

function monthYear(): string {
  return new Date().toLocaleDateString('en-NG', { month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' })
}

function todayFull(): string {
  return new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' })
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

function TrendIcon({ value }: { value: number | null }) {
  if (value == null) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />
  if (value > 50)    return <TrendingUp   className="h-3.5 w-3.5 text-pos" />
  if (value < 35)    return <TrendingDown className="h-3.5 w-3.5 text-tx-flare" />
  return               <Minus className="h-3.5 w-3.5 text-tx-2" />
}

// ── Commercial metric display config ─────────────────────────────────────────

const COMMERCIAL_DEFS: Record<CommercialMetricId, {
  label: string
  fmt: (v: number) => string
  goodWhenDown?: boolean
}> = {
  revenue:   { label: 'Revenue',         fmt: fmtNGN },
  spend:     { label: 'Marketing Spend', fmt: fmtNGN },
  roiPct:    { label: 'Marketing ROI',   fmt: v => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%` },
  roas:      { label: 'ROAS',            fmt: v => `${v.toFixed(1)}x` },
  cac:       { label: 'CAC',             fmt: fmtNGN, goodWhenDown: true },
  cpl:       { label: 'Cost per Lead',   fmt: fmtNGN, goodWhenDown: true },
  mql:       { label: 'MQLs',            fmt: v => v.toLocaleString('en-NG') },
  churnRate: { label: 'Churn Rate',      fmt: v => `${(v * 100).toFixed(1)}%`, goodWhenDown: true },
  ltvToCac:  { label: 'LTV : CAC',       fmt: v => `${v.toFixed(1)}x` },
}

function periodDelta(trend: { date: string; value: number }[]): number | null {
  if (trend.length < 2) return null
  const prev = trend[trend.length - 2].value
  const last = trend[trend.length - 1].value
  if (prev === 0) return null
  return ((last - prev) / Math.abs(prev)) * 100
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CommercialTile({ id, metric }: {
  id:     CommercialMetricId
  metric: CommercialMetrics[CommercialMetricId]
}) {
  const def = COMMERCIAL_DEFS[id]

  if (metric.value == null) {
    return (
      <div className="flex flex-col justify-between gap-1 rounded-xl border border-dashed border-line bg-shell px-4 py-3 print:border-line">
        <span className="text-[10px] font-semibold text-tx-3">{def.label}</span>
        <span className="text-[11px] leading-snug text-tx-3">{metric.unavailableReason}</span>
      </div>
    )
  }

  const delta = periodDelta(metric.trend)
  const improved = delta != null ? (def.goodWhenDown ? delta < 0 : delta > 0) : null

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-card px-4 py-3 print:border-line">
      <span className="text-[10px] font-semibold text-tx-3">{def.label}</span>
      <span className="text-xl font-bold text-tx leading-none bg-num">{def.fmt(metric.value)}</span>
      {delta != null ? (
        <span className={cn(
          'flex items-center gap-1 text-[11px] font-semibold bg-num',
          improved ? 'text-pos' : 'text-tx-flare',
        )}>
          {delta > 0
            ? <TrendingUp className="h-3 w-3" />
            : delta < 0
              ? <TrendingDown className="h-3 w-3" />
              : <Minus className="h-3 w-3" />}
          {delta > 0 ? '+' : ''}{delta.toFixed(1)}% vs last month
        </span>
      ) : (
        <span className="text-[11px] text-tx-3">This month</span>
      )}
    </div>
  )
}

function MetricTile({
  label, value, unit, trend,
}: {
  label: string
  value: string
  unit?: string
  trend: number | null
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-line bg-card px-4 py-3 text-center print:border-line">
      <span className="text-[10px] font-semibold text-tx-3">{label}</span>
      <span className="text-2xl font-bold text-tx leading-none bg-num">
        {value}
        {unit && <span className="ml-0.5 text-sm font-medium text-tx-3">{unit}</span>}
      </span>
      <TrendIcon value={trend} />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function BoardPackClient({
  brand,
  bhi,
  sentiment,
  sov,
  activeCampaignCount,
  allCampaignCount,
  totalBudget,
  topCampaign,
  recentEventCount,
  ambassadorInteractions,
  avgNps,
  commercial,
  brandType,
}: Props) {
  const commercialIds = visibleCommercialMetrics(brandType)

  const label    = bhiLabel(bhi)
  const bhiScore = bhi != null ? bhi.toFixed(0) : 'N/A'
  const sovStr   = sov != null ? `${sov.toFixed(1)}%` : 'N/A'

  const headlineSov = sov != null
    ? ` and ${sov.toFixed(1)}% share of voice`
    : ''

  const headline = `Brand health is ${label}, with a BHI score of ${bhi != null ? bhi.toFixed(0) : 'N/A'} out of 100${headlineSov}.`

  // Fourth metric: prefer NPS, fall back to active campaign count
  const fourthMetricLabel = avgNps != null ? 'NPS Score' : 'Active Campaigns'
  const fourthMetricValue = avgNps != null
    ? String(avgNps)
    : String(activeCampaignCount)
  const fourthMetricTrend = avgNps ?? (activeCampaignCount > 0 ? 55 : null)

  // Email share
  const subject = encodeURIComponent(
    `Marketing Performance Report — ${brand.name} ${monthYear()}`
  )
  const body = encodeURIComponent(
    [
      `Hi,`,
      ``,
      `Here is a summary of ${brand.name}'s marketing performance for ${monthYear()}.`,
      ``,
      `Key numbers:`,
      `- Brand Health Index (BHI): ${bhiScore} / 100 (${label})`,
      `- Sentiment Score: ${sentiment != null ? sentiment.toFixed(0) : 'N/A'} / 100`,
      `- Share of Voice: ${sovStr}`,
      avgNps != null ? `- NPS Score: ${avgNps}` : `- Active Campaigns: ${activeCampaignCount}`,
      totalBudget > 0
        ? `- Active campaign budget: ${fmtNGNFull(totalBudget)}`
        : '',
      ``,
      `Report prepared with BrandGauge.`,
    ].filter(l => l !== '').join('\n')
  )

  const handleDownload = useCallback(() => {
    window.print()
  }, [])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
    } catch {
      // Clipboard API may be blocked -- silent fail
    }
  }, [])

  return (
    <>
      {/* Print isolation styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #board-pack-preview,
          #board-pack-preview * { visibility: visible; }
          #board-pack-preview {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 32px 40px;
            box-sizing: border-box;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-shell pb-24">
        <div className="mx-auto max-w-3xl px-4 py-8">

          {/* Page title */}
          <div className="mb-6 no-print flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-tx">Board Pack</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                A one-page performance report ready for board or CFO review. Download as PDF or share directly.
              </p>
            </div>
            <TourTrigger module="board_pack" autoStart />
          </div>

          {/* ── Print preview pane ─────────────────────────────────────────────── */}
          <div
            data-tour="boardpack-main"
            id="board-pack-preview"
            className="rounded-2xl border border-line bg-card print:rounded-none print:border-0"
          >
            <div className="p-8 space-y-6">

              {/* Header */}
              <div className="flex items-start gap-4 border-b border-line pb-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-flare text-lg font-bold text-on-hot select-none">
                  {initials(brand.name)}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-tx">{brand.name}</h2>
                  <p className="text-sm text-tx-3">
                    Marketing Performance Report{brand.category ? ` · ${brand.category}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-tx">{monthYear()}</p>
                  <p className="text-[11px] text-tx-3 mt-0.5">Prepared with BrandGauge</p>
                </div>
              </div>

              {/* Headline sentence */}
              <div className={cn('text-[17px] font-semibold leading-snug', bhiColor(bhi))}>
                {headline}
              </div>

              {/* 4-metric row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricTile
                  label="BHI Score"
                  value={bhi != null ? bhi.toFixed(0) : 'N/A'}
                  unit={bhi != null ? '/ 100' : undefined}
                  trend={bhi}
                />
                <MetricTile
                  label="Sentiment"
                  value={sentiment != null ? sentiment.toFixed(0) : 'N/A'}
                  unit={sentiment != null ? '/ 100' : undefined}
                  trend={sentiment}
                />
                <MetricTile
                  label="Share of Voice"
                  value={sov != null ? sov.toFixed(1) : 'N/A'}
                  unit={sov != null ? '%' : undefined}
                  trend={sov != null ? sov * 1.5 : null}
                />
                <MetricTile
                  label={fourthMetricLabel}
                  value={fourthMetricValue}
                  trend={fourthMetricTrend}
                />
              </div>

              {/* Commercial Performance — the CFO-facing numbers */}
              <div>
                <p className="text-[11px] font-bold text-tx-3 mb-2">
                  Commercial Performance
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {commercialIds.map(id => (
                    <CommercialTile key={id} id={id} metric={commercial[id]} />
                  ))}
                </div>
              </div>

              {/* Campaign summary */}
              <div className="rounded-xl bg-shell px-5 py-4 print:bg-shell">
                <p className="text-[11px] font-bold text-tx-3 mb-1">
                  Campaigns
                </p>
                {allCampaignCount > 0 ? (
                  <p className="text-[14px] text-tx leading-relaxed">
                    {activeCampaignCount > 0
                      ? `${activeCampaignCount} campaign${activeCampaignCount !== 1 ? 's' : ''} active`
                      : `${allCampaignCount} campaign${allCampaignCount !== 1 ? 's' : ''} on record`}
                    {totalBudget > 0
                      ? `, total budget of ${fmtNGN(totalBudget)}`
                      : ''}
                    {topCampaign ? `. Top campaign: ${topCampaign}.` : '.'}
                  </p>
                ) : (
                  <p className="text-[14px] text-tx-3">No active campaigns found.</p>
                )}
              </div>

              {/* Events section */}
              {recentEventCount > 0 && (
                <div className="rounded-xl bg-shell px-5 py-4 print:bg-shell">
                  <p className="text-[11px] font-bold text-tx-3 mb-1">
                    Events (last 90 days)
                  </p>
                  <p className="text-[14px] text-tx leading-relaxed">
                    {recentEventCount} event{recentEventCount !== 1 ? 's' : ''} completed in the last 90 days
                    {ambassadorInteractions > 0
                      ? `, generating ${ambassadorInteractions.toLocaleString('en-NG')} ambassador interaction${ambassadorInteractions !== 1 ? 's' : ''}`
                      : ''}
                    .
                  </p>
                </div>
              )}

              {/* AI narrative placeholder */}
              <div className="rounded-xl border border-dashed border-line bg-shell px-5 py-4">
                <p className="text-[11px] font-bold text-tx-3 mb-1">
                  AI Narrative
                </p>
                <p className="text-[13px] text-tx-3">
                  AI narrative generates automatically once you connect revenue data.
                </p>
              </div>

              {/* Footer */}
              <div className="border-t border-line pt-4">
                <p className="text-[11px] text-tx-3 leading-relaxed">
                  Data from BrandGauge. Generated {todayFull()}. Figures reflect available connected data sources.
                </p>
              </div>

            </div>
          </div>

          {/* ── Actions bar ────────────────────────────────────────────────────── */}
          <div className="no-print mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">

            <a
              href={`mailto:?subject=${subject}&body=${body}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-[13px] font-medium text-tx-2 transition-colors hover:bg-shell active:bg-shell"
            >
              <Mail className="h-4 w-4 shrink-0 opacity-70" />
              Share via Email
            </a>

            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-[13px] font-medium text-tx-2 transition-colors hover:bg-shell active:bg-shell bg-press"
            >
              <Link2 className="h-4 w-4 shrink-0 opacity-70" />
              Copy link
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-flare px-5 py-2.5 text-[13px] font-semibold text-on-hot transition-colors hover:bg-flare active:bg-flare border border-line bg-press"
            >
              <Download className="h-4 w-4 shrink-0" />
              Download PDF
            </button>

          </div>

        </div>
      </div>
    </>
  )
}
