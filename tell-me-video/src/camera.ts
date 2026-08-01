import { PANEL, PANEL_H, PANEL_W } from './art'
import { level, snapToBeat, sustained } from './audio'

/**
 * The camera move for the whole film, keyframed against the record's structure.
 *
 * Times below are the musical landmarks read off the energy analysis; each one
 * is snapped to the detected beat grid so moves land with the track rather than
 * near it. Scale is a multiple of frame height (see art.ts), cx/cy are the point
 * of the square cover held at frame centre.
 */

export type Key = { t: number; cx: number; cy: number; s: number }

const KEYS: Key[] = [
  // --- intro: the sleeve, whole and still. Beat lands at ~0:04.
  // Scale must stay under 1.0 here or the square gets cropped by the 1080-tall
  // frame and the credits fall outside it. 0.9 leaves a margin of cream.
  { t: 0, cx: 0.5, cy: 0.5, s: 0.9 },
  { t: 4, cx: 0.5, cy: 0.5, s: 0.92 },
  { t: 15.6, cx: 0.5, cy: 0.5, s: 0.985 },

  // --- the dive: push through the border into the painting
  { t: 17.2, cx: 0.472, cy: 0.45, s: 2.6 },
  { t: 31.1, cx: 0.472, cy: 0.46, s: 2.62 },

  // --- verse (0:32): bass drops out, drift up to the two necks that make a heart
  { t: 43, cx: 0.5, cy: 0.33, s: 3.2 },
  { t: 56, cx: 0.515, cy: 0.27, s: 3.9 },

  // --- chorus (0:56): pull wide, let the whole lagoon breathe
  { t: 60, cx: 0.472, cy: 0.4, s: 2.75 },
  { t: 80, cx: 0.48, cy: 0.52, s: 2.9 },
  { t: 104, cx: 0.44, cy: 0.6, s: 3.3 },

  // --- breakdown (1:44): sink into the water, reflections and lily pads
  { t: 116, cx: 0.47, cy: 0.7, s: 3.9 },
  { t: 128, cx: 0.52, cy: 0.745, s: 4.2 },

  // --- climax (2:08): the big pull back, widest and most open at the 2:20 peak
  { t: 130.5, cx: 0.472, cy: 0.5, s: 2.65 },
  { t: 140, cx: 0.472, cy: 0.44, s: 2.58 },
  { t: 155, cx: 0.5, cy: 0.33, s: 3.1 },
  { t: 168, cx: 0.515, cy: 0.255, s: 3.6 },
  { t: 178, cx: 0.49, cy: 0.3, s: 3.15 },

  // --- airy outro (2:58): bass gone, highs up. Rise left into the sky and the
  //     lollipop, then sweep right and settle on the hand-lettered title.
  { t: 190, cx: 0.28, cy: 0.36, s: 4.3 },
  { t: 202, cx: 0.62, cy: 0.55, s: 4.0 },
  { t: 212, cx: 0.7, cy: 0.8, s: 4.2 },

  // --- return (3:36): back out to the sleeve, and rest
  { t: 224, cx: 0.472, cy: 0.55, s: 2.6 },
  { t: 232, cx: 0.5, cy: 0.5, s: 0.94 },
  { t: 240, cx: 0.5, cy: 0.5, s: 0.9 },
]

/** Snap every landmark to the beat grid, keeping the opening frame at zero. */
const TIMED: Key[] = KEYS.map((k) => ({ ...k, t: k.t === 0 ? 0 : snapToBeat(k.t) }))

/** Non-uniform Catmull-Rom: continuous velocity through every keyframe. */
function spline(keys: Key[], t: number, pick: (k: Key) => number): number {
  if (t <= keys[0].t) return pick(keys[0])
  if (t >= keys[keys.length - 1].t) return pick(keys[keys.length - 1])

  let i = 0
  while (i < keys.length - 2 && keys[i + 1].t <= t) i++

  const k0 = keys[Math.max(0, i - 1)]
  const k1 = keys[i]
  const k2 = keys[i + 1]
  const k3 = keys[Math.min(keys.length - 1, i + 2)]

  const h = k2.t - k1.t
  const u = (t - k1.t) / h

  // finite-difference tangents, time-aware so uneven spacing stays smooth
  const m1 = (pick(k2) - pick(k0)) / Math.max(1e-6, k2.t - k0.t)
  const m2 = (pick(k3) - pick(k1)) / Math.max(1e-6, k3.t - k1.t)

  const u2 = u * u
  const u3 = u2 * u
  const h00 = 2 * u3 - 3 * u2 + 1
  const h10 = u3 - 2 * u2 + u
  const h01 = -2 * u3 + 3 * u2
  const h11 = u3 - u2

  return h00 * pick(k1) + h10 * h * m1 + h01 * pick(k2) + h11 * h * m2
}

export type Shot = { cx: number; cy: number; s: number; artPx: number }

/**
 * Resolve the camera for a frame: keyframed path, plus a slow hand-held float
 * and a small push on the kick so the picture sits in the pocket of the beat.
 * The result is clamped so the painted panel always covers the frame once we
 * are inside it — no cream border sneaks in on a close shot.
 */
export function shotAt(frame: number, fps: number): Shot {
  const t = frame / fps

  let s = spline(TIMED, t, (k) => k.s)
  let cx = spline(TIMED, t, (k) => k.cx)
  let cy = spline(TIMED, t, (k) => k.cy)

  // breathing: two slow, non-harmonic drifts so the move never looks looped
  const breathe = Math.sin(t * 0.19) * 0.5 + Math.sin(t * 0.077 + 1.7) * 0.5
  s *= 1 + breathe * 0.006
  cx += Math.sin(t * 0.113 + 0.6) * 0.0022
  cy += Math.sin(t * 0.089 + 2.3) * 0.0018

  // the kick pushes the frame in fractionally; the sustained bass swells it
  s *= 1 + level('low', frame) * 0.009 + sustained('rms', frame, 20) * 0.012

  const artPx = s * 1080
  const hx = 960 / artPx
  const hy = 540 / artPx

  // Once the panel is big enough to cover the frame, keep it covering the frame
  // so no cream border sneaks into a close shot. When it can't cover (we are
  // pulled back to see the whole sleeve) the authored centre is what we want,
  // because the sleeve should sit centred in frame, not the panel.
  if (hx * 2 <= PANEL_W) cx = Math.min(PANEL.right - hx, Math.max(PANEL.left + hx, cx))
  if (hy * 2 <= PANEL_H) cy = Math.min(PANEL.bottom - hy, Math.max(PANEL.top + hy, cy))

  return { cx, cy, s, artPx }
}
