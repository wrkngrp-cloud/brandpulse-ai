import { useEffect, useState } from 'react'
import {
  AbsoluteFill, Sequence, continueRender, delayRender, interpolate, staticFile, useCurrentFrame,
} from 'remotion'
import {
  AiScene, CompetitiveScene, FunnelScene, GaugeMark, GaugeScene, OohScene,
  SentimentScene, SurveyScene, lightSceneVars,
} from '../../src/components/landing/scenes'

export const FPS = 30

/**
 * BrandGauge Unveil — 60s brand film.
 * Rebuild of the original: cream stage, giant type interstitials (KNOW /
 * MEASURE / PROVE), real product UI in white cards with headlines beside,
 * whip-pan blur transitions. Scenes are the same pure-t components that run
 * the landing page tour, so the film is the product, not a mockup.
 */

const CLAY = '#D4602A'
const BLUE = '#2B59FF'
const INK = '#14182B'
const CREAM = '#FBF9F5'

type Beat =
  | { kind: 'logo'; dur: number }
  | { kind: 'word'; dur: number; word: string; dot: string }
  | { kind: 'chapter'; dur: number; Comp: (p: { t: number }) => React.ReactNode; headline: string; side: 'left' | 'right' }
  | { kind: 'outro'; dur: number }

const BEATS: Beat[] = [
  { kind: 'logo', dur: 105 },
  { kind: 'word', dur: 66, word: 'KNOW', dot: CLAY },
  { kind: 'chapter', dur: 195, Comp: GaugeScene, headline: 'See how your brand is really performing', side: 'right' },
  { kind: 'chapter', dur: 195, Comp: SentimentScene, headline: 'Understand the street, in its own words', side: 'left' },
  { kind: 'word', dur: 66, word: 'MEASURE', dot: BLUE },
  { kind: 'chapter', dur: 195, Comp: FunnelScene, headline: 'Defend your marketing spend to the CEO', side: 'left' },
  { kind: 'chapter', dur: 180, Comp: SurveyScene, headline: 'Hear from customers, scored as replies land', side: 'right' },
  { kind: 'word', dur: 66, word: 'PROVE', dot: CLAY },
  { kind: 'chapter', dur: 210, Comp: OohScene, headline: 'Prove the billboard on the expressway worked', side: 'right' },
  { kind: 'chapter', dur: 180, Comp: AiScene, headline: 'Know what AI tells customers about you', side: 'left' },
  { kind: 'chapter', dur: 180, Comp: CompetitiveScene, headline: 'Catch competitors’ moves before they land', side: 'right' },
  { kind: 'outro', dur: 162 },
]

export const UNVEIL_DURATION = BEATS.reduce((s, b) => s + b.dur, 0) // 1800 = 60s

const IN = 12   // whip-in frames
const OUT = 10  // whip-out frames

function useFontsReady() {
  const [handle] = useState(() => delayRender('satoshi'))
  useEffect(() => {
    Promise.all(
      ([[500, 'satoshi-500'], [700, 'satoshi-700'], [900, 'satoshi-900']] as const).map(async ([weight, file]) => {
        const font = new FontFace('Satoshi', `url(${staticFile(`fonts/${file}.woff2`)})`, { weight: String(weight) })
        await font.load()
        document.fonts.add(font)
      }),
    ).then(() => continueRender(handle))
  }, [handle])
}

/** enter/exit whip: translate + blur, clamped */
function whip(frame: number, dur: number, dir: 1 | -1) {
  const enter = interpolate(frame, [0, IN], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const exit = interpolate(frame, [dur - OUT, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const off = enter * 140 * dir - exit * 140 * dir
  const blur = (enter + exit) * 14
  const opacity = 1 - Math.max(enter, exit) * 0.35
  return { transform: `translateX(${off}px)`, filter: `blur(${blur}px)`, opacity }
}

function Backdrop() {
  return (
    <>
      <AbsoluteFill style={{
        backgroundImage: `radial-gradient(rgba(20,24,43,0.07) 1.2px, transparent 1.2px)`,
        backgroundSize: '30px 30px',
        maskImage: 'radial-gradient(75% 60% at 50% 40%, black, transparent)',
      }} />
      <div style={{
        position: 'absolute', left: '50%', top: -260, width: 1100, height: 560,
        transform: 'translateX(-50%)', borderRadius: '50%', filter: 'blur(150px)',
        background: 'rgba(43,89,255,0.09)',
      }} />
      <div style={{
        position: 'absolute', left: '50%', bottom: -300, width: 950, height: 520,
        transform: 'translateX(-50%)', borderRadius: '50%', filter: 'blur(150px)',
        background: 'rgba(212,96,42,0.10)',
      }} />
      <div style={{ position: 'absolute', insetInline: 0, bottom: 0, height: 6, background: CLAY, opacity: 0.85 }} />
    </>
  )
}

function ease(v: number) { return 1 - Math.pow(1 - Math.min(1, Math.max(0, v)), 3) }

function LogoIntro({ dur }: { dur: number }) {
  const frame = useCurrentFrame()
  const draw = ease(frame / 24)
  const word = ease((frame - 14) / 22)
  const tag = ease((frame - 40) / 20)
  const exit = interpolate(frame, [dur - OUT, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill className="items-center justify-center" style={{ filter: `blur(${exit * 14}px)`, opacity: 1 - exit * 0.35 }}>
      <div className="flex items-center gap-7" style={{ transform: `scale(${0.94 + draw * 0.06})` }}>
        <div style={{ opacity: draw }}><GaugeMark className="h-24 w-24" /></div>
        <span style={{
          fontFamily: 'Satoshi', fontWeight: 900, fontSize: 110, letterSpacing: '-0.03em', color: INK,
          opacity: word, transform: `translateY(${(1 - word) * 30}px)`, display: 'inline-block',
        }}>
          Brand<span style={{ color: CLAY }}>Gauge</span>
        </span>
      </div>
      <p style={{
        marginTop: 34, fontFamily: 'ui-monospace, monospace', fontSize: 21, letterSpacing: '0.34em',
        textTransform: 'uppercase', color: 'rgba(20,24,43,0.45)', opacity: tag,
      }}>
        Brand intelligence · built for here
      </p>
    </AbsoluteFill>
  )
}

function WordCard({ word, dot, dur }: { word: string; dot: string; dur: number }) {
  const frame = useCurrentFrame()
  const inP = ease(frame / 14)
  const style = whip(frame, dur, 1)
  // ghost echo drifts slowly the whole beat
  const drift = interpolate(frame, [0, dur], [40, -40])
  return (
    <AbsoluteFill className="items-center justify-center" style={style}>
      <span aria-hidden style={{
        position: 'absolute', fontFamily: 'Satoshi', fontWeight: 900, fontSize: 430, letterSpacing: '-0.02em',
        color: 'transparent', WebkitTextStroke: `2px rgba(20,24,43,0.10)`, whiteSpace: 'nowrap',
        transform: `translateX(${drift}px)`,
      }}>
        {word}.{word}.
      </span>
      <span style={{
        fontFamily: 'Satoshi', fontWeight: 900, fontSize: 240, letterSpacing: '-0.03em', color: INK,
        transform: `translateY(${(1 - inP) * 60}px) scale(${0.96 + inP * 0.04})`, opacity: inP,
        textShadow: '0 0 80px rgba(212,96,42,0.25)',
      }}>
        {word}<span style={{ color: dot }}>.</span>
      </span>
    </AbsoluteFill>
  )
}

function Chapter({ beat, dur }: { beat: Extract<Beat, { kind: 'chapter' }>; dur: number }) {
  const frame = useCurrentFrame()
  const dir = beat.side === 'right' ? 1 : -1
  const style = whip(frame, dur, dir as 1 | -1)
  // scene time: hold a beat after entry, finish before exit
  const t = Math.min(1, Math.max(0, (frame - IN * 0.5) / (dur - IN - OUT)))
  const words = beat.headline.split(' ')
  // scenes are designed for ~800px tour panels; render native then scale up so
  // proportions match the live product and the card fills without dead space
  const card = (
    <div style={{ width: 1150, height: 661 }}>
      <div className="@container" style={{ width: 800, height: 460, transform: 'scale(1.4375)', transformOrigin: 'top left' }}>
        <beat.Comp t={t} />
      </div>
    </div>
  )
  const copy = (
    <div style={{ width: 480 }}>
      <div style={{ width: 46, height: 7, background: CLAY, marginBottom: 26, borderRadius: 4 }} />
      <h2 style={{ fontFamily: 'Satoshi', fontWeight: 900, fontSize: 62, lineHeight: 1.06, letterSpacing: '-0.015em', color: INK }}>
        {words.map((w, i) => {
          const p = ease((frame - IN - i * 2.2) / 14)
          return (
            <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre', opacity: p, transform: `translateY(${(1 - p) * 22}px)` }}>
              {w}{' '}
            </span>
          )
        })}
      </h2>
    </div>
  )
  return (
    <AbsoluteFill className="flex-row items-center justify-center" style={{ gap: 84, ...style }}>
      {beat.side === 'left' ? <>{copy}{card}</> : <>{card}{copy}</>}
    </AbsoluteFill>
  )
}

function Outro({ dur }: { dur: number }) {
  const frame = useCurrentFrame()
  const p1 = ease(frame / 20)
  const p2 = ease((frame - 16) / 20)
  const p3 = ease((frame - 34) / 20)
  const fade = interpolate(frame, [dur - 18, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill className="items-center justify-center" style={{ opacity: 1 - fade }}>
      <div className="flex items-center gap-6" style={{ opacity: p1, transform: `scale(${0.94 + p1 * 0.06})` }}>
        <GaugeMark className="h-16 w-16" />
        <span style={{ fontFamily: 'Satoshi', fontWeight: 900, fontSize: 84, letterSpacing: '-0.03em', color: INK }}>
          Brand<span style={{ color: CLAY }}>Gauge</span>
        </span>
      </div>
      <p style={{ marginTop: 26, fontFamily: 'Satoshi', fontWeight: 500, fontSize: 30, color: 'rgba(20,24,43,0.55)', opacity: p2 }}>
        Brand intelligence that speaks your market’s language.
      </p>
      <div style={{ marginTop: 44, opacity: p3, transform: `translateY(${(1 - p3) * 16}px)` }}>
        <span style={{
          fontFamily: 'Satoshi', fontWeight: 700, fontSize: 27, color: 'white', background: CLAY,
          padding: '20px 44px', borderRadius: 999, boxShadow: '0 18px 60px rgba(212,96,42,0.4)',
        }}>
          Start free at brandgauge.app
        </span>
      </div>
    </AbsoluteFill>
  )
}

export function Unveil() {
  useFontsReady()
  let acc = 0
  return (
    <AbsoluteFill style={{
      background: CREAM, color: INK, ...lightSceneVars,
      ['--font-display' as never]: 'Satoshi',
      ['--s-map' as never]: `url(${staticFile('landing/ooh-map-light.png')})`,
    }}>
      <Backdrop />
      {BEATS.map((beat, i) => {
        const from = acc
        acc += beat.dur
        return (
          <Sequence key={i} from={from} durationInFrames={beat.dur}>
            {beat.kind === 'logo' && <LogoIntro dur={beat.dur} />}
            {beat.kind === 'word' && <WordCard word={beat.word} dot={beat.dot} dur={beat.dur} />}
            {beat.kind === 'chapter' && <Chapter beat={beat} dur={beat.dur} />}
            {beat.kind === 'outro' && <Outro dur={beat.dur} />}
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
