#!/usr/bin/env node
/**
 * The browser tab icon, generated from the brand mark.
 *
 * Run: npm run favicon        (writes the files)
 *      npm run favicon:check  (fails if they are stale or missing)
 *
 * Why this is a script and not three hand-made files: the mark is the one
 * thing in the system nobody is allowed to redraw, so the favicon is cut from
 * `brand/logo/brandgauge-mark-mono-ink.svg` every time rather than traced from
 * it. Change the mark and the tab icon follows.
 *
 * Three decisions it encodes, all from brand/DESIGN-SYSTEM.md:
 *
 * 1. Mono, not duotone. Section 2: "Below 24px ... Seven graded ticks at
 *    favicon size turn into mud." A tab icon is 16px.
 * 2. Ink on a Paper plane, which is the highest contrast pair the system has
 *    and so the one that survives 16px best. Paper is #FAF6EF rather than pure
 *    white because the brand has no pure white; on a browser's own white
 *    chrome the difference is invisible, and against a dark tab strip the tile
 *    reads as the deliberate light square it is.
 * 3. No corner radius. Section 4 lists what is rounded and a tab icon is not
 *    on it; every platform that wants a rounded tile masks it anyway.
 */

import sharp from 'sharp'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const SOURCE = 'brand/logo/brandgauge-mark-mono-ink.svg'
const PAPER  = '#FAF6EF'   // --bg-paper, the brand's white
const INK     = '#16120E'  // --tx, the mark on a Paper ground

/**
 * The mark's own bounding box inside its 300 415 305 200 viewBox, in those
 * units. Measured by rendering the paths with the baked background removed and
 * trimming, not read off the file: the supplied viewBox carries uneven padding
 * and centring on it would sit the mark off-centre in the tile.
 */
const MARK = { x: 333.75, y: 452.25, w: 245.75, h: 136.75 }

/** How much of the tile's width the mark takes. The rest is clear space. */
const FILL = 0.86

function buildSvg() {
  const src = readFileSync(SOURCE, 'utf8')

  // Everything but the baked Paper rect. The paths are taken verbatim.
  const paths = src
    .replace(/^[\s\S]*?<rect[^>]*\/>/, '')
    .replace(/<\/svg>\s*$/, '')
    .trim()

  if (!paths.startsWith('<path')) {
    throw new Error(`${SOURCE} is not the shape this script expects: no paths after the background rect`)
  }

  const side = MARK.w / FILL
  const x = MARK.x + MARK.w / 2 - side / 2
  const y = MARK.y + MARK.h / 2 - side / 2

  // The paths carry their own fill, so they are recoloured here rather than in
  // the source file, which has to stay the brand asset it is.
  const inked = paths.replace(/fill="#16120E"/g, `fill="${INK}"`)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${round(x)} ${round(y)} ${round(side)} ${round(side)}">
  <title>BrandGauge</title>
  <rect x="${round(x)}" y="${round(y)}" width="${round(side)}" height="${round(side)}" fill="${PAPER}"/>
  ${inked}
</svg>
`
}

const round = (n) => Number(n.toFixed(2))

async function png(svg, size) {
  return sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size, { fit: 'contain' })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

const digest = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16)

async function main() {
  const check = process.argv.includes('--check')
  const svg = buildSvg()

  const targets = [
    { path: 'src/app/icon.svg',        data: Buffer.from(svg) },
    // Apple wants an opaque square and ignores a transparent one. The Paper
    // plane means this is opaque already, so it is the same artwork.
    { path: 'src/app/apple-icon.png',  data: await png(svg, 180) },
    // Open Graph and the PWA manifest both want a big square.
    { path: 'public/brand-logo/brandgauge-tile-512.png', data: await png(svg, 512) },
  ]

  // favicon.ico, for the browsers and crawlers that still ask for it by name.
  // Three sizes in one file: 16 for the tab, 32 for a retina tab and the
  // bookmark bar, 48 for Windows and Google's crawler.
  const icoFrames = await Promise.all([16, 32, 48].map(s => png(svg, s)))
  const tmp = icoFrames.map((buf, i) => {
    const p = `/tmp/bg-favicon-${[16, 32, 48][i]}.png`
    writeFileSync(p, buf)
    return p
  })
  execFileSync('convert', [...tmp, 'src/app/favicon.ico'])
  targets.push({ path: 'src/app/favicon.ico', data: readFileSync('src/app/favicon.ico') })

  let stale = 0
  for (const t of targets) {
    if (t.path === 'src/app/favicon.ico') continue   // written by convert above
    const current = existsSync(t.path) ? readFileSync(t.path) : null

    if (check) {
      if (!current || digest(current) !== digest(t.data)) {
        console.error(`✗ ${t.path} ${current ? 'is stale' : 'is missing'}`)
        stale++
      } else {
        console.log(`  ok  ${t.path}`)
      }
      continue
    }

    writeFileSync(t.path, t.data)
    console.log(`  wrote ${t.path} (${t.data.length.toLocaleString()} bytes)`)
  }

  if (check) {
    if (stale) {
      console.error(`\n✗ ${stale} file(s) out of date. Run: npm run favicon`)
      process.exit(1)
    }
    console.log('\n✓ the tab icon matches the brand mark')
    return
  }

  console.log(`  wrote src/app/favicon.ico (16, 32, 48)`)
  console.log('\n✓ generated from ' + SOURCE)
}

main().catch(err => { console.error(err.message); process.exit(1) })
