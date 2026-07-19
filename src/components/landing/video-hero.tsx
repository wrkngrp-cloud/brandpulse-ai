'use client'

import { useEffect, useRef, useState } from 'react'
import { Play } from 'lucide-react'

/**
 * Hero video frame: plays the rendered BrandGauge unveil MP4. Autoplays muted
 * and looped like a product showcase; a poster keeps first paint light, and a
 * click unmutes for sound-on viewing.
 */
export function VideoHero() {
  const ref = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    // Best-effort autoplay; browsers allow it while muted.
    ref.current?.play().catch(() => {})
  }, [])

  function toggleSound() {
    const v = ref.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
    if (v.paused) v.play().catch(() => {})
  }

  return (
    <div className="group relative overflow-hidden rounded-2xl border shadow-[0_48px_140px_-40px_rgba(212,96,42,0.28)]"
      style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
      <video
        ref={ref}
        className="aspect-video w-full"
        src="/brandgauge-unveil.mp4"
        poster="/brandgauge-poster.jpg"
        muted
        loop
        playsInline
        preload="metadata"
      />
      {/* sound toggle */}
      <button onClick={toggleSound}
        className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full border border-white/20 bg-black/45 px-3.5 py-2 text-[11px] font-medium text-white backdrop-blur transition-opacity hover:bg-black/65"
        aria-label={muted ? 'Unmute video' : 'Mute video'}>
        {muted ? (
          <>
            <Play className="h-3 w-3 fill-white" />
            Tap for sound
          </>
        ) : (
          'Sound on'
        )}
      </button>
    </div>
  )
}
