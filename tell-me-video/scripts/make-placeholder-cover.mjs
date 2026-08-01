/**
 * Writes a stand-in public/cover.png that matches the real sleeve's geometry —
 * cream border, painted panel, horizon line, flamingo masses, lily pads, title
 * block. It exists so the camera path, the water and the grade can be checked
 * before the real artwork is dropped in over it. Delete once the master is in.
 */
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const N = 2400
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const PANEL = { left: 0.1156, right: 0.829, top: 0.109, bottom: 0.892 }
const WATER_TOP = 0.408

const lerp = (a, b, u) => a + (b - a) * u
const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

const px = Buffer.alloc(N * N * 3)

for (let j = 0; j < N; j++) {
  const y = j / N
  for (let i = 0; i < N; i++) {
    const x = i / N
    let r, g, b

    const inPanel = x >= PANEL.left && x <= PANEL.right && y >= PANEL.top && y <= PANEL.bottom

    if (!inPanel) {
      // cream border with a faint blush, plus stand-in credit blocks
      r = 250
      g = 246
      b = 239
      const blush = Math.max(0, 1 - Math.hypot(x - 0.9, y - 0.1) * 2.2)
      r = lerp(r, 246, blush)
      g = lerp(g, 214, blush)
      b = lerp(b, 206, blush)
      const credit =
        (y > 0.055 && y < 0.078 && ((x > 0.115 && x < 0.42) || (x > 0.72 && x < 0.83))) ||
        (y > 0.925 && y < 0.95 && x > 0.115 && x < 0.38)
      if (credit && Math.floor(x * 190) % 3 !== 0) {
        r = 26
        g = 24
        b = 30
      }
    } else if (y < WATER_TOP) {
      // sky: warm orange wash with vertical brush striping
      const u = (x - PANEL.left) / (PANEL.right - PANEL.left)
      const v = (y - PANEL.top) / (WATER_TOP - PANEL.top)
      const stripe = 0.5 + 0.5 * Math.sin(x * 210 + y * 6)
      r = lerp(214, 245, u * 0.7 + v * 0.3) + stripe * 12
      g = lerp(66, 126, u * 0.5 + v * 0.5) + stripe * 10
      b = lerp(30, 92, u * 0.4 + v * 0.6) + stripe * 8
    } else {
      // water: teal, banded, so ripple displacement is obvious when it moves
      const v = (y - WATER_TOP) / (PANEL.bottom - WATER_TOP)
      const band = 0.5 + 0.5 * Math.sin(y * 520 + Math.sin(x * 26) * 1.4)
      r = lerp(30, 58, v) + band * 26
      g = lerp(112, 150, v) + band * 30
      b = lerp(132, 146, v) + band * 24
      // lily pads
      for (let k = 0; k < 22; k++) {
        const cx = 0.18 + ((k * 0.2274) % 0.62)
        const cy = 0.5 + ((k * 0.1637) % 0.37)
        if (inEllipse(x, y, cx, cy, 0.031, 0.014)) {
          r = 118
          g = 196
          b = 62
        }
      }
    }

    if (inPanel) {
      // two flamingo masses, plus the necks that meet near the top centre
      const bodies = [
        [0.42, 0.4, 0.11, 0.058],
        [0.66, 0.4, 0.115, 0.06],
        [0.19, 0.42, 0.075, 0.05],
      ]
      for (const [cx, cy, rx, ry] of bodies) {
        if (inEllipse(x, y, cx, cy, rx, ry)) {
          r = 250
          g = 176
          b = 146
        }
      }
      // necks arcing up into a heart
      const neckL = Math.abs(x - (0.5 - 0.055 * Math.sin((y - 0.17) * 9))) < 0.008 && y > 0.17 && y < 0.4
      const neckR = Math.abs(x - (0.55 + 0.055 * Math.sin((y - 0.17) * 9))) < 0.008 && y > 0.17 && y < 0.4
      if (neckL || neckR) {
        r = 242
        g = 92
        b = 54
      }
      // legs down through the water so the ripple has something to bend
      for (const lx of [0.4, 0.45, 0.63, 0.7]) {
        if (Math.abs(x - lx) < 0.005 && y > 0.44 && y < 0.8) {
          r = 246
          g = 150
          b = 118
        }
      }
      // lollipop, upper left
      if (inEllipse(x, y, 0.235, 0.335, 0.085, 0.085)) {
        const a = Math.atan2(y - 0.335, x - 0.235)
        const swirl = Math.sin(a * 3 + Math.hypot(x - 0.235, y - 0.335) * 70) > 0
        r = swirl ? 236 : 250
        g = swirl ? 96 : 250
        b = swirl ? 74 : 250
      }
      // life ring, lower right
      const dRing = Math.hypot(x - 0.775, y - 0.723)
      if (dRing < 0.062 && dRing > 0.034) {
        const seg = Math.sin(Math.atan2(y - 0.723, x - 0.775) * 8) > 0
        r = seg ? 224 : 252
        g = seg ? 86 : 250
        b = seg ? 66 : 246
      }
      // hand-lettered title block, lower right
      if (x > 0.6 && x < 0.83 && y > 0.79 && y < 0.87) {
        const ink = Math.sin(x * 130) * Math.cos(y * 90) > 0.25
        if (ink) {
          r = 22
          g = 20
          b = 26
        }
      }
    }

    const o = (j * N + i) * 3
    px[o] = Math.max(0, Math.min(255, r))
    px[o + 1] = Math.max(0, Math.min(255, g))
    px[o + 2] = Math.max(0, Math.min(255, b))
  }
}

// pack into PNG scanlines (filter byte 0 per row)
const raw = Buffer.alloc((N * 3 + 1) * N)
for (let j = 0; j < N; j++) {
  raw[j * (N * 3 + 1)] = 0
  px.copy(raw, j * (N * 3 + 1) + 1, j * N * 3, (j + 1) * N * 3)
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
const crc32 = (buf) => {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(N, 0)
ihdr.writeUInt32BE(N, 4)
ihdr[8] = 8
ihdr[9] = 2 // truecolour
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 6 })),
  chunk('IEND', Buffer.alloc(0)),
])

const dest = resolve(ROOT, 'public/cover.png')
writeFileSync(dest, png)
console.log(`wrote ${dest} (${(png.length / 1024 / 1024).toFixed(2)} MB, ${N}x${N})`)
