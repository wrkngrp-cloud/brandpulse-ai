import { headers } from 'next/headers'
import { stripDeskPrefix } from './desk-path'

/**
 * Where the Desk lives, for links that have to work in an email.
 *
 * Once DESK_HOST is set the Desk answers on its own host and NEXT_PUBLIC_DESK_URL
 * is the address to use. Before that it is a path on whatever deployment is
 * running, which is how it gets previewed. Both cases resolve here so no caller
 * has to care which one is in force.
 */
export function deskUrl(path = ''): string {
  const base = process.env.NEXT_PUBLIC_DESK_URL?.replace(/\/$/, '')
  const suffix = path.startsWith('/') ? path : path ? `/${path}` : ''
  if (base) return `${base}${suffix}`

  const app = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  return `${app}/desk${suffix}`
}

/**
 * True when this request landed on the Desk's own host rather than the main
 * one. `src/proxy.ts` decides this the same way, from the same variable; this
 * is the server-component/action side of that same question.
 */
export async function onDeskHost(): Promise<boolean> {
  const deskHost = process.env.DESK_HOST?.trim().toLowerCase() || null
  if (!deskHost) return false
  const h = await headers()
  const host = (h.get('host') ?? '').split(':')[0].toLowerCase()
  return host === deskHost
}

/**
 * A `/desk/...` path, written for whichever host actually has to answer it.
 *
 * Every redirect() and server-rendered link in the Desk is written against
 * the `/desk/...` shape, because that is what always worked before DESK_HOST
 * existed and is still what works when it is unset. Once the Desk has its own
 * host, `src/proxy.ts` 404s any request that still carries that prefix there
 * (the prefix is what the rewrite stripped on the way in), so outgoing links
 * have to lose it too. This is the one place that happens, so a page that
 * forgets it is the exception rather than every page having to remember.
 */
export async function deskHref(mainHostPath: string): Promise<string> {
  return (await onDeskHost()) ? stripDeskPrefix(mainHostPath) : mainHostPath
}
