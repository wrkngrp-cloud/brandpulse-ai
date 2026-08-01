import React from 'react'
import { PANEL, WATER } from '../art'
import { level, sustained } from '../audio'

/**
 * The lagoon, made to move.
 *
 * The painting is flat, so the water is rebuilt as a stack of horizontal slices
 * of the same image, each slid sideways by a travelling wave. Slices are skewed
 * as well as offset, which makes the displacement vary continuously down each
 * slice instead of stepping — that is what lets ~70 slices read as smooth water
 * rather than as terracing, and keeps the frame cheap enough to render.
 *
 * Because the flamingo legs and their reflections live in this region, they
 * swim for free.
 */

const SLICES = 56

/** Sideways displacement, in art pixels, at depth v (0 at the horizon, 1 at the bottom). */
function displace(v: number, t: number, amp: number): number {
  return (
    amp *
    (0.62 * Math.sin(6.1 * Math.PI * v - t * 1.15) +
      0.38 * Math.sin(9.7 * Math.PI * v + t * 0.83 + 1.3) +
      0.18 * Math.sin(22 * Math.PI * v - t * 1.9 + 0.4))
  )
}

/** Analytic slope d(displace)/dv, used to skew each slice so slices join smoothly. */
function displaceSlope(v: number, t: number, amp: number): number {
  return (
    amp *
    (0.62 * 6.1 * Math.PI * Math.cos(6.1 * Math.PI * v - t * 1.15) +
      0.38 * 9.7 * Math.PI * Math.cos(9.7 * Math.PI * v + t * 0.83 + 1.3) +
      0.18 * 22 * Math.PI * Math.cos(22 * Math.PI * v - t * 1.9 + 0.4))
  )
}

type Props = {
  src: string
  /** Rendered size of the whole square cover, in px. */
  artPx: number
  frame: number
  timeSec: number
  /**
   * 0 while we are pulled back looking at the whole sleeve, 1 once we are
   * inside the painting. Holds the water still at the edges of the film, which
   * also keeps ripple from ever sliding past the painted border.
   */
  liveliness: number
}

export const Water: React.FC<Props> = ({ src, artPx, frame, timeSec, liveliness }) => {
  if (liveliness <= 0.001) return null

  const top = WATER.top * artPx
  const height = (WATER.bottom - WATER.top) * artPx
  const sliceH = height / SLICES

  // the record drives how hard the water works
  const drive = 1 + level('low', frame) * 0.55 + sustained('rms', frame, 18) * 0.35
  const ampMax = 0.0042 * artPx * drive * liveliness

  const clipLeft = PANEL.left * artPx
  const clipWidth = (PANEL.right - PANEL.left) * artPx
  const margin = Math.max(8, ampMax * 2.2)

  const slices = []
  for (let i = 0; i < SLICES; i++) {
    const v = (i + 0.5) / SLICES
    // Ripple grows toward the bottom of frame, where the water is "nearer".
    // It has to reach exactly zero at the horizon, otherwise the first slice
    // steps away from the still picture above it and leaves a visible seam.
    const depth = Math.pow(v, 1.4)
    const amp = ampMax * depth
    const dx = displace(v, timeSec, amp)
    // slope is per unit v; convert to px-per-px so it can become a skew angle
    const slopePx = displaceSlope(v, timeSec, amp) / height
    const skewDeg = (Math.atan(slopePx) * 180) / Math.PI

    slices.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          left: -margin,
          top: i * sliceH,
          width: clipWidth + margin * 2,
          height: sliceH + 1,
          backgroundImage: `url(${src})`,
          backgroundSize: `${artPx}px ${artPx}px`,
          backgroundPosition: `${margin - clipLeft}px ${-(top + i * sliceH)}px`,
          backgroundRepeat: 'no-repeat',
          transform: `translateX(${dx}px) skewX(${skewDeg}deg)`,
        }}
      />,
    )
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: clipLeft,
        top,
        width: clipWidth,
        height,
        overflow: 'hidden',
      }}
    >
      {slices}

      {/*
        Surface sheen. This used to be a per-slice brightness filter, which gave
        Chromium 56 separate layers to composite on every frame; one drifting
        overlay costs a fraction of that and reads the same.
      */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(180deg, rgba(255,250,240,0.06) 0px, rgba(255,250,240,0) 7px, rgba(8,38,58,0.055) 15px, rgba(8,38,58,0) 24px)',
          backgroundPosition: `0px ${((timeSec * 6.5) % 24).toFixed(2)}px`,
          mixBlendMode: 'soft-light',
          opacity: 0.55 + level('high', frame) * 0.45,
        }}
      />

      <Glints artPx={artPx} width={clipWidth} height={height} frame={frame} timeSec={timeSec} liveliness={liveliness} />
    </div>
  )
}

/** Slow specular streaks riding the surface, brightened by the top end of the mix. */
const Glints: React.FC<{
  artPx: number
  width: number
  height: number
  frame: number
  timeSec: number
  liveliness: number
}> = ({ width, height, frame, timeSec, liveliness }) => {
  const air = level('high', frame)
  const streaks = []
  for (let i = 0; i < 14; i++) {
    // fixed, irregular placement — no PRNG needed, and stable across renders
    const v = ((i * 0.6180339887) % 1) * 0.92 + 0.05
    const drift = ((i * 0.37 + timeSec * (0.012 + (i % 3) * 0.004)) % 1.4) - 0.2
    const w = width * (0.06 + ((i * 7) % 5) * 0.02)
    const h = Math.max(1.5, height * 0.004 * (1 + (i % 4) * 0.35))
    const wobble = Math.sin(timeSec * 0.9 + i * 1.7) * height * 0.006
    const alpha = (0.05 + air * 0.16) * (0.4 + 0.6 * Math.pow(v, 1.4)) * liveliness

    streaks.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          left: drift * width,
          top: v * height + wobble,
          width: w,
          height: h,
          borderRadius: '50%',
          background: `linear-gradient(90deg, transparent, rgba(255,246,232,${alpha.toFixed(4)}), transparent)`,
          filter: `blur(${Math.max(1, h * 0.5)}px)`,
          mixBlendMode: 'screen',
        }}
      />,
    )
  }
  return <>{streaks}</>
}
