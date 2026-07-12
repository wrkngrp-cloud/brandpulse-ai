'use client'

import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import {
  AiScene, CompetitiveScene, FunnelScene, GaugeScene, OohScene,
  OutroScene, SentimentScene, WhatsAppScene, easeOut, win,
} from './scenes'

type SceneComp = (props: { t: number }) => React.ReactNode

interface Chapter {
  dur: number
  Comp?: SceneComp
  title?: string
  caption?: string
  sub?: string
}

/** 120 seconds total */
const TIMELINE: Chapter[] = [
  { dur: 6,  title: 'Meet BrandGauge', sub: 'Brand intelligence built for West African markets' },
  { dur: 14, Comp: GaugeScene,       caption: 'One score your CEO can ask about',      sub: 'The Brand Health Index blends sentiment, awareness, loyalty and advocacy, weighted for your industry.' },
  { dur: 15, Comp: SentimentScene,   caption: 'Sentiment with street sense',           sub: 'Reads Pidgin, Yoruba, Igbo and Hausa correctly. "This brand no try" is negative. We know.' },
  { dur: 15, Comp: FunnelScene,      caption: 'Marketing you can defend in money',     sub: 'CAC, ROI and funnel movement pulled live from Meta Ads, GA4, Paystack and your site pixel.' },
  { dur: 15, Comp: WhatsAppScene,    caption: 'Surveys where people actually reply',   sub: 'NPS and research over WhatsApp, opt-in and NDPR-aware, with replies scored as they land.' },
  { dur: 15, Comp: OohScene,         caption: 'From billboard to bank alert',          sub: 'Vanity links and search uplift turn OOH, radio, TV and print into measured channels.' },
  { dur: 15, Comp: AiScene,          caption: 'Ask your data anything',                sub: 'Plain-language answers from your own numbers. Plus a weekly check on how ChatGPT, Gemini and Perplexity describe you.' },
  { dur: 14, Comp: CompetitiveScene, caption: 'Know their moves before Monday',        sub: 'Share of voice and an auto-written competitive briefing at the start of every week.' },
  { dur: 11, Comp: OutroScene },
]
const TOTAL = TIMELINE.reduce((s, c) => s + c.dur, 0)

function chapterAt(time: number) {
  let acc = 0
  for (let i = 0; i < TIMELINE.length; i++) {
    const c = TIMELINE[i]
    if (time < acc + c.dur || i === TIMELINE.length - 1) {
      return { index: i, chapter: c, local: Math.min(1, Math.max(0, (time - acc) / c.dur)) }
    }
    acc += c.dur
  }
  return { index: 0, chapter: TIMELINE[0], local: 0 }
}

function TitleCard({ t, title, sub }: { t: number; title: string; sub?: string }) {
  const words = title.split(' ')
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-8 text-center">
      <h3 className="text-4xl font-extrabold tracking-tight text-[#F4EDE4] sm:text-5xl" style={{ fontFamily: 'var(--font-display)' }}>
        {words.map((w, i) => {
          const p = easeOut(win(t, 0.05 + i * 0.09, 0.3 + i * 0.09))
          return (
            <span key={i} className="inline-block whitespace-pre" style={{ opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
              {w === 'BrandGauge' ? <>Brand<span className="text-[#E06A32]">Gauge</span></> : w}{' '}
            </span>
          )
        })}
      </h3>
      {sub && (
        <p className="max-w-md text-sm text-white/50" style={{ opacity: easeOut(win(t, 0.4, 0.6)) }}>{sub}</p>
      )}
    </div>
  )
}

export function DemoPlayer() {
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)
  const timeRef = useRef(0)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!playing) return
    let id = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      timeRef.current = Math.min(TOTAL, timeRef.current + dt)
      setTime(timeRef.current)
      if (timeRef.current >= TOTAL) { setPlaying(false); return }
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [playing])

  const { index, chapter, local } = chapterAt(time)
  const done = time >= TOTAL

  function toggle() {
    setStarted(true)
    if (done) { timeRef.current = 0; setTime(0); setPlaying(true); return }
    setPlaying(p => !p)
  }

  function scrub(e: React.MouseEvent<HTMLDivElement>) {
    if (!barRef.current) return
    const rect = barRef.current.getBoundingClientRect()
    setStarted(true)
    timeRef.current = ((e.clientX - rect.left) / rect.width) * TOTAL
    setTime(timeRef.current)
  }

  const mm = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0B1022] shadow-[0_48px_140px_-40px_rgba(224,106,50,0.25)]">
      {/* stage */}
      <div className="relative aspect-video w-full">
        <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(43,89,255,0.10),transparent_70%)]" />
        <div key={index} className="absolute inset-x-4 inset-y-4 sm:inset-x-10 sm:inset-y-8">
          {chapter.Comp ? <chapter.Comp t={local} /> : <TitleCard t={local} title={chapter.title ?? ''} sub={chapter.sub} />}
        </div>

        {/* caption strip */}
        {chapter.Comp && chapter.caption && (
          <div className="pointer-events-none absolute inset-x-0 bottom-10 hidden justify-center sm:flex">
            <div className="mx-6 max-w-xl rounded-xl border border-white/[0.08] bg-[#0B1022]/85 px-4 py-2.5 text-center backdrop-blur"
              style={{ opacity: Math.min(easeOut(win(local, 0.02, 0.12)), 1 - win(local, 0.92, 1)) }}>
              <p className="text-[13px] font-bold text-[#F4EDE4]" style={{ fontFamily: 'var(--font-display)' }}>{chapter.caption}</p>
              {chapter.sub && <p className="mt-0.5 text-[11px] leading-snug text-white/50">{chapter.sub}</p>}
            </div>
          </div>
        )}

        {/* big play overlay before first start */}
        {!started && (
          <button onClick={toggle} className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#080C1A]/70 backdrop-blur-[2px]" aria-label="Play the 2 minute demo">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#E06A32] shadow-[0_0_60px_rgba(224,106,50,0.5)] transition-transform hover:scale-105">
              <Play className="ml-1 h-8 w-8 fill-white text-white" />
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/60">Watch the demo · 2 min</span>
          </button>
        )}
      </div>

      {/* controls */}
      <div className="flex items-center gap-3 border-t border-white/[0.07] bg-[#0D1226] px-4 py-3">
        <button onClick={toggle} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white transition-colors hover:bg-[#E06A32]"
          aria-label={done ? 'Replay' : playing ? 'Pause' : 'Play'}>
          {done ? <RotateCcw className="h-3.5 w-3.5" /> : playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
        </button>
        <span className="w-10 shrink-0 font-mono text-[10px] tabular-nums text-white/45">{mm(time)}</span>
        <div ref={barRef} onClick={scrub} className="relative h-6 flex-1 cursor-pointer">
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/[0.08]">
            <div className="h-full rounded-full bg-[#E06A32]" style={{ width: `${(time / TOTAL) * 100}%` }} />
          </div>
          {/* chapter markers */}
          {TIMELINE.slice(0, -1).map((c, i) => {
            const at = TIMELINE.slice(0, i + 1).reduce((s, x) => s + x.dur, 0)
            return <span key={i} className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-white/25" style={{ left: `${(at / TOTAL) * 100}%` }} />
          })}
        </div>
        <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-white/45">{mm(TOTAL)}</span>
      </div>
    </div>
  )
}
