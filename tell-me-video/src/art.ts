/**
 * Everything that describes the artwork itself, in coordinates normalised to
 * the square cover (0..1 on both axes, origin top-left).
 *
 * These numbers are the one place the film touches the specific painting. If
 * the source file is ever re-cropped, retune here and nothing else changes.
 */

/** The inner painted panel, inside the cream border that carries the credits. */
export const PANEL = {
  left: 0.1156,
  right: 0.829,
  top: 0.109,
  bottom: 0.892,
}

export const PANEL_W = PANEL.right - PANEL.left
export const PANEL_H = PANEL.bottom - PANEL.top
export const PANEL_CX = (PANEL.left + PANEL.right) / 2
export const PANEL_CY = (PANEL.top + PANEL.bottom) / 2

/**
 * The lagoon. Everything below `waterTop` gets the ripple treatment, which is
 * what turns a flat painting into moving water (and makes the flamingo legs and
 * their reflections swim).
 */
export const WATER = {
  top: 0.408,
  bottom: PANEL.bottom,
}

/**
 * Scale is expressed as a multiple of the frame height: 1.0 renders the whole
 * square cover 1080px tall (pillarboxed), which is the "this is the sleeve"
 * framing. Above ~2.49 the painted panel covers the full 1920x1080 frame and we
 * are inside the picture with no border in shot.
 */
export const SCALE_FILLS_FRAME = 1920 / (1080 * PANEL_W)
