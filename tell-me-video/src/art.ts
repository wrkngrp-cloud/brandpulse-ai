/**
 * Everything that describes the artwork itself, in coordinates normalised to
 * the square cover (0..1 on both axes, origin top-left).
 *
 * These numbers are the one place the film touches the specific painting. They
 * are measured, not estimated — run `node scripts/probe-art.mjs` to re-derive
 * them if the sleeve is ever re-exported.
 */

/**
 * The painted panel, inside the cream border that carries the credits.
 * Measured at 547..4252 x 528..4233 on the 4800px master, which matches the
 * 342,330 2316x2316 rect the designer placed in the .svg.
 */
export const PANEL = {
  left: 0.114,
  right: 0.886,
  top: 0.11,
  bottom: 0.8821,
}

export const PANEL_W = PANEL.right - PANEL.left
export const PANEL_H = PANEL.bottom - PANEL.top
export const PANEL_CX = (PANEL.left + PANEL.right) / 2
export const PANEL_CY = (PANEL.top + PANEL.bottom) / 2

/**
 * The lagoon. Everything below `top` gets the ripple treatment, which is what
 * turns a flat painting into moving water — and because the flamingo legs and
 * their reflections live down here, they swim for free.
 *
 * Set a little above the measured waterline (0.42–0.44 depending on the
 * column, since the horizon is not level). Ripple amplitude reaches zero at
 * this line, so starting slightly high costs nothing, whereas starting low
 * would leave a band of water frozen against the moving water beneath it.
 */
export const WATER = {
  top: 0.398,
  bottom: PANEL.bottom,
}

/**
 * Scale is expressed as a multiple of the frame height: 1.0 renders the whole
 * square cover 1080px tall, so anything above that crops the sleeve and loses
 * the credits. Above ~2.30 the painted panel covers the full 1920x1080 frame
 * and we are inside the picture with no border in shot.
 */
export const SCALE_FILLS_FRAME = 1920 / (1080 * PANEL_W)
