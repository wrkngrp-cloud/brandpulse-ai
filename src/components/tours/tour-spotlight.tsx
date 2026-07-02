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

const CARD_W        = 340
const CARD_H        = 220  // generous estimate
const OFFSET        =  14
const HIGHLIGHT_PAD =   8

const CENTER_STYLE: React.CSSProperties = {
  position:  'fixed',
  top:       '50%',
  left:      '50%',
  transform: 'translate(-50%, -50%)',
}

function isMostlyInViewport(rect: DOMRect): boolean {
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  )
}

function computeCardStyle(rect: DOMRect, position: TourStep['position']): React.CSSProperties {
  const pos = position ?? 'bottom'
  const vw  = window.innerWidth
  const vh  = window.innerHeight

  let top:  number
  let left: number

  switch (pos) {
    case 'top':
      top  = rect.top - CARD_H - OFFSET
      left = rect.left + rect.width / 2 - CARD_W / 2
      break
    case 'bottom':
      top  = rect.bottom + OFFSET
      left = rect.left + rect.width / 2 - CARD_W / 2
      break
    case 'left':
      top  = rect.top + rect.height / 2 - CARD_H / 2
      left = rect.left - CARD_W - OFFSET
      break
    case 'right':
      top  = rect.top + rect.height / 2 - CARD_H / 2
      left = rect.right + OFFSET
      break
    default:
      top  = rect.bottom + OFFSET
      left = rect.left + rect.width / 2 - CARD_W / 2
  }

  // Clamp to viewport with 16px padding
  left = Math.max(16, Math.min(left, vw - CARD_W - 16))
  top  = Math.max(16, Math.min(top,  vh - CARD_H - 16))

  return { position: 'fixed', top, left, transform: 'none' }
}

export function TourSpotlight({ steps, onComplete, initialStep = 0 }: TourSpotlightProps) {
  const [current,    setCurrent]    = useState(initialStep)
  const [cardStyle,  setCardStyle]  = useState<React.CSSProperties>(CENTER_STYLE)
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
        setCardStyle(CENTER_STYLE)
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

    let settleTimer: ReturnType<typeof setTimeout> | undefined
    if (!isMostlyInViewport(el.getBoundingClientRect())) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      settleTimer = setTimeout(sync, 380)
    } else {
      sync()
    }

    window.addEventListener('scroll', sync, { passive: true })
    window.addEventListener('resize', sync)
    return () => {
      if (settleTimer) clearTimeout(settleTimer)
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
      {targetRect && (
        <motion.div
          key={`spotlight-${current}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position:     'fixed',
            top:          targetRect.top - HIGHLIGHT_PAD,
            left:         targetRect.left - HIGHLIGHT_PAD,
            width:        targetRect.width + HIGHLIGHT_PAD * 2,
            height:       targetRect.height + HIGHLIGHT_PAD * 2,
            borderRadius: 14,
            boxShadow:    '0 0 0 3px #E8763E, 0 0 24px 4px rgba(232,118,62,0.35), 0 0 0 9999px rgba(0,0,0,0.6)',
            zIndex:       9992,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />
      )}

      {/* Card */}
      <motion.div
        key={`tour-card-${current}`}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        style={{ ...cardStyle, width: CARD_W, zIndex: 9995 }}
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
