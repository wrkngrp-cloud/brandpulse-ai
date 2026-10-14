'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { ToolEvent } from '@/lib/tools/events'

/**
 * The client half of the funnel.
 *
 * A random per-visit id in sessionStorage links the steps of one visit — page
 * view, start, completion, CTA click — without identifying anybody and without
 * surviving the tab. It is not a fingerprint and there is no cookie.
 *
 * Every send is fire-and-forget and swallows its own errors. A tool that broke
 * because an analytics beacon failed would be a worse bug than a missing row.
 */

const KEY = 'bg_tool_visitor'

export function visitorId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const existing = sessionStorage.getItem(KEY)
    if (existing) return existing
    const minted = crypto.randomUUID()
    sessionStorage.setItem(KEY, minted)
    return minted
  } catch {
    // Private mode, blocked storage. The event still records, unlinked.
    return null
  }
}

export interface TrackArgs {
  event:   ToolEvent
  toolId?: string
  runId?:  string
  props?:  Record<string, string | number | boolean>
}

export function trackTool(args: TrackArgs): void {
  try {
    const body = JSON.stringify({ ...args, visitorId: visitorId() ?? undefined })
    // keepalive so a CTA click that navigates away still posts.
    void fetch('/api/tools/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch { /* nothing here is worth an exception */ }
}

/** Fires once on mount, and hands back a tracker for later events. */
export function useToolAnalytics(initial?: TrackArgs) {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current || !initial) return
    fired.current = true
    trackTool(initial)
    // The initial event is the mount event; re-firing it on prop identity
    // changes would double-count every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return useCallback((args: TrackArgs) => trackTool(args), [])
}
