/**
 * Renders the sleeve .svg master to public/cover.png at high resolution.
 *
 * Worth doing rather than using the 3000px .png export, because the .svg keeps
 * two things the export loses: the credits are still vector, and the painting
 * is embedded at 4096px but squeezed into a 2316px panel by the export. Going
 * through the browser gets both back, which is what keeps the close-ups sharp.
 *
 * Usage: node scripts/rasterize-sleeve.mjs <sleeve.svg> [size]
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const svg = process.argv[2]
const size = Number(process.argv[3] ?? 4800)
if (!svg || !existsSync(svg)) {
  console.error('usage: node scripts/rasterize-sleeve.mjs <sleeve.svg> [size]')
  process.exit(1)
}

// The .svg declares a 3000px canvas, so scale up with the device pixel ratio
// rather than the window size — that way the vector credits are re-rendered at
// the target resolution instead of being upscaled.
const CANVAS = 3000
const scale = size / CANVAS

const chrome =
  process.env.REMOTION_BROWSER_EXECUTABLE ??
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'

const dest = resolve(ROOT, 'public/cover.png')

execFileSync(
  chrome,
  [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--force-device-scale-factor=${scale}`,
    `--window-size=${CANVAS},${CANVAS}`,
    `--screenshot=${dest}`,
    `file://${resolve(svg)}`,
  ],
  { stdio: ['ignore', 'inherit', 'pipe'] },
)

console.log(`wrote ${dest} at ${size}x${size}`)
console.log('now re-run: node scripts/probe-art.mjs && node scripts/make-title-mask.mjs')
