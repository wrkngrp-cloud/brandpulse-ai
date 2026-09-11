'use client'

import type { ReactNode } from 'react'

/**
 * The two states every chart ships with besides success.
 *
 * A chart with only a success state is half a component. Loading is a
 * skeleton shaped like the chart that is coming, so the layout never jumps
 * and there is no spinner. Empty states name the next action; they never
 * just say no data.
 */

/** A skeleton the shape of the chart, with the axis and the plot area drawn. */
export function ChartSkeleton({ height = 260, label }: { height?: number; label?: string }) {
  return (
    <div
      role="status"
      aria-label={label ? `Loading ${label}` : 'Loading'}
      className="w-full"
      style={{ height }}
    >
      <div
        className="bg-skeleton-block h-full w-full"
        style={{ borderRadius: 'var(--r-card)' }}
      />
    </div>
  )
}

/**
 * An empty state names the next action. `action` is a button or a link; the
 * message says what is missing in plain words.
 */
export function ChartEmpty({
  height = 260, message, action, label,
}: { height?: number; message: string; action?: ReactNode; label?: string }) {
  return (
    <div
      role="status"
      aria-label={label ? `${label}: no reading yet` : 'No reading yet'}
      className="grid w-full place-items-center border border-line text-center"
      style={{ height, borderRadius: 'var(--r-card)', padding: 'var(--s-5)' }}
    >
      <div>
        <p className="text-small text-tx-2" style={{ marginBottom: action ? 'var(--s-3)' : 0 }}>
          {message}
        </p>
        {action}
      </div>
    </div>
  )
}

/**
 * Wrap a chart: hand it the rows and it picks the state.
 *
 *   <ChartState rows={data} loading={pending} height={260}
 *     empty="Connect Meta Ads to see your first sentiment reading.">
 *     <ResponsiveContainer>…</ResponsiveContainer>
 *   </ChartState>
 */
export function ChartState({
  rows, loading = false, height = 260, empty, action, label, children,
}: {
  rows: unknown[] | null | undefined
  loading?: boolean
  height?: number
  empty: string
  action?: ReactNode
  label?: string
  children: ReactNode
}) {
  if (loading) return <ChartSkeleton height={height} label={label} />
  if (!rows || rows.length === 0) {
    return <ChartEmpty height={height} message={empty} action={action} label={label} />
  }
  return <>{children}</>
}
