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
 * Whether deskUrl can produce a link that works outside the browser.
 *
 * With neither NEXT_PUBLIC_DESK_URL nor an app URL set, deskUrl returns a bare
 * path, which is fine in a page and useless in an email. An invitation that
 * mails a relative link looks sent and cannot be opened, so the caller checks
 * first and says what is missing.
 */
export function deskUrlIsAbsolute(): boolean {
  return deskUrl('/').startsWith('http')
}
