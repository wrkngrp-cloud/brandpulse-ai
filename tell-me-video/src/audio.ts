import analysis from './audio-analysis.json'

/**
 * Typed read layer over the offline analysis. Everything the film does in time
 * with the record comes through here, so no audio work happens at render time
 * and every frame is reproducible.
 */

export const FPS = analysis.fps
export const DURATION_SEC = analysis.durationSec
export const TOTAL_FRAMES = analysis.totalFrames
export const BPM = analysis.bpm
export const BEAT_PERIOD = analysis.beatPeriodSec
export const BEAT_OFFSET = analysis.beatOffsetSec

type Band = keyof typeof analysis.series

const SERIES = analysis.series as Record<Band, number[]>

/** Band level at a frame, 0..1. */
export function level(band: Band, frame: number): number {
  const s = SERIES[band]
  const i = Math.min(s.length - 1, Math.max(0, frame))
  return s[i] / 255
}

/**
 * Band level with an attack/decay envelope: rises instantly on a hit, falls
 * away over `decayFrames`. Raw per-frame peaks are too twitchy to drive motion.
 */
export function pulse(band: Band, frame: number, decayFrames = 9): number {
  let best = 0
  for (let k = 0; k <= decayFrames; k++) {
    const v = level(band, frame - k) * (1 - k / (decayFrames + 1))
    if (v > best) best = v
  }
  return best
}

/** Smoothed band level — use for slow things like grade and bloom. */
export function sustained(band: Band, frame: number, radius = 12): number {
  let sum = 0
  let n = 0
  for (let k = -radius; k <= radius; k++) {
    sum += level(band, frame + k)
    n++
  }
  return sum / n
}

/** Nearest beat index at a given time, and how far through that beat we are (0..1). */
export function beatPhase(sec: number): number {
  const t = (sec - BEAT_OFFSET) / BEAT_PERIOD
  return t - Math.floor(t)
}

/** Snap a time in seconds to the nearest beat of the detected grid. */
export function snapToBeat(sec: number): number {
  return BEAT_OFFSET + Math.round((sec - BEAT_OFFSET) / BEAT_PERIOD) * BEAT_PERIOD
}

/** Deterministic PRNG so particle fields are identical on every render. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
