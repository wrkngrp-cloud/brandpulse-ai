import React from 'react'
import { level, mulberry32, sustained } from '../audio'

/**
 * Light in front of the picture: bloom, sun shafts and drifting motes.
 *
 * These live in screen space rather than art space on purpose — they should
 * read as light falling on the lens, so they hold still while the camera moves
 * through the painting instead of sliding around with it.
 */

const MOTES = (() => {
  const rand = mulberry32(0x7e11)
  return Array.from({ length: 42 }, () => ({
    x: rand(),
    y: rand(),
    r: 2 + rand() * 9,
    speed: 0.006 + rand() * 0.018,
    sway: 0.25 + rand() * 0.5,
    phase: rand() * Math.PI * 2,
    alpha: 0.1 + rand() * 0.3,
    warm: rand() > 0.45,
  }))
})()

export const Atmosphere: React.FC<{ frame: number; timeSec: number }> = ({ frame, timeSec }) => {
  const body = sustained('rms', frame, 20)
  const kick = level('low', frame)
  const air = sustained('high', frame, 10)

  return (
    <>
      {/* warm bloom — swells with the low end, so the picture breathes on the beat */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(58% 46% at 62% 26%, rgba(255,176,96,0.5), rgba(255,140,70,0.14) 45%, transparent 72%)',
          mixBlendMode: 'screen',
          opacity: 0.16 + body * 0.24 + kick * 0.12,
        }}
      />

      {/* a cooler counter-light from low left keeps the water from going muddy */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(52% 44% at 22% 84%, rgba(120,205,225,0.34), transparent 68%)',
          mixBlendMode: 'screen',
          opacity: 0.1 + body * 0.14,
        }}
      />

      <Shafts timeSec={timeSec} strength={0.5 + air * 0.9} />

      {MOTES.map((m, i) => {
        // drift upward, wrapping past the top of frame
        const y = (((m.y - timeSec * m.speed) % 1.25) + 1.25) % 1.25 - 0.12
        const x = m.x + Math.sin(timeSec * m.sway + m.phase) * 0.018
        const twinkle = 0.55 + 0.45 * Math.sin(timeSec * (1.1 + m.sway) + m.phase * 2)
        const opacity = m.alpha * twinkle * (0.3 + air * 0.85)
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              width: m.r * 2,
              height: m.r * 2,
              borderRadius: '50%',
              background: m.warm
                ? 'radial-gradient(circle, rgba(255,238,214,0.95), rgba(255,214,164,0) 70%)'
                : 'radial-gradient(circle, rgba(226,248,255,0.9), rgba(196,236,255,0) 70%)',
              filter: `blur(${m.r * 0.32}px)`,
              mixBlendMode: 'screen',
              opacity,
            }}
          />
        )
      })}
    </>
  )
}

/** Soft diagonal light bars, drifting slowly across frame. */
const Shafts: React.FC<{ timeSec: number; strength: number }> = ({ timeSec, strength }) => {
  const bars = []
  for (let i = 0; i < 5; i++) {
    const drift = ((i * 0.24 + timeSec * 0.011) % 1.5) - 0.25
    const w = 90 + i * 55
    const alpha = (0.03 + (i % 2) * 0.016) * strength
    bars.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          top: -700,
          left: `${drift * 120 - 10}%`,
          width: w,
          height: 2600,
          background: `linear-gradient(90deg, transparent, rgba(255,226,186,${alpha.toFixed(4)}), transparent)`,
          transform: 'rotate(17deg)',
          filter: 'blur(26px)',
          mixBlendMode: 'screen',
        }}
      />,
    )
  }
  return <>{bars}</>
}
