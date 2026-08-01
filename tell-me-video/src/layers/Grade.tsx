import React from 'react'
import { staticFile } from 'remotion'
import { mulberry32, sustained } from '../audio'

/**
 * Colour grade, vignette, grain and the top-and-tail fades.
 *
 * The grade tracks the arrangement: washed and cool through the intro, warm
 * through the choruses, blue through the breakdown, high-key and bright through
 * the airy outro, then back to a clean neutral as the sleeve returns.
 */

type GradeKey = {
  t: number
  sat: number
  con: number
  bri: number
  tint: [number, number, number]
  tintA: number
}

const GRADE: GradeKey[] = [
  { t: 0, sat: 0.86, con: 0.97, bri: 1.06, tint: [235, 240, 255], tintA: 0.1 },
  { t: 16, sat: 1.0, con: 1.0, bri: 1.0, tint: [255, 210, 170], tintA: 0.04 },
  { t: 32, sat: 0.94, con: 1.02, bri: 0.99, tint: [180, 215, 240], tintA: 0.07 },
  { t: 56, sat: 1.1, con: 1.05, bri: 1.01, tint: [255, 190, 140], tintA: 0.06 },
  { t: 104, sat: 0.96, con: 1.03, bri: 0.97, tint: [150, 200, 235], tintA: 0.1 },
  { t: 128, sat: 1.16, con: 1.08, bri: 1.02, tint: [255, 180, 125], tintA: 0.07 },
  { t: 158, sat: 1.18, con: 1.09, bri: 1.03, tint: [255, 175, 120], tintA: 0.08 },
  { t: 178, sat: 1.02, con: 0.98, bri: 1.07, tint: [255, 244, 228], tintA: 0.1 },
  { t: 216, sat: 0.96, con: 0.99, bri: 1.04, tint: [250, 246, 238], tintA: 0.08 },
  { t: 240, sat: 0.9, con: 0.97, bri: 1.05, tint: [250, 246, 238], tintA: 0.08 },
]

const lerp = (a: number, b: number, u: number) => a + (b - a) * u

function gradeAt(t: number): GradeKey {
  if (t <= GRADE[0].t) return GRADE[0]
  if (t >= GRADE[GRADE.length - 1].t) return GRADE[GRADE.length - 1]
  let i = 0
  while (i < GRADE.length - 2 && GRADE[i + 1].t <= t) i++
  const a = GRADE[i]
  const b = GRADE[i + 1]
  const raw = (t - a.t) / (b.t - a.t)
  const u = raw * raw * (3 - 2 * raw) // smoothstep: no kinks at the landmarks
  return {
    t,
    sat: lerp(a.sat, b.sat, u),
    con: lerp(a.con, b.con, u),
    bri: lerp(a.bri, b.bri, u),
    tint: [
      Math.round(lerp(a.tint[0], b.tint[0], u)),
      Math.round(lerp(a.tint[1], b.tint[1], u)),
      Math.round(lerp(a.tint[2], b.tint[2], u)),
    ],
    tintA: lerp(a.tintA, b.tintA, u),
  }
}

/** CSS filter applied to the picture itself. */
export function gradeFilter(timeSec: number, frame: number): string {
  const g = gradeAt(timeSec)
  // a touch more contrast when the track is loud
  const punch = sustained('rms', frame, 24) * 0.05
  return `saturate(${g.sat.toFixed(3)}) contrast(${(g.con + punch).toFixed(3)}) brightness(${g.bri.toFixed(3)})`
}

export const CREAM = '#FAF6EF'

export const Grade: React.FC<{
  frame: number
  timeSec: number
  durationSec: number
  /** 0 when the whole sleeve is in frame, 1 when we are inside the painting. */
  insideness: number
}> = ({ frame, timeSec, durationSec, insideness }) => {
  const g = gradeAt(timeSec)

  // grain drifts a whole number of tiles each frame so it never sits still
  const rand = mulberry32(frame * 2654435761)
  const gx = Math.floor(rand() * 256)
  const gy = Math.floor(rand() * 256)

  const fadeIn = Math.min(1, timeSec / 1.6)
  const fadeOut = 1 - Math.min(1, Math.max(0, (timeSec - (durationSec - 6)) / 5.4))
  const reveal = Math.min(fadeIn, fadeOut)

  return (
    <>
      {/* section tint */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `rgb(${g.tint[0]},${g.tint[1]},${g.tint[2]})`,
          mixBlendMode: 'soft-light',
          opacity: g.tintA,
        }}
      />

      {/* vignette — only once we are inside the picture; a flat sleeve wants none */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(72% 76% at 50% 46%, transparent 42%, rgba(24,16,10,0.30) 82%, rgba(18,12,8,0.52) 100%)',
          opacity: 0.35 + insideness * 0.65,
        }}
      />

      {/* grain */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${staticFile('grain.png')})`,
          backgroundSize: '256px 256px',
          backgroundPosition: `${gx}px ${gy}px`,
          mixBlendMode: 'overlay',
          opacity: 0.055,
        }}
      />

      {/* top and tail */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: CREAM,
          opacity: 1 - reveal,
        }}
      />
    </>
  )
}
