/**
 * The string transform `deskHref` needs, pulled into its own file (no
 * `next/headers` import) because the Desk's nav (`desk-shell.tsx`) is a
 * client component and can't pull in anything that touches a server-only
 * API, even indirectly. Its server-rendered layout answers `onDeskHost()`
 * once and hands the plain boolean down as a prop; the nav uses this
 * directly with that boolean.
 */
export function stripDeskPrefix(mainHostPath: string): string {
  const [path, query] = mainHostPath.split('?')
  const stripped = path.replace(/^\/desk/, '') || '/'
  return query ? `${stripped}?${query}` : stripped
}
