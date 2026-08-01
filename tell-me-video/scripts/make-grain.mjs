/**
 * Writes public/grain.png — a 256x256 8-bit grayscale noise tile used for the
 * film-grain overlay. Generated rather than committed as a binary blob so the
 * texture is reproducible and tweakable.
 */
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const SIZE = 256
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// deterministic noise so re-running never changes the texture
let seed = 0x9e3779b9
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// raw scanlines: one filter byte (0 = none) + SIZE grayscale bytes
const raw = Buffer.alloc((SIZE + 1) * SIZE)
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE + 1)] = 0
  for (let x = 0; x < SIZE; x++) {
    // average two samples for slightly softer, less fizzy grain
    const v = (rand() + rand()) / 2
    raw[y * (SIZE + 1) + 1 + x] = Math.round(v * 255)
  }
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

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 0 // colour type: grayscale
ihdr[10] = 0 // compression
ihdr[11] = 0 // filter
ihdr[12] = 0 // interlace

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

const dest = resolve(ROOT, 'public/grain.png')
writeFileSync(dest, png)
console.log(`wrote ${dest} (${png.length} bytes)`)
