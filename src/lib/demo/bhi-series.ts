/**
 * Brand health snapshots for the demo accounts.
 *
 * The seeds used to compute their own score: seven legacy component names
 * (consideration, preference, advocacy, nps, sov) weighted by hardcoded
 * constants, and no formula_version, so every row defaulted to 1. Version 1 is
 * the superseded three-component formula, which means the whole seeded history
 * was stamped as not comparable with the live score, and was in fact computed
 * a third way. A demo brand's trend line and its headline number disagreed.
 *
 * This builds the same seven components the product uses and runs them through
 * computeFullBHI with the brand's own brand_type, so the seeded history is
 * produced by exactly the function that produces today's number, weighted the
 * way that vertical is weighted.
 */
import { computeFullBHI, type FullBHIComponents, type BrandType } from '@/lib/bhi'
import { BHI_FORMULA_VERSION } from '@/lib/bhi-inputs'

export interface BhiSeriesInput {
  brandId:   string
  brandType: BrandType
  /** days of history, oldest first */
  days:      number
  /** the brand's sentiment curve, already calendar-anchored */
  sentiment: (daysAgo: number) => number
  /** per-brand levels, 0-100 at the start of the window and today */
  levels: {
    awareness:  [number, number]
    salience:   [number, number]
    perception: [number, number]
    /** null for verticals with no consumer cultural component */
    cultural:   [number, number] | null
    sov:        [number, number]
    emv:        [number, number]
  }
  dateFor: (daysAgo: number) => string
}

/** Seven components for one day, on the names the product actually uses. */
function componentsFor(input: BhiSeriesInput, daysAgo: number): FullBHIComponents {
  const { days, levels } = input
  const t  = Math.min(1, Math.max(0, (days - daysAgo) / days))
  const ss = input.sentiment(daysAgo)
  // sentiment leads the other components: a brand's score moves with how it is
  // talked about, and the rest follow a few weeks later.
  const lag = (from: number, to: number) => +(from + (to - from) * t + (ss - 60) * 0.12).toFixed(1)

  return {
    awareness:         lag(levels.awareness[0],  levels.awareness[1]),
    salience:          lag(levels.salience[0],   levels.salience[1]),
    sentiment:         ss,
    perception:        lag(levels.perception[0], levels.perception[1]),
    culturalResonance: levels.cultural ? lag(levels.cultural[0], levels.cultural[1]) : null,
    blendedSov:        lag(levels.sov[0],        levels.sov[1]),
    emv:               lag(levels.emv[0],        levels.emv[1]),
  }
}

/** Snapshot rows ready to insert, scored by the real BHI function. */
export function bhiSnapshotRows(input: BhiSeriesInput) {
  const rows: Record<string, unknown>[] = []

  for (let d = input.days - 1; d >= 0; d--) {
    const components = componentsFor(input, d)
    const result = computeFullBHI(components, undefined, input.brandType)
    if (result.score === null) continue

    rows.push({
      brand_id:          input.brandId,
      snapshot_date:     input.dateFor(d),
      bhi:               result.score,
      components:        result.components,
      data_coverage_pct: result.coverage,
      // stamp the current formula, so the seeded history is comparable with
      // the snapshots the nightly job writes from today onward
      formula_version:   BHI_FORMULA_VERSION,
    })
  }

  return rows
}
