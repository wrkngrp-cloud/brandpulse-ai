'use client'

import { createContext, useContext, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { stripDeskPrefix } from '@/lib/desk/desk-path'

/**
 * Every link inside the Desk, written once in the shape that always works.
 *
 * The Desk answers on two hosts and wants two different paths. On a
 * deployment URL it lives at `/desk/...`. On `desk.brandgauge.app` the
 * middleware strips that prefix on the way in and then 404s anything that
 * still carries it, so a link written as `/desk/inbox/<id>` is refused on the
 * one host the Desk actually runs on.
 *
 * That had been getting written by hand, and by 20 October six links across
 * the Desk had it wrong: every account, every staff member, the leads funnel,
 * the way back to leads, and every conversation in the inbox. All of them
 * returned the middleware's own "Not found" on the live host while working
 * perfectly on a preview, which is exactly the bug nobody catches.
 *
 * So writing the prefix by hand is no longer a thing anyone has to remember.
 * `DeskLink` takes the `/desk/...` path, which is the one that reads clearly
 * and matches the folder on disk, and resolves it for the host in front of
 * it. `useDeskHref` does the same for a `router.push`. `npm run desk:check`
 * fails the build when a raw `/desk` link reappears.
 */

const DeskHostContext = createContext(false)

/** Rendered by the signed-in layout, which is the one place that can answer this. */
export function DeskHostProvider({ onDesk, children }: { onDesk: boolean; children: React.ReactNode }) {
  return <DeskHostContext.Provider value={onDesk}>{children}</DeskHostContext.Provider>
}

/** Turn a `/desk/...` path into the one this host will answer. */
export function useDeskHref(): (mainHostPath: string) => string {
  const onDesk = useContext(DeskHostContext)
  return useCallback(
    (mainHostPath: string) => (onDesk ? stripDeskPrefix(mainHostPath) : mainHostPath),
    [onDesk],
  )
}

/** `router.push`, with the same resolution. */
export function useDeskRouter() {
  const router = useRouter()
  const href = useDeskHref()
  return {
    push: useCallback((mainHostPath: string) => router.push(href(mainHostPath)), [router, href]),
  }
}

type DeskLinkProps = Omit<React.ComponentProps<typeof Link>, 'href'> & { href: string }

/** A `next/link` that writes the right path for whichever host is serving. */
export function DeskLink({ href, ...rest }: DeskLinkProps) {
  const resolve = useDeskHref()
  return <Link href={resolve(href)} {...rest} />
}
