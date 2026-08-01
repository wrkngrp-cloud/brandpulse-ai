import { PANEL, PANEL_H, PANEL_W } from './art'
import { level, snapToBeat, sustained } from './audio'

/**
 * The camera move for the whole film, keyframed against the record's structure.
 *
 * Times below are the musical landmarks read off the energy analysis; each one
 * is snapped to the detected beat grid so moves land with the track rather than
 * near it. Scale is a multiple of frame height (see art.ts), cx/cy are the point
 * of the square cover held at frame centre.
 *
 * `free` releases a shot from the rule that the painted panel must cover the
 * frame. It is set only where the composition wants the border in shot: the
 * sleeve at either end, and the closing beat on the hand-lettered title, which
 * the illustrator drew hanging off the panel onto the cream and which therefore
 * cannot be framed properly from inside the panel at all.
 */

export type Key = { t: number; cx: number; cy: number; s: number; free?: boolean }

const KEYS: Key[] = [
  // --- intro: the sleeve, whole and still. Beat lands at ~0:04.
  // Scale must stay under 1.0 here or the square gets cropped by the 1080-tall
  // frame and the credits fall outside it. 0.9 leaves a margin of cream.
  { t: 0, cx: 0.5, cy: 0.5, s: 0.9, free: true },
  { t: 4, cx: 0.5, cy: 0.5, s: 0.92, free: true },
  { t: 15.6, cx: 0.5, cy: 0.5, s: 0.985, free: true },

  // --- the dive: push through the border into the painting
  { t: 17.2, cx: 0.5, cy: 0.46, s: 2.45 },
  { t: 31.1, cx: 0.5, cy: 0.47, s: 2.5 },

  // --- verse (0:32): bass drops out, drift up to the two necks that make a heart
  { t: 43, cx: 0.5, cy: 0.33, s: 3.0 },
  { t: 56, cx: 0.505, cy: 0.25, s: 3.7 },

  // --- chorus (0:56): pull wide, let the whole lagoon breathe
  { t: 60, cx: 0.5, cy: 0.42, s: 2.6 },
  { t: 80, cx: 0.52, cy: 0.55, s: 2.8 },
  { t: 104, cx: 0.45, cy: 0.62, s: 3.2 },

  // --- breakdown (1:44): sink into the water, reflections and lily pads
  { t: 116, cx: 0.48, cy: 0.7, s: 3.7 },
  { t: 128, cx: 0.55, cy: 0.74, s: 4.0 },

  // --- climax (2:08): the big pull back, widest and most open at the 2:20 peak
  { t: 130.5, cx: 0.5, cy: 0.5, s: 2.5 },
  { t: 140, cx: 0.5, cy: 0.45, s: 2.42 },
  { t: 155, cx: 0.5, cy: 0.33, s: 2.95 },
  { t: 168, cx: 0.505, cy: 0.26, s: 3.6 },
  { t: 178, cx: 0.49, cy: 0.3, s: 3.1 },

  // --- airy outro (2:58): bass gone, highs up. Rise left into the sky, the
  //     lollipop and the third flamingo, then sweep right across the water.
  { t: 190, cx: 0.27, cy: 0.35, s: 4.1 },
  { t: 202, cx: 0.62, cy: 0.56, s: 3.8 },

  // --- the title, complete, with the cream it was drawn to sit on
  { t: 212, cx: 0.655, cy: 0.79, s: 2.6, free: true },

  // --- return (3:36): back out to the sleeve, and rest
  { t: 224, cx: 0.54, cy: 0.62, s: 1.9, free: true },
  { t: 232, cx: 0.5, cy: 0.5, s: 0.94, free: true },
  { t: 240, cx: 0.5, cy: 0.5, s: 0.9, free: true },
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

/** Eased, so the border comes into shot gradually rather than switching on. */
function freedomAt(keys: Key[], t: number): number {
  if (t <= keys[0].t) return keys[0].free ? 1 : 0
  if (t >= keys[keys.length - 1].t) return keys[keys.length - 1].free ? 1 : 0
  let i = 0
  while (i < keys.length - 2 && keys[i + 1].t <= t) i++
  const a = keys[i].free ? 1 : 0
  const b = keys[i + 1].free ? 1 : 0
  if (a === b) return a
  const u = (t - keys[i].t) / (keys[i + 1].t - keys[i].t)
  return a + (b - a) * u * u * (3 - 2 * u)
}

export type Shot = { cx: number; cy: number; s: number; artPx: number }

/**
 * Resolve the camera for a frame: keyframed path, plus a slow hand-held float
 * and a small push on the kick so the picture sits in the pocket of the beat.
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
  // so no cream border sneaks into a close shot — except where the shot is
  // deliberately framed to include it.
  const freedom = freedomAt(TIMED, t)
  if (freedom < 1) {
    if (hx * 2 <= PANEL_W) {
      const held = Math.min(PANEL.right - hx, Math.max(PANEL.left + hx, cx))
      cx = held + (cx - held) * freedom
    }
    if (hy * 2 <= PANEL_H) {
      const held = Math.min(PANEL.bottom - hy, Math.max(PANEL.top + hy, cy))
      cy = held + (cy - held) * freedom
    }
  }

  // and never let the frame run off the edge of the sleeve itself
  if (hx * 2 <= 1) cx = Math.min(1 - hx, Math.max(hx, cx))
  if (hy * 2 <= 1) cy = Math.min(1 - hy, Math.max(hy, cy))

  return { cx, cy, s, artPx }
}
