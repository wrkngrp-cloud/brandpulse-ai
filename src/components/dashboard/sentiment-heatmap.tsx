'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface HeatmapDay {
  date:         string
  score:        number | null
  positive_pct?: number | null
  negative_pct?: number | null
}

interface TooltipState {
  date:         string
  score:        number | null
  positive_pct?: number | null
  negative_pct?: number | null
  x:   number
  y:   number
}

// ── Color logic ───────────────────────────────────────────────────────────
// Centred on 50 (neutral). Distance from neutral drives opacity.
// Below 50: red family. Above 50: green family. No data: transparent grid.

function cellColor(score: number | null): string {
  if (score === null) return 'transparent'
  const dist = score - 50
  if (dist === 0) return 'rgba(100,116,139,0.18)'  // slate-500 barely visible
  if (dist > 0) {
    const t = Math.min(dist / 50, 1)
    const opacity = 0.18 + t * 0.78
    return `rgba(34,197,94,${opacity.toFixed(3)})`  // green-500
  }
  const t = Math.min(-dist / 50, 1)
  const opacity = 0.18 + t * 0.78
  return `rgba(239,68,68,${opacity.toFixed(3)})`    // red-500
}

function cellLabel(score: number | null): string {
  if (score === null) return 'No data'
  if (score >= 70) return 'Very positive'
  if (score >= 60) return 'Positive'
  if (score >= 45) return 'Neutral'
  if (score >= 30) return 'Negative'
  return 'Very negative'
}

function fmt(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-NG', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ── Grid builder ──────────────────────────────────────────────────────────
// 53-week calendar, columns = weeks (oldest left), rows = days Mon→Sun
// Fills from top-left, matching GitHub's contribution graph layout

interface Cell {
  date:         string
  score:        number | null
  positive_pct?: number | null
  negative_pct?: number | null
  col:  number  // week index 0..52
  row:  number  // day of week 0=Mon..6=Sun
  isFuture: boolean
}

interface MonthLabel {
  label: string
  col:   number
}

function buildGrid(data: HeatmapDay[]): { cells: Cell[]; months: MonthLabel[]; totalWeeks: number } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Start 52 weeks back from today, snapped to Monday
  const start = new Date(today)
  start.setDate(today.getDate() - 364)
  const dow = start.getDay()   // 0=Sun
  const toMon = dow === 0 ? -6 : 1 - dow
  start.setDate(start.getDate() + toMon)

  const scoreMap = new Map<string, HeatmapDay>()
  for (const d of data) scoreMap.set(d.date, d)

  const cells: Cell[] = []
  const months: MonthLabel[] = []
  let lastMonth = -1

  const cur = new Date(start)
  let col = 0
  let row = 0  // 0=Mon

  while (cur <= today || (col === 0 && row === 0 && cells.length === 0)) {
    const dateStr = cur.toISOString().split('T')[0]
    const entry   = scoreMap.get(dateStr)

    cells.push({
      date:         dateStr,
      score:        entry?.score ?? null,
      positive_pct: entry?.positive_pct,
      negative_pct: entry?.negative_pct,
      col,
      row,
      isFuture: cur > today,
    })

    // Month label at first day of each new month (use col of that week)
    const month = cur.getMonth()
    if (month !== lastMonth && row === 0) {
      months.push({ label: cur.toLocaleDateString('en-NG', { month: 'short' }), col })
      lastMonth = month
    }

    // Advance
    cur.setDate(cur.getDate() + 1)
    row++
    if (row === 7) { row = 0; col++ }

    if (cur > today && row === 0) break
  }
  // Flush remaining row cells if week didn't complete
  if (row > 0) {
    while (row < 7) {
      const dateStr = cur.toISOString().split('T')[0]
      cells.push({ date: dateStr, score: null, col, row, isFuture: true, positive_pct: null, negative_pct: null })
      cur.setDate(cur.getDate() + 1)
      row++
    }
    col++
  }

  return { cells, months, totalWeeks: col }
}

// ── Cell dimensions ───────────────────────────────────────────────────────
const CELL = 12
const GAP  = 2.5
const STEP = CELL + GAP

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', '']

// ── Component ─────────────────────────────────────────────────────────────

export function SentimentHeatmap({ data, className }: { data: HeatmapDay[]; className?: string }) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const { cells, months, totalWeeks } = useMemo(() => buildGrid(data), [data])

  // Summary stats
  const scored = useMemo(() => cells.filter(c => c.score !== null && !c.isFuture), [cells])
  const positiveDays = scored.filter(c => (c.score ?? 0) >= 60).length
  const negativeDays = scored.filter(c => (c.score ?? 0) < 40).length
  const pctPositive  = scored.length ? Math.round(positiveDays / scored.length * 100) : null
  const pctNegative  = scored.length ? Math.round(negativeDays / scored.length * 100) : null

  const svgW = totalWeeks * STEP - GAP
  const svgH = 7 * STEP - GAP
  const MONTH_Y = -16
  const DAY_X   = -28

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow mb-1">12-Month Sentiment Calendar</p>
          <h3 className="text-[15px] font-semibold tracking-tight">When was your brand loved?</h3>
        </div>
        {pctPositive !== null && (
          <div className="hidden sm:flex items-center gap-5 text-right">
            <div>
              <p className="metric text-[22px] text-green-500">{pctPositive}%</p>
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wide mt-0.5">Positive days</p>
            </div>
            <div>
              <p className="metric text-[22px] text-red-500">{pctNegative}%</p>
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wide mt-0.5">Negative days</p>
            </div>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto pb-2">
        <div className="relative" style={{ paddingLeft: 36, paddingTop: 24 }}>
          {/* Month labels */}
          <div className="absolute top-0 left-9" style={{ width: svgW }}>
            {months.map(m => (
              <span
                key={`${m.label}-${m.col}`}
                className="absolute text-[10px] text-muted-foreground/45 font-medium"
                style={{ left: m.col * STEP }}
              >
                {m.label}
              </span>
            ))}
          </div>

          {/* Day-of-week labels */}
          <div className="absolute left-0 top-6" style={{ height: svgH }}>
            {DAY_LABELS.map((label, i) => (
              label ? (
                <span
                  key={i}
                  className="absolute text-[9px] text-muted-foreground/40 font-medium"
                  style={{ top: i * STEP + 1, right: 6 }}
                >
                  {label}
                </span>
              ) : null
            ))}
          </div>

          {/* Cells */}
          <div className="relative" style={{ width: svgW, height: svgH }}>
            {cells.map((cell, idx) => {
              const x = cell.col * STEP
              const y = cell.row * STEP
              const bg = cell.isFuture ? 'transparent' : cellColor(cell.score)
              const isEmpty = cell.score === null && !cell.isFuture

              return (
                <motion.div
                  key={cell.date}
                  className={cn(
                    'absolute rounded-[2.5px] cursor-default',
                    isEmpty && 'border border-border/30',
                  )}
                  style={{
                    left:            x,
                    top:             y,
                    width:           CELL,
                    height:          CELL,
                    backgroundColor: bg,
                  }}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    duration: 0.25,
                    delay:    Math.min(idx * 0.001, 0.5),
                    ease:     [0.16, 1, 0.3, 1],
                  }}
                  onMouseEnter={e => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    setTooltip({
                      date:         cell.date,
                      score:        cell.score,
                      positive_pct: cell.positive_pct,
                      negative_pct: cell.negative_pct,
                      x: rect.left + CELL / 2,
                      y: rect.top,
                    })
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50">
        <span>Less</span>
        {[0, 25, 50, 62, 75, 88, 100].map(s => (
          <div
            key={s}
            className="h-3 w-3 rounded-[2px]"
            style={{ backgroundColor: s === 50 ? 'rgba(100,116,139,0.18)' : cellColor(s) }}
          />
        ))}
        <span>More positive</span>
      </div>

      {/* Floating tooltip — portal-like, fixed position */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y - 8, transform: 'translate(-50%, -100%)' }}
        >
          <div className="bg-[#14182B] border border-white/10 rounded-xl shadow-2xl px-3.5 py-2.5 min-w-[170px]">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.10em] text-white/40 mb-1.5">
              {fmt(tooltip.date)}
            </p>
            {tooltip.score !== null ? (
              <>
                <p className="text-[13px] font-semibold text-white tabular-nums">
                  Score: {Math.round(tooltip.score)}
                  <span className="text-white/40 text-[11px] font-normal ml-1">/ 100</span>
                </p>
                <p className="text-[10.5px] text-white/50 mt-0.5">{cellLabel(tooltip.score)}</p>
                {tooltip.positive_pct != null && (
                  <div className="flex gap-3 mt-1.5 pt-1.5 border-t border-white/10">
                    <span className="text-[10.5px] text-green-400">{Math.round(tooltip.positive_pct)}% positive</span>
                    <span className="text-[10.5px] text-red-400">{Math.round(tooltip.negative_pct ?? 0)}% negative</span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-[12px] text-white/30 italic">No crawl data</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
