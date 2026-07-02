'use client'

import { useCallback } from 'react'
import { Download, Mail, Link2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ManualMetric {
  metric_name: string
  value:       number
  unit:        string | null
}

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
  manualMetrics:         ManualMetric[]
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
  if (bhi >= 75)   return 'text-emerald-700'
  if (bhi >= 50)   return 'text-amber-700'
  return 'text-orange-600'
}

function monthYear(): string {
  return new Date().toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })
}

function todayFull(): string {
  return new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
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
  if (value > 50)    return <TrendingUp   className="h-3.5 w-3.5 text-emerald-600" />
  if (value < 35)    return <TrendingDown className="h-3.5 w-3.5 text-red-500" />
  return               <Minus className="h-3.5 w-3.5 text-amber-500" />
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricTile({
  label, value, unit, trend,
}: {
  label: string
  value: string
  unit?: string
  trend: number | null
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-center shadow-sm print:border-gray-300 print:shadow-none">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{label}</span>
      <span className="text-2xl font-bold text-gray-900 leading-none tabular-nums">
        {value}
        {unit && <span className="ml-0.5 text-sm font-medium text-gray-500">{unit}</span>}
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
  manualMetrics,
}: Props) {

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
      `Report prepared with BrandPulse AI.`,
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

      <div className="min-h-screen bg-gray-50 pb-24">
        <div className="mx-auto max-w-3xl px-4 py-8">

          {/* Page title */}
          <div className="mb-6 no-print">
            <h1 className="text-xl font-semibold text-gray-900">Board Pack</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              A one-page performance report ready for board or CFO review. Download as PDF or share directly.
            </p>
          </div>

          {/* ── Print preview pane ─────────────────────────────────────────────── */}
          <div
            id="board-pack-preview"
            className="rounded-2xl border border-gray-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none"
          >
            <div className="p-8 space-y-6">

              {/* Header */}
              <div className="flex items-start gap-4 border-b border-gray-100 pb-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white select-none">
                  {initials(brand.name)}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900">{brand.name}</h2>
                  <p className="text-sm text-gray-500">
                    Marketing Performance Report{brand.category ? ` · ${brand.category}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-800">{monthYear()}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Prepared with BrandPulse AI</p>
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

              {/* Campaign summary */}
              <div className="rounded-xl bg-gray-50 px-5 py-4 print:bg-gray-100">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                  Campaigns
                </p>
                {allCampaignCount > 0 ? (
                  <p className="text-[14px] text-gray-800 leading-relaxed">
                    {activeCampaignCount > 0
                      ? `${activeCampaignCount} campaign${activeCampaignCount !== 1 ? 's' : ''} active`
                      : `${allCampaignCount} campaign${allCampaignCount !== 1 ? 's' : ''} on record`}
                    {totalBudget > 0
                      ? `, total budget of ${fmtNGN(totalBudget)}`
                      : ''}
                    {topCampaign ? `. Top campaign: ${topCampaign}.` : '.'}
                  </p>
                ) : (
                  <p className="text-[14px] text-gray-400 italic">No active campaigns found.</p>
                )}
              </div>

              {/* Events section */}
              {recentEventCount > 0 && (
                <div className="rounded-xl bg-gray-50 px-5 py-4 print:bg-gray-100">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                    Events (last 90 days)
                  </p>
                  <p className="text-[14px] text-gray-800 leading-relaxed">
                    {recentEventCount} event{recentEventCount !== 1 ? 's' : ''} completed in the last 90 days
                    {ambassadorInteractions > 0
                      ? `, generating ${ambassadorInteractions.toLocaleString('en-NG')} ambassador interaction${ambassadorInteractions !== 1 ? 's' : ''}`
                      : ''}
                    .
                  </p>
                </div>
              )}

              {/* Manual metrics (if any) */}
              {manualMetrics.length > 0 && (
                <div className="rounded-xl bg-gray-50 px-5 py-4 print:bg-gray-100">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Additional Metrics
                  </p>
                  <ul className="space-y-1">
                    {manualMetrics.slice(0, 5).map((m, i) => (
                      <li key={i} className="flex items-center justify-between text-[13px] text-gray-700">
                        <span className="capitalize">{m.metric_name.replace(/_/g, ' ')}</span>
                        <span className="font-semibold tabular-nums">
                          {m.unit === 'NGN' ? fmtNGN(m.value) : `${m.value.toLocaleString('en-NG')}${m.unit ? ' ' + m.unit : ''}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI narrative placeholder */}
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                  AI Narrative
                </p>
                <p className="text-[13px] italic text-gray-400">
                  AI narrative generates automatically once you connect revenue data.
                </p>
              </div>

              {/* Footer */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Data from BrandPulse AI. Generated {todayFull()}. Figures reflect available connected data sources.
                </p>
              </div>

            </div>
          </div>

          {/* ── Actions bar ────────────────────────────────────────────────────── */}
          <div className="no-print mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">

            <a
              href={`mailto:?subject=${subject}&body=${body}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[13px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100"
            >
              <Mail className="h-4 w-4 shrink-0 opacity-70" />
              Share via Email
            </a>

            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[13px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100"
            >
              <Link2 className="h-4 w-4 shrink-0 opacity-70" />
              Copy link
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 active:bg-indigo-800"
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
