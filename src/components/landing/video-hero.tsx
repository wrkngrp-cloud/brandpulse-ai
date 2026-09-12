'use client'

import { useEffect, useRef, useState } from 'react'
import { PlayIcon as Play } from '@/components/brand/icon'

/**
 * The film, in its frame.
 *
 * Three things it used to get wrong. It started playing the moment the page
 * mounted, so by the time a reader scrolled to it the opening was over and
 * they arrived somewhere in the middle of the funnel chapter. It looped, so
 * anyone who lingered was taken past the closing card and back to the top.
 * And it had no controls at all, just a sound toggle, so there was no way to
 * go back over a bit you wanted to see again.
 *
 * Now it waits until it is genuinely on screen, runs once to the end, and
 * carries the browser's own controls so it can be paused, scrubbed and
 * rewound. If the reader pauses it themselves, scrolling away and back does
 * not start it up again: a control that overrides the person using it is not
 * a control.
 */
export function VideoHero() {
  const ref = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)
  /* The reader pressed pause. Leave it paused. */
  const held = useRef(false)
  /* The last play or pause we asked for ourselves. A media event that matches
     it is ours; anything else is the reader reaching for the controls.
     Guarding with a boolean set around the call does not work, because the
     pause event is queued rather than raised synchronously: the flag was
     already back to false by the time the handler ran, so pausing the film
     because it had scrolled off screen was recorded as the reader pausing it,
     and it never started again when you came back. Same divergence check the
     product rail uses to tell a real gesture from its own writes. */
  const intent = useRef<null | 'play' | 'pause'>(null)

  useEffect(() => {
    const v = ref.current
    if (!v) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const play = () => {
      intent.current = 'play'
      // Autoplay is only allowed while muted, and a rejected promise here is
      // a normal outcome, not an error: the poster simply stays up.
      v.play().catch(() => { intent.current = null })
    }
    const pause = () => { intent.current = 'pause'; v.pause() }

    const onPause = () => {
      if (intent.current === 'pause') { intent.current = null; return }
      if (!v.ended) held.current = true
    }
    const onPlay = () => {
      if (intent.current === 'play') { intent.current = null; return }
      held.current = false
    }
    v.addEventListener('pause', onPause)
    v.addEventListener('play', onPlay)

    /* Half of it on screen is the threshold. Any less and it starts while it
       is still a sliver at the bottom of the window, which is the problem
       this is here to solve. */
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && e.intersectionRatio >= 0.5) {
        if (!held.current && !reduce && v.paused) play()
      } else if (!v.paused) {
        pause()
      }
    }, { threshold: [0, 0.5] })
    io.observe(v)

    return () => {
      io.disconnect()
      v.removeEventListener('pause', onPause)
      v.removeEventListener('play', onPlay)
    }
  }, [])

  function toggleSound() {
    const v = ref.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
    if (v.paused) { held.current = false; v.play().catch(() => {}) }
  }

  return (
    <div className="group relative overflow-hidden rounded-sm border"
      style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
      <video
        ref={ref}
        className="aspect-video w-full"
        src="/brandgauge-unveil.mp4"
        poster="/brandgauge-poster.jpg"
        muted
        controls
        controlsList="nodownload"
        playsInline
        preload="metadata"
      />
      {/* Top right, clear of the browser's own control bar along the bottom.
          It goes once the sound is on, because from then on the volume lives
          in the controls like everything else. */}
      {muted && (
        <button onClick={toggleSound}
          className="absolute right-4 top-4 flex items-center gap-2 rounded-sm border border-line-inv bg-ink px-3.5 py-2 text-[11px] font-medium text-tx-inv transition-colors hover:bg-ink-raised bg-press"
          aria-label="Unmute video">
          <Play className="h-3 w-3 fill-tx-inv" />
          Tap for sound
        </button>
      )}
    </div>
  )
}
