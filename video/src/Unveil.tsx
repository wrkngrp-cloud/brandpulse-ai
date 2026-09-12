import { useEffect, useState } from 'react'
import {
  AbsoluteFill, Img, Sequence, continueRender, delayRender, interpolate, staticFile, useCurrentFrame,
} from 'remotion'
import {
  AiScene, CompetitiveScene, FunnelScene, GaugeScene, OohScene,
  SentimentScene, SurveyScene, clamp01, easeOut, lightSceneVars,
} from '../../src/components/landing/scenes'
import { rowTicks, tickBounds } from '../../src/components/landing/tick-mask'
import { LogoUnveil, LOGO_UNVEIL_DURATION } from './LogoUnveil'
import { ATOM } from '@brand/engine.js'

export const FPS = 30

/**
 * BrandGauge Unveil — the brand film.
 *
 * The thesis the film argues is the product's own: your brand is judged out
 * there, and measured in here. The earlier cut only ever showed the second
 * half. It opened on cream, cut between product screens, and the market it
 * claims to read never appeared once.
 *
 * So the three act cards are photographs now, and they arrive the way every
 * reading in this system arrives: through the mark's own ticks, tail to head.
 * Same geometry the landing page masks its street photograph with — imported,
 * not re-derived, so the film cannot drift away from the page.
 *
 * Product beats are unchanged in kind. They are the same pure-t scene
 * components that drive the landing tour, so what you watch is the running
 * interface rather than a mockup of it.
 */

/* The film's chrome reads tokens through var(), same as the scenes. */
const FLARE = 'var(--flare)'
const INK = 'var(--tx)'
const PAPER = 'var(--bg-paper)'
const ASH = 'var(--tx-3)'
const TRACK = 'var(--tick-1)'

/** The lockup as supplied in brand/logo, drawn at the size the beat needs. */
function Lockup({ height }: { height: number }) {
  return (
    <Img
      src={staticFile('brand-logo/brandgauge-lockup-duotone-paper.svg')}
      alt="BrandGauge"
      style={{ height, width: height * (1300 / 200) }}
    />
  )
}

type Beat =
  | { kind: 'logo'; dur: number }
  | { kind: 'place'; dur: number; word: string; photo: string; alt: string }
  | { kind: 'chapter'; dur: number; Comp: (p: { t: number }) => React.ReactNode; headline: string; side: 'left' | 'right' }
  | { kind: 'verticals'; dur: number }
  | { kind: 'outro'; dur: number }

/** The eight verticals, in the order the product lists them. `photo: null`
 *  draws the tick field with the mark standing on it, so a vertical added
 *  before its photograph arrives is a composed panel rather than a gap. */
const VERTICALS: { name: string; photo: string | null }[] = [
  { name: 'FMCG',        photo: 'fmcg-provision-store' },
  { name: 'Fintech',     photo: 'fintech-pos-payment' },
  { name: 'Venues',      photo: 'venue-national-theatre' },
  { name: 'B2B SaaS',    photo: 'b2b-saas-meeting' },
  { name: 'Marketplaces', photo: 'marketplace-storefront' },
  { name: 'Beverage',    photo: 'beverage-bar-counter' },
  { name: 'Distribution', photo: 'b2b-wholesale-load' },
  { name: 'Agencies',    photo: 'agency-floor' },
]

const BEATS: Beat[] = [
  { kind: 'logo', dur: 132 },
  { kind: 'place', dur: 84, word: 'KNOW', photo: 'lagos-market-crowd',
    alt: 'A Lagos market street at rush hour, the crowd the brand is being judged by.' },
  { kind: 'chapter', dur: 180, Comp: GaugeScene, headline: 'See how your brand is really performing', side: 'right' },
  { kind: 'chapter', dur: 180, Comp: SentimentScene, headline: 'Understand the street, in its own words', side: 'left' },
  { kind: 'place', dur: 84, word: 'MEASURE', photo: 'expressway-billboard',
    alt: 'A large-format billboard over a Lagos expressway.' },
  { kind: 'chapter', dur: 180, Comp: FunnelScene, headline: 'Defend your marketing spend to the CEO', side: 'left' },
  { kind: 'chapter', dur: 168, Comp: SurveyScene, headline: 'Hear from customers, scored as replies land', side: 'right' },
  { kind: 'place', dur: 84, word: 'PROVE', photo: 'roundabout-billboard',
    alt: 'A roundabout billboard at a busy junction.' },
  { kind: 'chapter', dur: 192, Comp: OohScene, headline: 'Prove the billboard on the expressway worked', side: 'right' },
  { kind: 'chapter', dur: 168, Comp: AiScene, headline: 'Know what AI tells customers about you', side: 'left' },
  { kind: 'chapter', dur: 168, Comp: CompetitiveScene, headline: 'Catch competitors’ moves before they land', side: 'right' },
  { kind: 'verticals', dur: 114 },
  { kind: 'outro', dur: 144 },
]

export const UNVEIL_DURATION = BEATS.reduce((s, b) => s + b.dur, 0)

const IN = 12   // whip-in frames
const OUT = 10  // whip-out frames

/** Both faces, every weight the film uses. Disket carries the numerals: when
 *  it was missing, every reading fell back to Nohemi and the product screens
 *  stopped matching the app, where they are tabular Disket. */
const FACES = [
  ['Nohemi', 400, 'Nohemi-400'],
  ['Nohemi', 500, 'Nohemi-500'],
  ['Nohemi', 700, 'Nohemi-700'],
  ['Nohemi', 800, 'Nohemi-800'],
  ['Disket Mono', 400, 'DisketMono-400'],
  ['Disket Mono', 700, 'DisketMono-700'],
] as const

function useFontsReady() {
  const [handle] = useState(() => delayRender('brand-fonts'))
  useEffect(() => {
    Promise.all(
      FACES.map(async ([family, weight, file]) => {
        const font = new FontFace(family, `url(${staticFile(`fonts/${file}.woff2`)})`, { weight: String(weight) })
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
  const off = enter * 110 * dir - exit * 110 * dir
  const blur = (enter + exit) * 12
  const opacity = 1 - Math.max(enter, exit) * 0.35
  return { transform: `translateX(${off}px)`, filter: `blur(${blur}px)`, opacity }
}

/**
 * The film's own reading, along the bottom edge.
 *
 * Was a six-pixel bar of Flare, which is a progress bar and says nothing. A
 * run of ticks lighting tail to head is the one gesture this whole system is
 * built on, so the film keeps its own place in it the same way the gauge keeps
 * a score. It lights once, forwards, and never loops.
 */
const STRIP = 34
const STRIP_RUN = rowTicks(STRIP, 1920, 44, 0.78, [0.42, 1])
const STRIP_BOX = tickBounds(STRIP_RUN)

function Crescendo({ progress }: { progress: number }) {
  const lit = progress * STRIP
  return (
    <svg
      aria-hidden
      viewBox={`${STRIP_BOX.x0} ${STRIP_BOX.y0} ${STRIP_BOX.w} ${STRIP_BOX.h}`}
      style={{ position: 'absolute', left: 0, bottom: 30, width: 1920, height: (1920 / STRIP_BOX.w) * STRIP_BOX.h }}
    >
      {STRIP_RUN.map((tk, i) => (
        <g key={i} transform={tk.transform}>
          <path d={ATOM} fill={i < lit ? FLARE : TRACK} />
        </g>
      ))}
    </svg>
  )
}

function Backdrop() {
  return (
    <AbsoluteFill style={{
      backgroundImage: `radial-gradient(${TRACK} 1.2px, transparent 1.2px)`,
      backgroundSize: '30px 30px',
      maskImage: 'radial-gradient(75% 60% at 50% 40%, black, transparent)',
    }} />
  )
}

/**
 * The opening: the logo builds itself.
 *
 * It used to arrive whole, at opacity 0 to 1 with a 26px lift, which is a
 * stock title card and told you nothing about what the mark means. The arc
 * fills, the needle sweeps up the dial and settles, and the wordmark comes
 * through the crescendo lying flat. Same animation as the standalone cut in
 * LogoUnveil, on the film's own ground rather than its own.
 */
function LogoIntro({ dur }: { dur: number }) {
  const frame = useCurrentFrame()
  const tag = easeOut((frame - LOGO_UNVEIL_DURATION + 26) / 20)
  const exit = interpolate(frame, [dur - OUT, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ filter: `blur(${exit * 12}px)`, opacity: 1 - exit * 0.35 }}>
      <LogoUnveil ground="transparent" width="46%" />
      {/* Not "built in Lagos, for West Africa". That reads as a ceiling: it
          tells a Nairobi or Accra team the product is not for them. Lagos is
          proof of how deep the language work goes, not a boundary. Same line
          the site now leads with. */}
      <AbsoluteFill className="items-center justify-start" style={{ paddingTop: 620 }}>
        <p style={{ fontFamily: 'var(--font)', fontWeight: 500, fontSize: 26, color: ASH, opacity: tag }}>
          Brand intelligence that reads your market in its own language
        </p>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/**
 * An act card: the place, read through the ticks, and the verb under it.
 *
 * Six ticks at fill 1.7 is the tuning the landing page's street band settled
 * on. The arc's own numbers do not transfer to a straight run: at the arc's
 * seven and 0.8 the band comes out as a row of stamps rather than one
 * photograph seen through a crescendo.
 */
const BAND_TICKS = 6
const BAND_FILL = 1.7
const BAND_RUN = rowTicks(BAND_TICKS, 1000, 320, BAND_FILL)
const BAND_BOX = tickBounds(BAND_RUN)

function Place({ beat, dur }: { beat: Extract<Beat, { kind: 'place' }>; dur: number }) {
  const frame = useCurrentFrame()
  const style = whip(frame, dur, 1)
  // One tick every three frames, which is the system's 90ms, tail to head.
  const lit = clamp01((frame - 5) / (BAND_TICKS * 3)) * BAND_TICKS
  const word = easeOut((frame - 22) / 18)
  const maskId = `band-${beat.word}`
  const W = 1560
  return (
    <AbsoluteFill className="items-center justify-center" style={style}>
      <div style={{ width: W, height: (W / BAND_BOX.w) * BAND_BOX.h, position: 'relative' }}>
        <svg aria-hidden width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <mask id={maskId} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
              {BAND_RUN.map((tk, i) => (
                <g key={i} transform={`scale(${1 / BAND_BOX.w},${1 / BAND_BOX.h}) translate(${-BAND_BOX.x0},${-BAND_BOX.y0})`}>
                  {/* A tick lights. It does not grow in, drift, or fade: the
                      lit state is the only state, so the reveal reads as a
                      count rather than a transition. */}
                  <path d={ATOM} transform={tk.transform} fill="#fff" fillOpacity={i < lit ? 1 : 0} />
                </g>
              ))}
            </mask>
          </defs>
        </svg>
        <div style={{ width: '100%', height: '100%', mask: `url(#${maskId})`, WebkitMask: `url(#${maskId})` }}>
          <Img
            src={staticFile(`landing/photos/${beat.photo}.jpg`)}
            alt={beat.alt}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      </div>
      <span style={{
        marginTop: 48, fontFamily: 'var(--font)', fontWeight: 500, fontSize: 168,
        letterSpacing: '-0.03em', color: INK, lineHeight: 1,
        opacity: word, transform: `translateY(${(1 - word) * 18}px)`,
      }}>
        {beat.word}<span style={{ color: FLARE }}>.</span>
      </span>
    </AbsoluteFill>
  )
}

function Chapter({ beat, dur }: { beat: Extract<Beat, { kind: 'chapter' }>; dur: number }) {
  const frame = useCurrentFrame()
  const dir = beat.side === 'right' ? 1 : -1
  const style = whip(frame, dur, dir as 1 | -1)
  // scene time: hold a beat after entry, finish before exit
  const t = clamp01((frame - IN * 0.5) / (dur - IN - OUT))
  // The headline arrives as one event. It used to come a word at a time, each
  // with its own 22px rise, which is the per-element fade-and-slide the motion
  // rules name outright.
  const p = easeOut((frame - IN) / 16)
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
    <div style={{ width: 480, opacity: p, transform: `translateY(${(1 - p) * 8}px)` }}>
      <div style={{ width: 46, height: 7, background: FLARE, marginBottom: 26, borderRadius: 'var(--r-card)' }} />
      {/* 500, at a size that carries. A heading that needs more presence needs
          a bigger size, not a heavier face — the film was at 800 throughout,
          which is where the whole product read as bulky. */}
      <h2 style={{ fontFamily: 'var(--font)', fontWeight: 500, fontSize: 66, lineHeight: 1.04, letterSpacing: '-0.02em', color: INK }}>
        {beat.headline}
      </h2>
    </div>
  )
  return (
    <AbsoluteFill className="flex-row items-center justify-center" style={{ gap: 84, ...style }}>
      {beat.side === 'left' ? <>{copy}{card}</> : <>{card}{copy}</>}
    </AbsoluteFill>
  )
}

/**
 * The eight verticals, each in the place its brand is judged in.
 *
 * The claim that the gauge reshapes itself per industry was only ever made in
 * words. Eight photographs light in sequence, at the tick cadence, and the one
 * still waiting on a picture draws the tick field with its name on it rather
 * than a gap.
 */
function Verticals({ dur }: { dur: number }) {
  const frame = useCurrentFrame()
  const style = whip(frame, dur, -1)
  const head = easeOut(frame / 16)
  return (
    <AbsoluteFill className="items-center justify-center" style={style}>
      <h2 style={{
        fontFamily: 'var(--font)', fontWeight: 500, fontSize: 62, letterSpacing: '-0.02em', color: INK,
        opacity: head, transform: `translateY(${(1 - head) * 8}px)`, marginBottom: 44,
      }}>
        One gauge, tuned to your industry<span style={{ color: FLARE }}>.</span>
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 306px)', gap: 26 }}>
        {VERTICALS.map((v, i) => {
          const on = easeOut((frame - 20 - i * 4) / 10)
          return (
            <div key={v.name} style={{ opacity: on }}>
              <div style={{
                width: 306, height: 200, overflow: 'hidden',
                borderRadius: 'var(--r-card)', border: '1px solid var(--line)',
                /* Paper, not shell, in the empty cell: the supplied mark is
                   drawn on a paper plate, so any other ground shows as a box
                   around it. */
                backgroundColor: v.photo ? 'var(--bg-shell)' : 'var(--bg-paper)',
                backgroundImage: v.photo ? undefined : `radial-gradient(${TRACK} 1.2px, transparent 1.2px)`,
                backgroundSize: v.photo ? undefined : '22px 22px',
              }}>
                {v.photo ? (
                  <Img src={staticFile(`landing/photos/${v.photo}.jpg`)} alt={v.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
                    <Img src={staticFile('brand-logo/brandgauge-mark-duotone-paper.svg')} alt=""
                      style={{ height: 74 }} />
                  </div>
                )}
              </div>
              <p style={{
                marginTop: 10, fontFamily: 'var(--font)', fontWeight: 500, fontSize: 20,
                letterSpacing: '0.08em', textTransform: 'uppercase', color: ASH,
              }}>
                {v.name}
              </p>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

function Outro({ dur }: { dur: number }) {
  const frame = useCurrentFrame()
  const p1 = easeOut(frame / 20)
  const p2 = easeOut((frame - 16) / 20)
  const p3 = easeOut((frame - 34) / 20)
  const fade = interpolate(frame, [dur - 18, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill className="items-center justify-center" style={{ opacity: 1 - fade }}>
      <div style={{ opacity: p1, transform: `translateY(${(1 - p1) * 14}px)` }}>
        <Lockup height={92} />
      </div>
      <p style={{ marginTop: 26, fontFamily: 'var(--font)', fontWeight: 500, fontSize: 30, color: ASH, opacity: p2 }}>
        Brand intelligence that reads your market in its own language.
      </p>
      {/* 700 here is the one place the rule allows it: this is the thing you
          press. */}
      <div style={{ marginTop: 44, opacity: p3, transform: `translateY(${(1 - p3) * 14}px)` }}>
        <span style={{
          fontFamily: 'var(--font)', fontWeight: 700, fontSize: 27, color: 'var(--on-hot)', background: FLARE,
          padding: '20px 44px', borderRadius: 'var(--r-card)',
        }}>
          Start free at brandgauge.app
        </span>
      </div>
    </AbsoluteFill>
  )
}

export function Unveil() {
  useFontsReady()
  const frame = useCurrentFrame()
  const starts: number[] = []
  BEATS.reduce((acc, b) => { starts.push(acc); return acc + b.dur }, 0)
  return (
    <AbsoluteFill style={{
      background: PAPER, color: INK, ...lightSceneVars,
      ['--s-map' as never]: `url(${staticFile('landing/ooh-map-light.png')})`,
    }}>
      <Backdrop />
      {BEATS.map((beat, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={beat.dur}>
          {beat.kind === 'logo' && <LogoIntro dur={beat.dur} />}
          {beat.kind === 'place' && <Place beat={beat} dur={beat.dur} />}
          {beat.kind === 'chapter' && <Chapter beat={beat} dur={beat.dur} />}
          {beat.kind === 'verticals' && <Verticals dur={beat.dur} />}
          {beat.kind === 'outro' && <Outro dur={beat.dur} />}
        </Sequence>
      ))}
      <Crescendo progress={frame / UNVEIL_DURATION} />
    </AbsoluteFill>
  )
}
