import { useEffect, useState } from 'react'

/**
 * Dark is a mode, not a second theme.
 *
 * The toggle writes it on the document, so brand/tokens.css flips its ground
 * tokens once and every surface — this page, the dashboard, the charts —
 * follows the same switch. Two hand-kept palettes is how the landing headline
 * ended up ink on ink when the app's mode and the page's toggle disagreed.
 */
const KEY = 'bg-landing-theme'

function write(on: boolean) {
  const root = document.documentElement
  root.dataset.mode = on ? 'dark' : 'light'
  root.classList.toggle('dark', on)
}

export function useMode() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    // read after the first paint, so the server and client markup agree
    const id = requestAnimationFrame(() => {
      const root = document.documentElement
      const stored = window.localStorage.getItem(KEY)
      const on = stored ? stored === 'dark' : root.dataset.mode === 'dark'
      write(on)
      setDark(on)
    })
    return () => cancelAnimationFrame(id)
  }, [])

  function toggle() {
    setDark(d => {
      const on = !d
      window.localStorage.setItem(KEY, on ? 'dark' : 'light')
      write(on)
      return on
    })
  }

  return { dark, toggle }
}

/**
 * Read the document mode without owning it.
 *
 * For anything that has to match the ground it is drawn on but does not
 * toggle it — the lockup, whose Paper and Ink files each carry their own
 * full-bleed ground rect, so the wrong one draws a Paper box on an ink plane.
 */
export function useDarkGround() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    const read = () => setDark(root.dataset.mode === 'dark' || root.classList.contains('dark'))
    read()
    const mo = new MutationObserver(read)
    mo.observe(root, { attributes: true, attributeFilter: ['data-mode', 'class'] })
    return () => mo.disconnect()
  }, [])
  return dark
}
