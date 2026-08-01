import React from 'react'
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { SCALE_FILLS_FRAME } from './art'
import { DURATION_SEC } from './audio'
import { shotAt } from './camera'
import { Atmosphere } from './layers/Atmosphere'
import { CREAM, Grade, gradeFilter } from './layers/Grade'
import { Water } from './layers/Water'

/**
 * "Tell Me" — Dwin, The Stoic x Ṣẹwà (prod. Nuel Beatz)
 *
 * A film made from the sleeve and nothing else. The camera lives inside the
 * painting for most of the record and returns to the full square at either end,
 * so the piece opens and closes on the artwork as it was drawn. Water moves,
 * light moves, the grade follows the arrangement — but nothing is added that
 * the illustrator did not paint.
 */

const COVER = 'cover.png'

/**
 * Layers can be switched off from the CLI to time them individually, e.g.
 * `--props='{"layers":{"atmosphere":false}}'`. Everything defaults to on.
 */
export type TellMeProps = {
  layers?: {
    water?: boolean
    atmosphere?: boolean
    grade?: boolean
    backdropFilter?: boolean
  }
}

export const TellMe: React.FC<TellMeProps> = ({ layers = {} }) => {
  const on = {
    water: layers.water !== false,
    atmosphere: layers.atmosphere !== false,
    grade: layers.grade !== false,
    backdropFilter: layers.backdropFilter !== false,
  }
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  const timeSec = frame / fps

  const src = staticFile(COVER)
  const { cx, cy, s, artPx } = shotAt(frame, fps)

  // 0 while the whole sleeve is in frame, 1 once the painting fills it
  const insideness = Math.min(1, Math.max(0, (s - 1.2) / (SCALE_FILLS_FRAME + 0.06 - 1.2)))

  const left = width / 2 - cx * artPx
  const top = height / 2 - cy * artPx

  return (
    <AbsoluteFill style={{ backgroundColor: CREAM, overflow: 'hidden' }}>
      <Backdrop src={src} />

      {/* the picture, and the camera that moves through it */}
      <div
        style={{
          position: 'absolute',
          left,
          top,
          width: artPx,
          height: artPx,
        }}
      >
        <img
          src={src}
          alt=""
          style={{ position: 'absolute', inset: 0, width: artPx, height: artPx, display: 'block' }}
        />
        {on.water && (
          <Water src={src} artPx={artPx} frame={frame} timeSec={timeSec} liveliness={insideness} />
        )}
      </div>

      {/*
        The grade is applied here rather than on the picture itself. As a filter
        on the art container it forced Chromium to rasterise the whole square —
        up to 4,500px a side — to show a 1920x1080 crop of it. As a backdrop
        filter on a frame-sized element it only ever touches visible pixels.
      */}
      {on.backdropFilter && <AbsoluteFill style={{ backdropFilter: gradeFilter(timeSec, frame) }} />}

      {on.atmosphere && <Atmosphere frame={frame} timeSec={timeSec} />}
      {on.grade && (
        <Grade frame={frame} timeSec={timeSec} durationSec={DURATION_SEC} insideness={insideness} />
      )}

      <Audio src={staticFile('tell-me.mp3')} />
    </AbsoluteFill>
  )
}

/**
 * Fills the space either side of the square while the sleeve is pulled back.
 * Deliberately frame-independent so Chromium paints the expensive blur once and
 * reuses it for all 7,000-odd frames.
 */
const Backdrop: React.FC<{ src: string }> = ({ src }) => (
  <AbsoluteFill style={{ backgroundColor: CREAM }}>
    <img
      src={src}
      alt=""
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: 2400,
        height: 2400,
        transform: 'translate(-50%, -50%)',
        filter: 'blur(90px) saturate(1.45) brightness(1.16)',
        opacity: 0.5,
      }}
    />
    <AbsoluteFill
      style={{
        background: 'radial-gradient(70% 70% at 50% 50%, rgba(250,246,239,0.25), rgba(250,246,239,0.75))',
      }}
    />
  </AbsoluteFill>
)
