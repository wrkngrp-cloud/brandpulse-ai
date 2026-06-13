'use client'

interface UrlLengthAdvisorProps {
  url:        string
  formatType: string
}

const FORMAT_LIMITS: Record<string, { ideal: number; max: number; note: string }> = {
  'Lamppole':         { ideal: 12, max: 15, note: 'Eye-level, walking speed — 2–3 sec read window' },
  'Lamp Post Banner': { ideal: 12, max: 15, note: 'Eye-level, walking speed — 2–3 sec read window' },
  'Transit Shelter':  { ideal: 16, max: 20, note: 'Pedestrian + slow traffic — 4–5 sec dwell' },
  'Bridge Panel':     { ideal: 18, max: 22, note: 'Highway speed — ~2 sec read window' },
  'Unipole':          { ideal: 20, max: 25, note: '60–100 km/h — 3–5 sec visibility' },
  'Billboard':        { ideal: 20, max: 25, note: '60 km/h — 3–5 sec read window' },
  'Wall Mural':       { ideal: 20, max: 28, note: 'Pedestrian zone — longer dwell' },
  'Mall Display':     { ideal: 22, max: 30, note: 'Indoor foot traffic — longer dwell' },
  'Digital Billboard': { ideal: 25, max: 35, note: 'Animated display — but shorter still wins' },
  'Other':            { ideal: 20, max: 25, note: 'Standard billboard guideline' },
}

const DEFAULT_LIMIT = { ideal: 20, max: 25, note: 'Standard billboard guideline' }

export function UrlLengthAdvisor({ url, formatType }: UrlLengthAdvisorProps) {
  if (!url || !formatType) return null

  const limits = FORMAT_LIMITS[formatType] ?? DEFAULT_LIMIT
  const len    = url.length
  const pct    = Math.min(100, (len / limits.max) * 100)

  const status = len <= limits.ideal ? 'good'
    : len <= limits.max              ? 'warn'
    : 'bad'

  const statusColors = {
    good: { bar: 'bg-green-500',  text: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30' },
    warn: { bar: 'bg-amber-500',  text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
    bad:  { bar: 'bg-red-500',    text: 'text-red-700 dark:text-red-400',     bg: 'bg-red-50 dark:bg-red-950/30'     },
  }

  const c = statusColors[status]

  const message = status === 'good'
    ? `${len} chars — good for ${formatType}. Ideal is ≤${limits.ideal}.`
    : status === 'warn'
    ? `${len} chars — borderline for ${formatType}. Aim for ≤${limits.ideal}. Use the short code above.`
    : `${len} chars — too long for ${formatType}. A driver/pedestrian needs ${Math.ceil(len / 5)}+ seconds to read this. Shorten to ≤${limits.max}.`

  return (
    <div className={`rounded-md px-3 py-2 text-xs ${c.bg} ${c.text} space-y-1.5`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{message}</span>
        <span className="shrink-0 font-mono tabular-nums">{len}/{limits.max}</span>
      </div>
      <div className="h-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${c.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="opacity-70">{limits.note}</p>
    </div>
  )
}
