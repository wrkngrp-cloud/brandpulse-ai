'use client'

import { Footer, LP_VARS, Nav } from './landing-page'
import { darkSceneVars, lightSceneVars } from './scenes'
import { useMode } from './use-mode'

/** Shared chrome for marketing pages outside `/`: same nav, footer and mode
 *  toggle as the landing page, and the same document-level mode. */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  const { dark, toggle } = useMode()
  return (
    <main
      className="min-h-screen antialiased transition-colors duration-500"
      style={{ ...LP_VARS, ...(dark ? darkSceneVars : lightSceneVars), background: 'var(--lp-bg)', color: 'var(--lp-ink)' }}
    >
      <Nav dark={dark} onToggle={toggle} />
      {children}
      <Footer />
    </main>
  )
}
