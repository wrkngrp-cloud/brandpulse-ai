/**
 * Measures the sleeve so src/art.ts holds real numbers rather than eyeballed
 * ones: where the painted panel sits inside the cream border, and where the
 * waterline crosses it.
 *
 * Usage: node scripts/probe-art.mjs [path-to-cover.png]
 */
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

const path = process.argv[2] ?? 'public/cover.png'
const buf = readFileSync(path)

// ---- minimal PNG decode (8-bit, colour type 2 or 6, non-interlaced) --------

if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG')
const W = buf.readUInt32BE(16)
const H = buf.readUInt32BE(20)
const depth = buf[24]
const ctype = buf[25]
if (depth !== 8 || (ctype !== 2 && ctype !== 6)) throw new Error(`unsupported PNG: depth ${depth} ctype ${ctype}`)
const CH = ctype === 6 ? 4 : 3

const idat = []
for (let p = 8; p < buf.length; ) {
  const len = buf.readUInt32BE(p)
  const type = buf.toString('ascii', p + 4, p + 8)
  if (type === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len))
  if (type === 'IEND') break
  p += 12 + len
}
const raw = inflateSync(Buffer.concat(idat))

const stride = W * CH
const px = Buffer.alloc(H * stride)
const paeth = (a, b, c) => {
  const pp = a + b - c
  const pa = Math.abs(pp - a)
  const pb = Math.abs(pp - b)
  const pc = Math.abs(pp - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}
for (let y = 0; y < H; y++) {
  const filter = raw[y * (stride + 1)]
  const src = y * (stride + 1) + 1
  const dst = y * stride
  for (let i = 0; i < stride; i++) {
    const x = raw[src + i]
    const a = i >= CH ? px[dst + i - CH] : 0
    const b = y > 0 ? px[dst - stride + i] : 0
    const c = i >= CH && y > 0 ? px[dst - stride + i - CH] : 0
    let v
    if (filter === 0) v = x
    else if (filter === 1) v = x + a
    else if (filter === 2) v = x + b
    else if (filter === 3) v = x + ((a + b) >> 1)
    else v = x + paeth(a, b, c)
    px[dst + i] = v & 0xff
  }
}

const at = (x, y) => {
  const o = y * stride + x * CH
  return [px[o], px[o + 1], px[o + 2]]
}

// ---- measure ---------------------------------------------------------------

console.log(`${path}: ${W}x${H}, channels ${CH}\n`)

const corner = at(4, 4)
const dist = (c) => Math.hypot(c[0] - corner[0], c[1] - corner[1], c[2] - corner[2])
const THRESH = 42 // the border carries a faint 5% texture, so allow some drift

const midY = Math.floor(H / 2)
const midX = Math.floor(W / 2)

let left = 0
while (left < W && dist(at(left, midY)) < THRESH) left++
let right = W - 1
while (right > 0 && dist(at(right, midY)) < THRESH) right--

let top = 0
while (top < H && dist(at(midX, top)) < THRESH) top++
let bottom = H - 1
while (bottom > 0 && dist(at(midX, bottom)) < THRESH) bottom--

const n = (v, size) => (v / size).toFixed(4)
console.log(`border colour at corner: rgb(${corner.join(',')})`)
console.log('painted panel:')
console.log(`  left   ${left}px  -> ${n(left, W)}`)
console.log(`  right  ${right}px  -> ${n(right + 1, W)}`)
console.log(`  top    ${top}px  -> ${n(top, H)}`)
console.log(`  bottom ${bottom}px  -> ${n(bottom + 1, H)}`)
console.log(`  size   ${right - left + 1} x ${bottom - top + 1}`)

// waterline: walk down a column in the open right-hand side of the panel and
// find where warm sky gives way to cool water (blue overtakes red)
console.log('\nwaterline scan (blue - red, per column):')
for (const fx of [0.62, 0.7, 0.78, 0.84]) {
  const x = Math.round(left + (right - left) * fx)
  let found = -1
  for (let y = top + 10; y <= bottom; y++) {
    const [r, g, b] = at(x, y)
    if (b > r + 12 && g > r) {
      // require it to hold, so a dark outline or a bird's eye can't trigger it
      let holds = true
      for (let k = 1; k <= 24; k++) {
        const [r2, g2, b2] = at(x, Math.min(bottom, y + k))
        if (!(b2 > r2 && g2 > r2 - 10)) {
          holds = false
          break
        }
      }
      if (holds) {
        found = y
        break
      }
    }
  }
  console.log(
    `  x=${fx.toFixed(2)} of panel (px ${x}): y=${found}` + (found >= 0 ? ` -> ${n(found, H)} of canvas` : ' (none)'),
  )
}
