/**
 * The .svg master embeds its raster layers at higher resolution than the 3000px
 * .png export (the painting itself is 4096px in there). This pulls the embedded
 * images out and reports which pattern each one backs, so the film can be built
 * against the sharpest source available.
 *
 * Usage: node scripts/extract-svg-art.mjs <path-to.svg> [outDir]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const svgPath = process.argv[2]
const outDir = process.argv[3] ?? 'out/svg-assets'
if (!svgPath) {
  console.error('usage: node scripts/extract-svg-art.mjs <path-to.svg> [outDir]')
  process.exit(1)
}

const svg = readFileSync(svgPath, 'utf8')
mkdirSync(outDir, { recursive: true })

// pattern -> image, via <pattern id="..."><use xlink:href="#image..."/></pattern>
const patternToImage = new Map()
for (const m of svg.matchAll(/<pattern id="([^"]+)"[^>]*>([\s\S]{0,400}?)<\/pattern>/g)) {
  const use = m[2].match(/xlink:href="#([^"]+)"/)
  if (use) patternToImage.set(m[1], use[1])
}

// where each pattern is actually used on the canvas
const patternUse = new Map()
for (const m of svg.matchAll(/<rect([^>]*?)fill="url\(#([^)]+)\)"([^>]*)\/>/g)) {
  const attrs = m[1] + m[3]
  const num = (name) => {
    const v = attrs.match(new RegExp(`\\b${name}="(-?[\\d.]+)"`))
    return v ? Number(v[1]) : 0
  }
  patternUse.set(m[2], { x: num('x'), y: num('y'), width: num('width'), height: num('height') })
}

const images = [...svg.matchAll(/<image id="([^"]+)"[^>]*?width="(\d+)"[^>]*?height="(\d+)"[^>]*?xlink:href="data:image\/(\w+);base64,([^"]+)"/g)]

console.log(`found ${images.length} embedded image(s), ${patternToImage.size} pattern(s)\n`)

for (const [, id, w, h, fmt, b64] of images) {
  const buf = Buffer.from(b64, 'base64')
  const file = resolve(outDir, `${id}.${fmt}`)
  writeFileSync(file, buf)

  const pattern = [...patternToImage.entries()].find(([, img]) => img === id)?.[0]
  const placed = pattern ? patternUse.get(pattern) : undefined

  console.log(`${id}: ${w}x${h} ${fmt}, ${(buf.length / 1024 / 1024).toFixed(2)}MB -> ${file}`)
  if (pattern) console.log(`  backs pattern ${pattern}`)
  if (placed) {
    console.log(
      `  drawn at x=${placed.x} y=${placed.y} ${placed.width}x${placed.height} ` +
        `(normalised on a 3000px canvas: left=${(placed.x / 3000).toFixed(4)} top=${(placed.y / 3000).toFixed(4)} ` +
        `right=${((placed.x + placed.width) / 3000).toFixed(4)} bottom=${((placed.y + placed.height) / 3000).toFixed(4)})`,
    )
    console.log(`  effective detail vs 3000px export: ${(Number(w) / placed.width).toFixed(2)}x`)
  }
  console.log()
}
