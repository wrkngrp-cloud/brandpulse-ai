'use client'

import { useEffect } from 'react'
import { touchPresence } from '@/app/desk/actions'

/**
 * "Somebody is on the Desk."
 *
 * The chat widget decides whether to promise a live reply from staff
 * `last_seen_at`, and that only moved when a page was requested. The screen
 * where staff sit longest is a thread they are reading while the customer
 * types, which requests nothing, so presence went stale exactly when it
 * mattered and the widget started asking for an email mid-conversation.
 *
 * Every two minutes, and the write itself is throttled server side on the same
 * interval, so this is one row update per tab per two minutes. It renders
 * nothing.
 */
const BEAT_MS = 2 * 60 * 1000

export function PresenceBeat() {
  useEffect(() => {
    const beat = () => { void touchPresence() }
    const timer = setInterval(beat, BEAT_MS)
    // A tab coming back to the front has usually been asleep, and the browser
    // throttles timers in background tabs, so catch up on focus too.
    const onVisible = () => { if (document.visibilityState === 'visible') beat() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return null
}
