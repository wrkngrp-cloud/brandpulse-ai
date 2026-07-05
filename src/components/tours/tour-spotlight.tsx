'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import type { TourStep } from '@/lib/tour-definitions'

export type TourSpotlightProps = {
  module:       string
  steps:        TourStep[]
  onComplete:   (status: 'completed' | 'skipped') => void
  initialStep?: number
}

const CARD_W_MAX     = 340
const VIEWPORT_MARGIN =  16
const CARD_H        = 260  // generous estimate — body text wraps taller on narrow phones
const OFFSET        =  14
const HIGHLIGHT_PAD =   8
const HL_EDGE_MARGIN =   4  // keep the ring just inside the screen edge when a target overflows the viewport

// Centers the card using plain top/left pixel math instead of a CSS
// `transform: translate(-50%, -50%)`. framer-motion's `animate={{ scale }}`
// owns the `transform` property on this element, so a manually-set translate
// gets silently overwritten — the card would render flush against the
// left/top edge (50% with no offset) instead of centered, invisibly
// overflowing on any viewport narrower than roughly 2x the card width.
function computeCenterStyle(): React.CSSProperties {
  const cw = cardWidth()
  const vw = window.innerWidth
  const vh = window.innerHeight
  return {
    position: 'fixed',
    top:      Math.max(VIEWPORT_MARGIN, (vh - CARD_H) / 2),
    left:     Math.max(VIEWPORT_MARGIN, (vw - cw) / 2),
    transform: 'none',
  }
}

function isMostlyInViewport(rect: DOMRect): boolean {
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  )
}

// Card can never be wider than the viewport allows, so it never overflows on
// narrow phones (e.g. 320px-wide screens where CARD_W_MAX would clip).
function cardWidth(): number {
  return Math.min(CARD_W_MAX, window.innerWidth - VIEWPORT_MARGIN * 2)
}

function computeCardStyle(rect: DOMRect, position: TourStep['position']): React.CSSProperties {
  const pos = position ?? 'bottom'
  const vw  = window.innerWidth
  const vh  = window.innerHeight
  const cw  = cardWidth()

  let top:  number
  let left: number

  switch (pos) {
    case 'top':
      top  = rect.top - CARD_H - OFFSET
      left = rect.left + rect.width / 2 - cw / 2
      break
    case 'bottom':
      top  = rect.bottom + OFFSET
      left = rect.left + rect.width / 2 - cw / 2
      break
    case 'left':
      top  = rect.top + rect.height / 2 - CARD_H / 2
      left = rect.left - cw - OFFSET
      break
    case 'right':
      top  = rect.top + rect.height / 2 - CARD_H / 2
      left = rect.right + OFFSET
      break
    default:
      top  = rect.bottom + OFFSET
      left = rect.left + rect.width / 2 - cw / 2
  }

  // Clamp to viewport with margin
  left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - cw - VIEWPORT_MARGIN))
  top  = Math.max(VIEWPORT_MARGIN, Math.min(top,  vh - CARD_H - VIEWPORT_MARGIN))

  return { position: 'fixed', top, left, transform: 'none' }
}

// Highlight box clamped to the visible viewport — if the target itself is
// taller or wider than the screen, the ring still shows a clear boundary at
// the screen edge instead of rendering fully off-screen and invisible.
function computeHighlightBox(rect: DOMRect) {
  const top    = Math.max(rect.top - HIGHLIGHT_PAD, HL_EDGE_MARGIN)
  const left   = Math.max(rect.left - HIGHLIGHT_PAD, HL_EDGE_MARGIN)
  const bottom = Math.min(rect.bottom + HIGHLIGHT_PAD, window.innerHeight - HL_EDGE_MARGIN)
  const right  = Math.min(rect.right + HIGHLIGHT_PAD, window.innerWidth - HL_EDGE_MARGIN)
  return { top, left, width: Math.max(right - left, 0), height: Math.max(bottom - top, 0) }
}

export function TourSpotlight({ steps, onComplete, initialStep = 0 }: TourSpotlightProps) {
  const [current,    setCurrent]    = useState(initialStep)
  const [cardStyle,  setCardStyle]  = useState<React.CSSProperties>(computeCenterStyle)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  const step     = steps[current]
  const isLast   = current === steps.length - 1
  const isFirst  = current === 0

  // Track and highlight the step's target element — scroll it into view if
  // it's off-screen, then keep the highlight box synced while scrolling/resizing.
  useEffect(() => {
    if (!step) return

    const el = step.target ? document.querySelector(step.target) : null

    function sync() {
      if (!el) {
        setTargetRect(null)
        setCardStyle(computeCenterStyle())
        return
      }
      const rect = el.getBoundingClientRect()
      setTargetRect(rect)
      setCardStyle(computeCardStyle(rect, step.position))
    }

    if (!el) {
      sync()
      return
    }

    if (!isMostlyInViewport(el.getBoundingClientRect())) {
      // Sections taller than the viewport can never be centered — 'center'
      // would clip both ends equally, hiding the heading the user needs to
      // see. Aligning to 'start' instead guarantees the top of the section
      // (and as much of it as fits) stays in frame.
      const tallerThanViewport = el.getBoundingClientRect().height > window.innerHeight - HL_EDGE_MARGIN * 2
      el.scrollIntoView({ behavior: 'smooth', block: tallerThanViewport ? 'start' : 'center' })
    }

    // Counting animation frames to guess "the layout has settled" is
    // inherently racy — how many frames a transition takes depends on the
    // browser, GPU load and, critically, whether the tab even has focus
    // (Chrome throttles requestAnimationFrame and timers hard in background
    // tabs, so a frame-counted wait behaves completely differently there
    // than in the foreground tab a real user is looking at). That's how a
    // highlight clipping the first card of a 4-column row survived local
    // testing twice: the grid's own outer box was still narrower than its
    // settled width at measurement time (a genuine box resize, not just an
    // internal reflow), and polling never sampled at the right moment to
    // catch it.
    //
    // ResizeObserver has none of that guesswork — the browser's own layout
    // engine calls it exactly when the observed element's box actually
    // changes size, whatever transition or async render caused it and
    // however fast or throttled the tab is. Combined with a MutationObserver
    // watching for attribute changes (framer-motion writes inline
    // transform/opacity styles directly, which can shift position without a
    // resize), this re-measures on every real cause of drift instead of
    // sampling on a timer and hoping it landed after things settled.
    const resizeObserver = new ResizeObserver(() => sync())
    resizeObserver.observe(el)

    const mutationObserver = new MutationObserver(() => sync())
    mutationObserver.observe(el, { attributes: true, attributeFilter: ['style', 'class'] })

    sync()

    window.addEventListener('scroll', sync, { passive: true })
    window.addEventListener('resize', sync)
    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
    }
  }, [current, step])

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete('completed')
    } else {
      setCurrent(c => c + 1)
    }
  }, [isLast, onComplete])

  const handleBack = useCallback(() => {
    if (!isFirst) setCurrent(c => c - 1)
  }, [isFirst])

  const handleSkip = useCallback(() => {
    onComplete('skipped')
  }, [onComplete])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')                         handleSkip()
      if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext()
      if (e.key === 'ArrowLeft')                       handleBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSkip, handleNext, handleBack])

  if (!step) return null

  const hasHighlight = targetRect !== null

  return (
    <AnimatePresence>
      {/* Click-catcher — dims the whole screen when there's nothing to spotlight,
          stays invisible (but still catches click-to-skip) when a target is highlighted,
          since the highlight box below provides the actual dimming in that case. */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={`fixed inset-0 z-[9990] ${hasHighlight ? '' : 'bg-black/30'}`}
        onClick={handleSkip}
        aria-hidden="true"
      />

      {/* Spotlight — dims everything except the target's rect, with a highlighted ring */}
      {targetRect && (() => {
        const box = computeHighlightBox(targetRect)
        return (
          <motion.div
            key={`spotlight-${current}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position:     'fixed',
              top:          box.top,
              left:         box.left,
              width:        box.width,
              height:       box.height,
              borderRadius: 14,
              boxShadow:    '0 0 0 3px #E8763E, 0 0 24px 4px rgba(232,118,62,0.35), 0 0 0 9999px rgba(0,0,0,0.6)',
              zIndex:       9992,
              pointerEvents: 'none',
            }}
            aria-hidden="true"
          />
        )
      })()}

      {/* Card */}
      <motion.div
        key={`tour-card-${current}`}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        style={{ ...cardStyle, width: cardWidth(), zIndex: 9995 }}
        className="bg-background border border-border rounded-xl shadow-xl p-5 space-y-3"
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step counter */}
        <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider select-none">
          {current + 1} of {steps.length}
        </p>

        {/* Title */}
        <h3 className="text-[15px] font-semibold leading-snug">
          {step.title}
        </h3>

        {/* Body */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {step.body}
        </p>

        {/* Progress dots */}
        <div className="flex items-center gap-1 pt-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current
                  ? 'w-4 bg-foreground'
                  : 'w-1.5 bg-muted-foreground/25'
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-[12px] h-8 text-muted-foreground hover:text-foreground mr-auto"
            onClick={handleSkip}
          >
            Skip tour
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-[12px] h-8"
            onClick={handleBack}
            disabled={isFirst}
          >
            Back
          </Button>
          <Button
            size="sm"
            className="text-[12px] h-8"
            onClick={handleNext}
          >
            {isLast ? 'Done' : 'Next'}
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
