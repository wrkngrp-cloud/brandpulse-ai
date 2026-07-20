'use client'

import { useEffect, useState } from 'react'
import { DARK, Footer, LIGHT, Nav } from './landing-page'
import { darkSceneVars, lightSceneVars } from './scenes'

/** Shared chrome for marketing pages outside `/`: same nav, footer and theme
 *  toggle as the landing page, persisted in the same localStorage key. */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (window.localStorage.getItem('bg-landing-theme') === 'dark') setDark(true)
    })
    return () => cancelAnimationFrame(id)
  }, [])
  function toggle() {
    setDark(d => {
      window.localStorage.setItem('bg-landing-theme', d ? 'light' : 'dark')
      return !d
    })
  }
  return (
    <main
      className="min-h-screen antialiased transition-colors duration-500"
      style={{ ...(dark ? DARK : LIGHT), ...(dark ? darkSceneVars : lightSceneVars), background: 'var(--lp-bg)', color: 'var(--lp-ink)' }}
    >
      <Nav dark={dark} onToggle={toggle} />
      {children}
      <Footer />
    </main>
  )
}
