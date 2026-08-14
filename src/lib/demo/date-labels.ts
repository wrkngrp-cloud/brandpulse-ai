/* ─────────────────────────────────────────────────────────────────────────────
   Demo seed date labels

   Every demo seed places its rows at a relative offset from "now" (see the
   `dAgo` / `tsAgo` helpers in each seed route), so the charts re-anchor
   themselves each time a seed runs. The narrative copy has to travel with them.
   When a briefing, an AI answer or an event note names a calendar month
   outright, that month is correct only on the day the seed was written, and
   every run after that drifts a little further from the data behind it.

   These helpers turn a day-offset into the label the copy should carry, so the
   prose and the numbers are always reading off the same clock.

   Formatting is pinned to UTC on purpose. `dAgo` builds its date strings from
   `toISOString()`, so a UTC label is guaranteed to name the same calendar day
   as the row it describes. Formatting in Africa/Lagos would agree almost
   always and disagree for the hour before midnight UTC, which is exactly the
   kind of off-by-one that is invisible in review and obvious in a demo.
───────────────────────────────────────────────────────────────────────────── */

const LOCALE = 'en-NG'

function at(base: Date, daysBack: number): Date {
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() - daysBack)
  return d
}

function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:  return `${n}st`
    case 2:  return `${n}nd`
    case 3:  return `${n}rd`
    default: return `${n}th`
  }
}

export interface DateLabels {
  /** "December 2025" */
  monthYear(daysBack: number): string
  /** "Dec 2025" */
  monthYearShort(daysBack: number): string
  /** "December" */
  month(daysBack: number): string
  /** "7 December 2025" */
  fullDate(daysBack: number): string
  /** "7 December" */
  dayMonth(daysBack: number): string
  /** "Q4 2025" */
  quarter(daysBack: number): string
  /** "2025" */
  year(daysBack: number): string
  /** "7th" — for copy like "the campaign launched on the 7th" */
  ordinalDay(daysBack: number): string
  /**
   * "October–December 2025", collapsing to "December 2025" when both ends land
   * in the same month and to "November 2025 – January 2026" across a year end.
   */
  monthRange(fromDaysBack: number, toDaysBack: number): string
}

export function createDateLabels(base: Date): DateLabels {
  const fmt =
    (opts: Intl.DateTimeFormatOptions) =>
    (daysBack: number): string =>
      at(base, daysBack).toLocaleDateString(LOCALE, { timeZone: 'UTC', ...opts })

  const monthYear      = fmt({ month: 'long',  year: 'numeric' })
  const monthYearShort = fmt({ month: 'short', year: 'numeric' })
  const month          = fmt({ month: 'long' })

  return {
    monthYear,
    monthYearShort,
    month,
    fullDate: fmt({ day: 'numeric', month: 'long', year: 'numeric' }),
    dayMonth: fmt({ day: 'numeric', month: 'long' }),

    quarter(daysBack) {
      const d = at(base, daysBack)
      return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`
    },

    year(daysBack) {
      return String(at(base, daysBack).getUTCFullYear())
    },

    ordinalDay(daysBack) {
      return ordinal(at(base, daysBack).getUTCDate())
    },

    monthRange(fromDaysBack, toDaysBack) {
      const from = at(base, fromDaysBack)
      const to   = at(base, toDaysBack)
      const sameMonth =
        from.getUTCFullYear() === to.getUTCFullYear() &&
        from.getUTCMonth()    === to.getUTCMonth()
      if (sameMonth) return monthYear(toDaysBack)
      if (from.getUTCFullYear() === to.getUTCFullYear()) {
        return `${month(fromDaysBack)}–${monthYear(toDaysBack)}`
      }
      return `${monthYear(fromDaysBack)} – ${monthYear(toDaysBack)}`
    },
  }
}
