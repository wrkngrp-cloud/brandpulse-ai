/**
 * Offline audio analysis for the "Tell Me" cover-art film.
 *
 * Decodes the mp3 to PCM, then derives everything the composition needs to move
 * in time with the record: a tempo + beat grid, per-frame band energies (low /
 * mid / high), and an onset curve. Written to src/audio-analysis.json so the
 * render stays deterministic — no audio decoding happens at render time.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MPEGDecoder } from 'mpg123-decoder'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const FPS = 30

// ---------------------------------------------------------------- fft (radix-2)

function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k]
        const ui = im[i + k]
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr
        re[i + k] = ur + vr
        im[i + k] = ui + vi
        re[i + k + len / 2] = ur - vr
        im[i + k + len / 2] = ui - vi
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
}

// ---------------------------------------------------------------- helpers

const clamp01 = (v) => Math.min(1, Math.max(0, v))

/** Normalise to 0..1 against a high percentile so one stray peak can't flatten everything. */
function normalise(arr, pct = 0.985) {
  const sorted = Float32Array.from(arr).sort()
  const ceiling = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * pct))] || 1
  return Array.from(arr, (v) => clamp01(v / ceiling))
}

function smooth(arr, radius) {
  const out = new Float32Array(arr.length)
  for (let i = 0; i < arr.length; i++) {
    let sum = 0
    let n = 0
    for (let k = -radius; k <= radius; k++) {
      const j = i + k
      if (j < 0 || j >= arr.length) continue
      sum += arr[j]
      n++
    }
    out[i] = sum / n
  }
  return out
}

const q = (v) => Math.round(clamp01(v) * 255)

// ---------------------------------------------------------------- decode

const decoder = new MPEGDecoder()
await decoder.ready
const mp3 = readFileSync(resolve(ROOT, 'public/tell-me.mp3'))
const { channelData, sampleRate, errors } = decoder.decode(new Uint8Array(mp3))
decoder.free()
if (errors.length) console.warn(`decoder reported ${errors.length} recoverable frame error(s)`)

// mono mixdown
const left = channelData[0]
const right = channelData[1] ?? channelData[0]
const mono = new Float32Array(left.length)
for (let i = 0; i < left.length; i++) mono[i] = (left[i] + right[i]) / 2

const duration = mono.length / sampleRate
const totalFrames = Math.floor(duration * FPS)
console.log(`decoded ${duration.toFixed(3)}s @ ${sampleRate}Hz -> ${totalFrames} video frames`)

// ---------------------------------------------------------------- stft

const FFT_SIZE = 2048
const HOP = Math.round(sampleRate / FPS / 2) // two analysis hops per video frame
const hopCount = Math.floor((mono.length - FFT_SIZE) / HOP)

const hann = new Float32Array(FFT_SIZE)
for (let i = 0; i < FFT_SIZE; i++) hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)))

const binHz = sampleRate / FFT_SIZE
const bandEdges = [
  ['low', 30, 160], // kick + bass
  ['mid', 160, 2000], // vocal body, keys, snare
  ['high', 2000, 11000], // hats, air, texture
]

const hopLow = new Float32Array(hopCount)
const hopMid = new Float32Array(hopCount)
const hopHigh = new Float32Array(hopCount)
const hopRms = new Float32Array(hopCount)
const hopFlux = new Float32Array(hopCount)

const re = new Float32Array(FFT_SIZE)
const im = new Float32Array(FFT_SIZE)
const mag = new Float32Array(FFT_SIZE / 2)
let prevMag = new Float32Array(FFT_SIZE / 2)

for (let h = 0; h < hopCount; h++) {
  const off = h * HOP
  let sq = 0
  for (let i = 0; i < FFT_SIZE; i++) {
    const s = mono[off + i]
    sq += s * s
    re[i] = s * hann[i]
    im[i] = 0
  }
  hopRms[h] = Math.sqrt(sq / FFT_SIZE)

  fft(re, im)

  let flux = 0
  for (let b = 0; b < FFT_SIZE / 2; b++) {
    mag[b] = Math.hypot(re[b], im[b])
    const d = mag[b] - prevMag[b]
    if (d > 0) flux += d // half-wave rectified spectral flux
  }
  hopFlux[h] = flux
  prevMag.set(mag)

  for (const [name, lo, hi] of bandEdges) {
    const b0 = Math.max(1, Math.floor(lo / binHz))
    const b1 = Math.min(FFT_SIZE / 2 - 1, Math.ceil(hi / binHz))
    let sum = 0
    for (let b = b0; b <= b1; b++) sum += mag[b] * mag[b]
    const v = Math.sqrt(sum / (b1 - b0 + 1))
    if (name === 'low') hopLow[h] = v
    else if (name === 'mid') hopMid[h] = v
    else hopHigh[h] = v
  }
}

// ---------------------------------------------------------------- tempo + beat grid

// Onset envelope, de-trended so sustained loud passages don't read as constant onset.
const fluxSmooth = smooth(hopFlux, 8)
const onset = new Float32Array(hopCount)
for (let h = 0; h < hopCount; h++) onset[h] = Math.max(0, hopFlux[h] - fluxSmooth[h])

const hopsPerSec = sampleRate / HOP
const minBpm = 60
const maxBpm = 180
let bestBpm = 0
let bestScore = -Infinity
for (let bpm = minBpm; bpm <= maxBpm; bpm += 0.1) {
  const lagF = (60 / bpm) * hopsPerSec
  let score = 0
  // score the lag and its first two multiples so half/double-time doesn't win by accident
  for (const mult of [1, 2, 4]) {
    const lag = Math.round(lagF * mult)
    if (lag >= hopCount) continue
    let s = 0
    for (let h = 0; h + lag < hopCount; h++) s += onset[h] * onset[h + lag]
    score += s / (hopCount - lag)
  }
  if (score > bestScore) {
    bestScore = score
    bestBpm = bpm
  }
}

// Phase: slide a click train across the onset envelope and take the best alignment.
const beatLag = (60 / bestBpm) * hopsPerSec
let bestPhase = 0
let bestPhaseScore = -Infinity
for (let p = 0; p < Math.ceil(beatLag); p++) {
  let s = 0
  for (let b = 0; ; b++) {
    const h = Math.round(p + b * beatLag)
    if (h >= hopCount) break
    s += onset[h]
  }
  if (s > bestPhaseScore) {
    bestPhaseScore = s
    bestPhase = p
  }
}
const beatOffsetSec = bestPhase / hopsPerSec
const beatPeriodSec = 60 / bestBpm
console.log(`tempo ${bestBpm.toFixed(1)} BPM, first beat at ${beatOffsetSec.toFixed(3)}s`)

// ---------------------------------------------------------------- per-video-frame series

const lowN = normalise(hopLow)
const midN = normalise(hopMid)
const highN = normalise(hopHigh)
const rmsN = normalise(hopRms)
const onsetN = normalise(onset, 0.99)

/** Take the peak across the hops covered by a video frame — punchier than averaging. */
function toFrames(series, mode = 'peak') {
  const out = new Array(totalFrames)
  for (let f = 0; f < totalFrames; f++) {
    const h0 = Math.floor((f / FPS) * hopsPerSec)
    const h1 = Math.floor(((f + 1) / FPS) * hopsPerSec)
    let acc = mode === 'peak' ? 0 : 0
    let n = 0
    for (let h = h0; h < Math.max(h1, h0 + 1); h++) {
      const v = series[Math.min(h, series.length - 1)] ?? 0
      if (mode === 'peak') acc = Math.max(acc, v)
      else acc += v
      n++
    }
    out[f] = mode === 'peak' ? acc : acc / Math.max(1, n)
  }
  return out
}

const frames = {
  rms: toFrames(rmsN, 'mean'),
  low: toFrames(lowN, 'peak'),
  mid: toFrames(midN, 'peak'),
  high: toFrames(highN, 'peak'),
  onset: toFrames(onsetN, 'peak'),
}

// Slow "arrangement energy" curve — what the eye should read as song sections.
const energy = Array.from(smooth(Float32Array.from(frames.rms), Math.round(FPS * 1.5)))
const energyMax = Math.max(...energy) || 1
for (let i = 0; i < energy.length; i++) energy[i] = clamp01(energy[i] / energyMax)

// ---------------------------------------------------------------- structure readout

const BLOCK = 4 // seconds
console.log('\nenergy map (each row = 4s):')
const rows = []
for (let t = 0; t < duration; t += BLOCK) {
  const f0 = Math.floor(t * FPS)
  const f1 = Math.min(energy.length, Math.floor((t + BLOCK) * FPS))
  if (f1 <= f0) break
  let e = 0
  let lo = 0
  let hi = 0
  for (let f = f0; f < f1; f++) {
    e += energy[f]
    lo += frames.low[f]
    hi += frames.high[f]
  }
  const n = f1 - f0
  rows.push({ t, e: e / n, lo: lo / n, hi: hi / n })
}
for (const r of rows) {
  const mm = String(Math.floor(r.t / 60)).padStart(2, '0')
  const ss = String(Math.floor(r.t % 60)).padStart(2, '0')
  const bar = '#'.repeat(Math.round(r.e * 46)).padEnd(46, '.')
  console.log(`${mm}:${ss} |${bar}| e=${r.e.toFixed(2)} lo=${r.lo.toFixed(2)} hi=${r.hi.toFixed(2)}`)
}

// ---------------------------------------------------------------- write

const out = {
  durationSec: Number(duration.toFixed(4)),
  fps: FPS,
  totalFrames,
  bpm: Number(bestBpm.toFixed(2)),
  beatOffsetSec: Number(beatOffsetSec.toFixed(4)),
  beatPeriodSec: Number(beatPeriodSec.toFixed(5)),
  // quantised to bytes: ~5 arrays x totalFrames, keeps the JSON small and the render exact
  series: {
    rms: frames.rms.map(q),
    low: frames.low.map(q),
    mid: frames.mid.map(q),
    high: frames.high.map(q),
    onset: frames.onset.map(q),
    energy: energy.map(q),
  },
}
const dest = resolve(ROOT, 'src/audio-analysis.json')
writeFileSync(dest, JSON.stringify(out))
console.log(`\nwrote ${dest} (${(JSON.stringify(out).length / 1024).toFixed(0)} KB)`)
