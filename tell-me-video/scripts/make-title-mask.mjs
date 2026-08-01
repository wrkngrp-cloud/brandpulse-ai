/**
 * Writes public/title-mask.png — the silhouette of the hand-lettered "Tell Me"
 * and the white cloud behind it.
 *
 * The wordmark sits low in the painted panel, which is exactly where the water
 * ripple is strongest, so without this the lettering visibly wobbles. The film
 * paints a still copy of the sleeve back over the ripple through this mask.
 *
 * The edge is left almost hard on purpose. Cross-fading between a rippling and
 * a still copy of the same water ghosts, because the two differ by the ripple
 * offset; a near-hard cut at the cloud's own painted edge does not, and reads
 * correctly anyway — the wordmark sits on top of the picture, not in the water.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodePng, encodeGray } from './png.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = 1200 // the mask is soft data; it does not need the full 4800

// only look where the wordmark lives, so white water flecks elsewhere can't win
const REGION = { x0: 0.42, y0: 0.58, x1: 1.0, y1: 1.0 }

const WHITE_MIN = 215 // the cloud is a flat near-white
// Box radius is the size filter. The cloud is a big solid mass and survives;
// the white segments of the life ring do not, which matters because masking
// only its white stripes would freeze half the ring while the red half rippled.
const COVERAGE_R = 26
const COVERAGE_LO = 0.5
const COVERAGE_HI = 0.82
const DILATE_R = 10 // grow past the cloud edge and over the black lettering
const FEATHER_R = 3 // just enough to avoid a stair-stepped edge

const { W, H, CH, px } = decodePng(readFileSync(resolve(ROOT, 'public/cover.png')))
console.log(`read cover ${W}x${H}`)

const white = new Float32Array(OUT * OUT)
for (let y = 0; y < OUT; y++) {
  const fy = (y + 0.5) / OUT
  if (fy < REGION.y0 || fy > REGION.y1) continue
  const sy = Math.min(H - 1, Math.floor(fy * H))
  for (let x = 0; x < OUT; x++) {
    const fx = (x + 0.5) / OUT
    if (fx < REGION.x0 || fx > REGION.x1) continue
    const sx = Math.min(W - 1, Math.floor(fx * W))
    const o = sy * W * CH + sx * CH
    const r = px[o]
    const g = px[o + 1]
    const b = px[o + 2]
    white[y * OUT + x] = Math.min(r, g, b) > WHITE_MIN ? 1 : 0
  }
}

/** Separable box blur over a Float32 field. */
function boxBlur(src, w, h, radius) {
  const tmp = new Float32Array(w * h)
  const dst = new Float32Array(w * h)
  const span = radius * 2 + 1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0
      for (let k = -radius; k <= radius; k++) {
        s += src[y * w + Math.min(w - 1, Math.max(0, x + k))]
      }
      tmp[y * w + x] = s / span
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let s = 0
      for (let k = -radius; k <= radius; k++) {
        s += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x]
      }
      dst[y * w + x] = s / span
    }
  }
  return dst
}

/** Separable max filter — grows the mask past the cloud edge. */
function dilate(src, w, h, radius) {
  const tmp = new Float32Array(w * h)
  const dst = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0
      for (let k = -radius; k <= radius; k++) m = Math.max(m, src[y * w + Math.min(w - 1, Math.max(0, x + k))])
      tmp[y * w + x] = m
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = 0
      for (let k = -radius; k <= radius; k++) m = Math.max(m, tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x])
      dst[y * w + x] = m
    }
  }
  return dst
}

const coverage = boxBlur(white, OUT, OUT, COVERAGE_R)

// keep only the big white mass
const solid = new Float32Array(OUT * OUT)
for (let i = 0; i < solid.length; i++) {
  const u = (coverage[i] - COVERAGE_LO) / (COVERAGE_HI - COVERAGE_LO)
  const c = Math.min(1, Math.max(0, u))
  solid[i] = c * c * (3 - 2 * c)
}

const grown = dilate(solid, OUT, OUT, DILATE_R)
const feathered = boxBlur(grown, OUT, OUT, FEATHER_R)

const out = new Uint8Array(OUT * OUT)
let covered = 0
for (let i = 0; i < out.length; i++) {
  const v = Math.min(1, feathered[i] * 1.15) // push the plateau to fully opaque
  out[i] = Math.round(v * 255)
  if (v > 0.5) covered++
}

const dest = resolve(ROOT, 'public/title-mask.png')
writeFileSync(dest, encodeGray(OUT, OUT, out))
console.log(`wrote ${dest} — ${((covered / out.length) * 100).toFixed(2)}% of canvas masked`)

// report the mask's bounding box so the result can be sanity-checked
let bx0 = OUT
let by0 = OUT
let bx1 = 0
let by1 = 0
for (let y = 0; y < OUT; y++) {
  for (let x = 0; x < OUT; x++) {
    if (out[y * OUT + x] > 128) {
      if (x < bx0) bx0 = x
      if (x > bx1) bx1 = x
      if (y < by0) by0 = y
      if (y > by1) by1 = y
    }
  }
}
console.log(
  `mask bounds: x ${(bx0 / OUT).toFixed(3)}..${(bx1 / OUT).toFixed(3)}  y ${(by0 / OUT).toFixed(3)}..${(by1 / OUT).toFixed(3)}`,
)
