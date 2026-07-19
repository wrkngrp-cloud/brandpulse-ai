'use client'

/**
 * Deterministic demo scenes. Every scene is a pure function of `t` (0 → 1),
 * so the same components drive the horizontal tour, the in-page demo player,
 * and the Remotion MP4 without divergence.
 *
 * Theming: scenes read CSS variables so they render native-light on the
 * landing page and cinematic-dark inside the demo player / video. Apply
 * `lightSceneVars` or `darkSceneVars` on any ancestor.
 */

import type { CSSProperties } from 'react'

// ————— timing helpers —————
export function clamp01(v: number) { return Math.min(1, Math.max(0, v)) }
export function win(t: number, a: number, b: number) { return clamp01((t - a) / (b - a)) }
export function easeOut(v: number) { return 1 - Math.pow(1 - clamp01(v), 3) }
export function easeInOut(v: number) { const x = clamp01(v); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }
/** ease-out-back: small overshoot for pop-ins */
export function pop(v: number) { const x = clamp01(v); return 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2) }

export const CLAY = '#D4602A'
export const BLUE = '#2B59FF'

export const lightSceneVars: CSSProperties = {
  '--s-map':    "url('/landing/ooh-map-light.png')",
  '--s-panel':  '#FFFFFF',
  '--s-line':   'rgba(20,24,43,0.10)',
  '--s-strong': '#14182B',
  '--s-body':   'rgba(20,24,43,0.78)',
  '--s-mut':    'rgba(20,24,43,0.45)',
  '--s-chip':   'rgba(20,24,43,0.035)',
  '--s-track':  'rgba(20,24,43,0.08)',
  '--s-shadow': '0 18px 60px -22px rgba(20,24,43,0.18)',
} as CSSProperties

export const darkSceneVars: CSSProperties = {
  '--s-map':    "url('/landing/ooh-map-dark.png')",
  '--s-panel':  'rgba(17,24,48,0.92)',
  '--s-line':   'rgba(255,255,255,0.09)',
  '--s-strong': '#F4EDE4',
  '--s-body':   'rgba(244,237,228,0.80)',
  '--s-mut':    'rgba(244,237,228,0.42)',
  '--s-chip':   'rgba(255,255,255,0.04)',
  '--s-track':  'rgba(255,255,255,0.09)',
  '--s-shadow': '0 24px 80px -24px rgba(0,0,0,0.8)',
} as CSSProperties

// ————— shared chrome —————
function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-[var(--s-line)] bg-[var(--s-panel)] ${className}`}
      style={{ boxShadow: 'var(--s-shadow)' }}
    >
      {children}
    </div>
  )
}

function Tag({ children, tone = 'dim' }: { children: React.ReactNode; tone?: 'dim' | 'clay' | 'blue' | 'green' | 'red' | 'teal' }) {
  const tones: Record<string, CSSProperties> = {
    dim:   { color: 'var(--s-mut)', borderColor: 'var(--s-line)' },
    clay:  { color: CLAY, borderColor: 'rgba(212,96,42,0.35)', background: 'rgba(212,96,42,0.08)' },
    blue:  { color: BLUE, borderColor: 'rgba(43,89,255,0.30)', background: 'rgba(43,89,255,0.07)' },
    green: { color: '#16a34a', borderColor: 'rgba(34,197,94,0.35)', background: 'rgba(34,197,94,0.08)' },
    red:   { color: '#dc2626', borderColor: 'rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.07)' },
    teal:  { color: '#0d9488', borderColor: 'rgba(20,184,166,0.35)', background: 'rgba(20,184,166,0.08)' },
  }
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]" style={tones[tone]}>
      {children}
    </span>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--s-mut)]">{children}</p>
}

// ————— Scene 1: Brand Health Index — faithful to src/components/dashboard/bhi-gauge.tsx —————
// 270° arc, centre (100,108), r 82, start 225° end 315°, healthy zone green gradient,
// zone ticks at 40/65/80, indicator dot, count-up, zone badge, component pills, sparkline.
const CX = 100, CY = 108, R = 82
function ptOnArc(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  // Round to 3 decimals so the SVG coordinate serialises identically on the
  // server and the client. Full-precision floats stringify differently across
  // the two and trip a hydration mismatch that repaints the whole gauge.
  const round = (n: number) => Math.round(n * 1000) / 1000
  return { x: round(CX + R * Math.cos(rad)), y: round(CY - R * Math.sin(rad)) }
}
const START = ptOnArc(225)
const END   = ptOnArc(315)
const TRACK_D = `M ${START.x} ${START.y} A ${R} ${R} 0 1 1 ${END.x} ${END.y}`
const ARC_LEN = 2 * Math.PI * R * (270 / 360)

export function GaugeScene({ t }: { t: number }) {
  const SCORE = 72
  const sweep = easeOut(win(t, 0.06, 0.5))
  const score = Math.round(SCORE * sweep)
  const dotP  = ptOnArc(225 - (SCORE / 100) * 270)
  const dotIn = easeOut(win(t, 0.48, 0.58))
  const spark = [64, 66, 65, 67, 66, 68, 70, 69, 71, 70, 72, 72]
  const sparkDraw = easeInOut(win(t, 0.55, 0.85))
  const SW = 220, SH = 28
  const minS = 60, range = 16
  const sparkPts = spark.map((s, i) => `${((i / (spark.length - 1)) * SW).toFixed(1)},${(SH - ((s - minS) / range) * (SH - 2)).toFixed(1)}`).join(' ')
  const pills = [
    { label: 'Sentiment', value: 78 },
    { label: 'SOV',       value: 64 },
    { label: 'Survey',    value: 71 },
  ]
  return (
    <Panel className="flex h-full w-full flex-col items-center justify-center gap-4 p-4 @xl:flex-row @xl:gap-10 @xl:p-6">
      <div className="flex flex-col items-center gap-3">
        <Label>Brand Health Index</Label>
        <svg width="220" height="138" viewBox="0 0 200 138" className="overflow-visible">
          <defs>
            <linearGradient id="lg-bhi" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" /><stop offset="100%" stopColor="#4ade80" />
            </linearGradient>
            <filter id="lg-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <path d={TRACK_D} fill="none" stroke="var(--s-track)" strokeWidth={14} strokeLinecap="round" />
          {[40, 65, 80].map(pct => {
            const p = ptOnArc(225 - (pct / 100) * 270)
            return <circle key={pct} cx={p.x} cy={p.y} r={2.5} fill="var(--s-panel)" opacity={0.9} />
          })}
          <path d={TRACK_D} fill="none" stroke="url(#lg-bhi)" strokeWidth={14} strokeLinecap="round" filter="url(#lg-glow)"
            strokeDasharray={ARC_LEN} strokeDashoffset={ARC_LEN * (1 - (SCORE / 100) * sweep)} opacity={win(t, 0.02, 0.1)} />
          <circle cx={dotP.x} cy={dotP.y} r={7 * dotIn} fill="#4ade80" style={{ filter: 'drop-shadow(0 0 6px rgba(34,197,94,0.4))' }} />
          <circle cx={dotP.x} cy={dotP.y} r={3.5 * dotIn} fill="white" />
          <text x={CX} y={CY - 14} textAnchor="middle" fontSize="48" fontWeight="700" letterSpacing="-2"
            fontFamily="var(--font-display), system-ui, sans-serif" fill="var(--s-strong)">{score}</text>
          <text x={CX} y={CY + 10} textAnchor="middle" fontSize="11" fill="var(--s-mut)">out of 100</text>
          <text x={START.x - 2} y={START.y + 18} textAnchor="middle" fontSize="9" fill="var(--s-mut)">0</text>
          <text x={END.x + 2} y={END.y + 18} textAnchor="middle" fontSize="9" fill="var(--s-mut)">100</text>
        </svg>
        <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
          style={{ color: '#22c55e', backgroundColor: '#22c55e15', borderColor: '#22c55e30', opacity: win(t, 0.5, 0.62) }}>
          <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" /> Healthy
        </span>
      </div>
      <div className="flex w-full max-w-[280px] flex-col gap-3 @xl:w-[240px]">
        <div className="grid grid-cols-3 gap-2 text-center">
          {pills.map((c, i) => {
            const p = easeOut(win(t, 0.35 + i * 0.08, 0.5 + i * 0.08))
            return (
              <div key={c.label} className="space-y-0.5 rounded-lg border border-[var(--s-line)] bg-[var(--s-chip)] py-2.5"
                style={{ opacity: p, transform: `translateY(${(1 - p) * 8}px)` }}>
                <p className="text-sm font-semibold tabular-nums text-[var(--s-strong)]">{Math.round(c.value * p)}</p>
                <p className="text-[10px] text-[var(--s-mut)]">{c.label}</p>
              </div>
            )
          })}
        </div>
        <div className="space-y-1.5" style={{ opacity: win(t, 0.55, 0.7) }}>
          <p className="text-[10px] text-[var(--s-mut)]">30-day trend</p>
          <svg width="100%" height={SH} viewBox={`0 0 ${SW} ${SH}`} preserveAspectRatio="none" className="overflow-visible">
            <defs>
              <linearGradient id="lg-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.22" /><stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={`0,${SH} ${sparkPts} ${SW},${SH}`} fill="url(#lg-area)" opacity={sparkDraw} />
            <polyline points={sparkPts} fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"
              strokeDasharray={300} strokeDashoffset={300 * (1 - sparkDraw)} />
          </svg>
        </div>
        <p className="hidden text-[11px] leading-relaxed text-[var(--s-mut)] @xl:block" style={{ opacity: win(t, 0.7, 0.85) }}>
          Weighted for your industry. Fintech counts trust signals; FMCG counts shelf and share of voice.
        </p>
      </div>
    </Panel>
  )
}

// ————— Scene 2: sentiment with street sense —————
const MENTIONS: { text: string; lang: string; tone: 'green' | 'red' }[] = [
  { text: 'This app no dey fall my hand at all 🙌', lang: 'Pidgin',  tone: 'green' },
  { text: 'Ẹ jọ̀wọ́, transfer ti stuck since morning', lang: 'Yoruba', tone: 'red' },
  { text: 'Their customer care sabi wetin dem dey do', lang: 'Pidgin', tone: 'green' },
  { text: 'Onye ọ bụla kwesịrị ịnwale ya. Solid app!', lang: 'Igbo',   tone: 'green' },
]
export function SentimentScene({ t }: { t: number }) {
  const line = easeInOut(win(t, 0.1, 0.9))
  const pts = [42, 38, 44, 40, 52, 49, 58, 61, 57, 66, 70, 68]
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * (280 / 11)} ${80 - (p / 100) * 72}`).join(' ')
  return (
    <Panel className="flex h-full w-full flex-col gap-4 p-4 @xl:flex-row @xl:gap-6 @xl:p-6">
      <div className="flex w-full flex-col gap-2.5 @xl:w-[52%]">
        <div className="flex items-center justify-between">
          <Label>Live mentions</Label>
          <div className="flex gap-1.5"><Tag tone="blue">X</Tag><Tag tone="clay">Instagram</Tag></div>
        </div>
        {MENTIONS.map((m, i) => {
          const p = easeOut(win(t, 0.08 + i * 0.16, 0.24 + i * 0.16))
          const tagged = win(t, 0.2 + i * 0.16, 0.28 + i * 0.16) > 0.5
          return (
            <div key={i} className={`flex items-start gap-2 rounded-xl border border-[var(--s-line)] bg-[var(--s-chip)] px-3 py-2 ${i === 3 ? 'hidden @xl:flex' : ''}`}
              style={{ opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
              <p className="flex-1 text-[11.5px] leading-snug text-[var(--s-body)]">{m.text}</p>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Tag>{m.lang}</Tag>
                {tagged && <Tag tone={m.tone}>{m.tone === 'green' ? 'Positive' : 'Negative'}</Tag>}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex flex-1 flex-col justify-center gap-3">
        <Label>Social score · 30 days</Label>
        <svg viewBox="0 0 280 88" className="w-full">
          <path d={path} fill="none" stroke={CLAY} strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray={400} strokeDashoffset={400 * (1 - line)} />
          {line > 0.97 && <circle cx={280} cy={80 - 0.68 * 72} r="4" fill={CLAY} />}
        </svg>
        <div className="flex gap-2" style={{ opacity: win(t, 0.55, 0.7) }}>
          <Tag tone="green">68 positive</Tag><Tag>21 neutral</Tag><Tag tone="red">11 negative</Tag>
        </div>
        <p className="hidden text-[11px] leading-relaxed text-[var(--s-mut)] @xl:block" style={{ opacity: win(t, 0.65, 0.8) }}>
          Pidgin, Yoruba, Igbo and Hausa classified correctly. No lost-in-translation scores.
        </p>
      </div>
    </Panel>
  )
}

// ————— Scene 3: funnel + money metrics —————
export function FunnelScene({ t }: { t: number }) {
  const stages = [
    { label: 'Aware',    v: 1.0,  n: '2.4M' },
    { label: 'Consider', v: 0.62, n: '486k' },
    { label: 'Convert',  v: 0.31, n: '92k'  },
    { label: 'Advocate', v: 0.14, n: '18k'  },
  ]
  const tiles = [
    { label: 'CAC',  value: '₦412',  delta: '▼ 9%'  },
    { label: 'ROI',  value: '3.8x',  delta: '▲ 0.4' },
    { label: 'MQLs', value: '1,204', delta: '▲ 22%' },
  ]
  const srcs = ['Meta Ads', 'GA4', 'Paystack', 'Pixel']
  return (
    <Panel className="flex h-full w-full flex-col gap-4 p-4 @xl:gap-5 @xl:p-6">
      <div className="flex flex-col gap-2 @xl:flex-row @xl:items-center @xl:justify-between">
        <Label>Funnel · live connector data</Label>
        <div className="flex flex-wrap gap-1.5">
          {srcs.map((s, i) => (
            <span key={s} style={{ opacity: win(t, 0.05 + i * 0.06, 0.15 + i * 0.06) }}><Tag tone="blue">{s}</Tag></span>
          ))}
        </div>
      </div>
      <div className="flex flex-1 items-end gap-3">
        {stages.map((s, i) => {
          const p = easeOut(win(t, 0.12 + i * 0.1, 0.42 + i * 0.1))
          return (
            <div key={s.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <span className="font-mono text-[11px] text-[var(--s-body)]" style={{ opacity: p }}>{s.n}</span>
              <div className="w-full rounded-t-lg" style={{
                height: `${8 + s.v * 80 * p}%`,
                background: `linear-gradient(180deg, ${i === 2 ? CLAY : BLUE} 0%, transparent 160%)`,
                opacity: 0.9,
              }} />
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--s-mut)]">{s.label}</span>
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((m, i) => {
          const p = easeOut(win(t, 0.5 + i * 0.09, 0.68 + i * 0.09))
          return (
            <div key={m.label} className="rounded-xl border border-[var(--s-line)] bg-[var(--s-chip)] p-3"
              style={{ opacity: p, transform: `translateY(${(1 - p) * 12}px)` }}>
              <Label>{m.label}</Label>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-[var(--s-strong)]" style={{ fontFamily: 'var(--font-display)' }}>{m.value}</span>
                <span className="font-mono text-[10px] text-emerald-600">{m.delta}</span>
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

// ————— Scene 4: WhatsApp surveys —————
export function WhatsAppScene({ t }: { t: number }) {
  const replies = [
    { text: '9 — una dey try, keep am up', score: 9 },
    { text: '10! Best app for transfers, no wahala', score: 10 },
    { text: '6 — app good but charges too much', score: 6 },
  ]
  const nps = Math.round(58 * easeOut(win(t, 0.55, 0.85)))
  return (
    <Panel className="flex h-full w-full flex-col gap-4 p-4 @xl:flex-row @xl:gap-6 @xl:p-6">
      <div className="flex w-full flex-col gap-2.5 @xl:w-1/2">
        <div className="flex items-center justify-between">
          <Label>WhatsApp survey · NPS wave 4</Label>
          <Tag tone="green">Opt-in only</Tag>
        </div>
        <div className="rounded-2xl rounded-tr-sm bg-[#1F5C46] px-3 py-2 text-[11.5px] leading-snug text-white/95"
          style={{ opacity: easeOut(win(t, 0.05, 0.18)) }}>
          Quick one 🙏 On a scale of 0–10, how likely are you to recommend PocketPay to a friend?
        </div>
        {replies.map((r, i) => {
          const p = easeOut(win(t, 0.22 + i * 0.14, 0.36 + i * 0.14))
          return (
            <div key={i} className="mr-10 flex items-center gap-2 self-start rounded-2xl rounded-tl-sm border border-[var(--s-line)] bg-[var(--s-chip)] px-3 py-2"
              style={{ opacity: p, transform: `translateX(${(1 - p) * -16}px)` }}>
              <p className="text-[11.5px] text-[var(--s-body)]">{r.text}</p>
              <Tag tone={r.score >= 9 ? 'green' : r.score >= 7 ? 'dim' : 'red'}>{r.score}</Tag>
            </div>
          )
        })}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <Label>Net Promoter Score</Label>
        <span className="text-5xl font-extrabold text-[var(--s-strong)] @xl:text-6xl" style={{ fontFamily: 'var(--font-display)' }}>+{nps}</span>
        <div className="flex gap-2" style={{ opacity: win(t, 0.7, 0.85) }}>
          <Tag tone="green">61% promoters</Tag><Tag tone="red">3% detractors</Tag>
        </div>
        <p className="hidden max-w-[220px] text-center text-[11px] leading-relaxed text-[var(--s-mut)] @xl:block" style={{ opacity: win(t, 0.78, 0.92) }}>
          Surveys go where your customers already reply: WhatsApp, email, in-app and link.
        </p>
      </div>
    </Panel>
  )
}

// ————— Scene 5: offline attribution —————
/** OOH sites plotted on the Lagos basemap in public/landing/ooh-map-*.png.
 *  left/top percentages are Web-Mercator projections of the real coordinates
 *  for the frame baked into that asset (center 3.412,6.516 · z11) — regenerate
 *  both together via scripts if the frame ever changes. */
const OOH_SITES = [
  { name: 'Lekki–Epe Expressway',    left: 61.0, top: 70.0, hero: true },
  { name: 'Ozumba Mbadiwe, VI',      left: 51.8, top: 75.8, hero: false },
  { name: 'Third Mainland Bridge',   left: 48.5, top: 56.4, hero: false },
  { name: 'Allen Avenue, Ikeja',     left: 38.9, top: 25.1, hero: false },
  { name: 'Apapa–Oshodi Expressway', left: 39.8, top: 60.0, hero: false },
]
export function OohScene({ t }: { t: number }) {
  const url = 'brandgauge.app/go/jara-lekki'
  const typed = url.slice(0, Math.floor(url.length * win(t, 0.35, 0.65)))
  const lift = Math.round(18 * easeOut(win(t, 0.6, 0.85)))
  return (
    <Panel className="flex h-full w-full flex-col gap-4 p-4 @xl:flex-row @xl:gap-6 @xl:p-6">
      <div className="flex w-full flex-col justify-center gap-3 @xl:w-[55%]">
        <div className="flex items-center justify-between">
          <Label>OOH sites · Lagos</Label>
          <Tag tone="clay">5 live</Tag>
        </div>
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-[var(--s-line)]"
          style={{ opacity: easeOut(win(t, 0.02, 0.18)) }}>
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'var(--s-map)' }} />
          {OOH_SITES.map((s, i) => {
            const drop = pop(win(t, 0.12 + i * 0.09, 0.3 + i * 0.09))
            // deterministic pulse: phase loops with t so Remotion frames stay pure
            const phase = ((t * 3 + i * 0.23) % 1)
            return (
              <div key={s.name} className="absolute" style={{ left: `${s.left}%`, top: `${s.top}%`, transform: 'translate(-50%, -100%)', zIndex: s.hero ? 10 : 1 }}>
                <div className="absolute left-1/2 top-full h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border"
                  style={{ borderColor: CLAY, opacity: drop * 0.5 * (1 - phase), transform: `translate(-50%,-50%) scale(${0.3 + phase * 0.9})` }} />
                <svg viewBox="0 0 24 24" className="h-5 w-5" style={{ opacity: Math.min(1, drop), transform: `scale(${drop})`, transformOrigin: 'bottom center' }}>
                  <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Z" fill={s.hero ? CLAY : BLUE} stroke="white" strokeWidth="1.5" />
                  <circle cx="12" cy="9" r="2.6" fill="white" />
                </svg>
                {s.hero && (
                  <div className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--s-line)] bg-[var(--s-panel)] px-2 py-1"
                    style={{ opacity: easeOut(win(t, 0.5, 0.62)), boxShadow: 'var(--s-shadow)' }}>
                    <p className="text-[10px] font-bold text-[var(--s-strong)]">Lekki–Epe Expressway</p>
                    <p className="font-mono text-[8.5px] text-[var(--s-mut)]">48-sheet · 3,412 visits</p>
                  </div>
                )}
              </div>
            )
          })}
          <span className="absolute bottom-1 right-1.5 text-[7px] text-[var(--s-mut)]">© OpenStreetMap · © CARTO</span>
        </div>
        <div className="hidden items-center gap-2 rounded-xl border border-[var(--s-line)] bg-[var(--s-chip)] px-3 py-2.5 @xl:flex">
          <span className="h-2 w-2 rounded-full" style={{ background: CLAY }} />
          <span className="font-mono text-[11px] text-[var(--s-body)]">{typed}<span className="animate-pulse" style={{ color: CLAY }}>▍</span></span>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-4">
        <Label>Attribution · last 30 days</Label>
        {[
          { label: 'Vanity link visits', value: '3,412', p: 0.9 },
          { label: 'Branded search uplift', value: `+${lift}%`, p: 0.62, clay: true },
          { label: 'New customers within 5km', value: '208', p: 0.38 },
        ].map((row, i) => {
          const p = easeOut(win(t, 0.35 + i * 0.12, 0.6 + i * 0.12))
          return (
            <div key={row.label} style={{ opacity: p }}>
              <div className="mb-1.5 flex justify-between">
                <span className="text-[11px] text-[var(--s-body)]">{row.label}</span>
                <span className="font-mono text-[12px] font-bold text-[var(--s-strong)]">{row.value}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--s-track)]">
                <div className="h-full rounded-full" style={{ width: `${row.p * 100 * p}%`, background: row.clay ? CLAY : BLUE, opacity: row.clay ? 1 : 0.6 }} />
              </div>
            </div>
          )
        })}
        <p className="hidden text-[11px] leading-relaxed text-[var(--s-mut)] @xl:block" style={{ opacity: win(t, 0.72, 0.88) }}>
          Billboards, radio, TV and print measured with vanity links and search uplift. Not gut feeling.
        </p>
      </div>
    </Panel>
  )
}

// ————— Scene 6: AI command + AI visibility —————
export function AiScene({ t }: { t: number }) {
  const q = 'Why did sentiment dip in Kano last week?'
  const typed = q.slice(0, Math.floor(q.length * win(t, 0.05, 0.3)))
  const answers = [
    'Negative spike traces to a 14-hour USSD outage on Tuesday.',
    '62% of negative mentions were in Hausa. Top phrase: "ba ya aiki" (it is not working).',
    'Recommend: WhatsApp service update to northern segments + status page link.',
  ]
  const platforms = [
    { name: 'ChatGPT', score: 82 }, { name: 'Gemini', score: 74 }, { name: 'Perplexity', score: 68 },
  ]
  return (
    <Panel className="flex h-full w-full flex-col gap-3 p-4 @xl:gap-4 @xl:p-6">
      <div className="flex items-center gap-2 rounded-xl border px-4 py-3" style={{ borderColor: 'rgba(212,96,42,0.35)', background: 'rgba(212,96,42,0.05)' }}>
        <span className="text-[13px]" style={{ color: CLAY }}>✦</span>
        <span className="text-[12.5px] text-[var(--s-body)]">{typed}<span className="animate-pulse" style={{ color: CLAY }}>▍</span></span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {answers.map((a, i) => {
          const p = easeOut(win(t, 0.32 + i * 0.12, 0.46 + i * 0.12))
          return (
            <div key={i} className="flex items-start gap-2.5 rounded-lg bg-[var(--s-chip)] px-3 py-2"
              style={{ opacity: p, transform: `translateY(${(1 - p) * 10}px)` }}>
              <span className="mt-0.5 font-mono text-[10px]" style={{ color: CLAY }}>{String(i + 1).padStart(2, '0')}</span>
              <p className="text-[11.5px] leading-relaxed text-[var(--s-body)]">{a}</p>
            </div>
          )
        })}
      </div>
      <div className="border-t border-[var(--s-line)] pt-3">
        <div className="mb-2 flex items-center justify-between">
          <Label>How AI answers about your brand</Label>
          <Tag tone="clay">Weekly check</Tag>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {platforms.map((pl, i) => {
            const p = easeOut(win(t, 0.68 + i * 0.08, 0.82 + i * 0.08))
            return (
              <div key={pl.name} className="rounded-lg border border-[var(--s-line)] bg-[var(--s-chip)] px-3 py-2" style={{ opacity: p }}>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--s-mut)]">{pl.name}</p>
                <p className="text-lg font-extrabold text-[var(--s-strong)]" style={{ fontFamily: 'var(--font-display)' }}>{Math.round(pl.score * p)}</p>
              </div>
            )
          })}
        </div>
      </div>
    </Panel>
  )
}

// ————— Scene 7: competitive —————
export function CompetitiveScene({ t }: { t: number }) {
  const share = [
    { name: 'You',          v: 46, color: CLAY },
    { name: 'Competitor A', v: 32, color: BLUE },
    { name: 'Competitor B', v: 22, color: 'var(--s-track)' },
  ]
  const sweep = easeInOut(win(t, 0.08, 0.55))
  let acc = 0
  return (
    <Panel className="flex h-full w-full flex-col gap-4 p-4 @xl:flex-row @xl:gap-6 @xl:p-6">
      <div className="flex w-full flex-col items-center justify-center gap-3 @xl:w-[45%]">
        <Label>Share of voice</Label>
        <svg viewBox="0 0 120 120" className="w-full max-w-[130px] -rotate-90 @xl:max-w-[180px]">
          {share.map(s => {
            const C = 2 * Math.PI * 46
            const frac = (s.v / 100) * sweep
            const el = (
              <circle key={s.name} cx="60" cy="60" r="46" fill="none" stroke={s.color} strokeWidth="14"
                strokeDasharray={`${C * frac} ${C}`} strokeDashoffset={-C * acc} />
            )
            acc += frac
            return el
          })}
        </svg>
        <div className="flex flex-wrap justify-center gap-1.5">
          {share.map(s => <Tag key={s.name} tone={s.name === 'You' ? 'clay' : 'dim'}>{s.name} {Math.round(s.v * sweep)}%</Tag>)}
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-3">
        <Label>Monday briefing · auto-generated</Label>
        {[
          'Competitor A cut fees on Thursday. Their mention volume rose 31%, sentiment fell 4 points on hidden-charge complaints.',
          'Your share of voice is up 5 points, driven by the Detty December campaign.',
          'Watch: Competitor B is testing WhatsApp support. Two weeks of positive chatter.',
        ].map((line, i) => {
          const p = easeOut(win(t, 0.35 + i * 0.15, 0.55 + i * 0.15))
          return (
            <div key={i} className="rounded-xl border border-[var(--s-line)] bg-[var(--s-chip)] px-3.5 py-2.5"
              style={{ opacity: p, transform: `translateY(${(1 - p) * 12}px)` }}>
              <p className="text-[11.5px] leading-relaxed text-[var(--s-body)]">{line}</p>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

// ————— Scene 8: outro —————
export function OutroScene({ t }: { t: number }) {
  const p1 = easeOut(win(t, 0.05, 0.35))
  const p2 = easeOut(win(t, 0.3, 0.55))
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5" style={{ color: 'var(--s-strong)' }}>
      <div style={{ opacity: p1, transform: `scale(${0.92 + p1 * 0.08})` }} className="flex items-center gap-3">
        <GaugeMark className="h-10 w-10" />
        <span className="text-4xl font-extrabold tracking-tight text-[var(--s-strong)]" style={{ fontFamily: 'var(--font-display)' }}>
          Brand<span style={{ color: CLAY }}>Gauge</span>
        </span>
      </div>
      <p className="max-w-md text-center text-[15px] leading-relaxed text-[var(--s-mut)]" style={{ opacity: p2 }}>
        Brand intelligence that speaks your market&apos;s language.
      </p>
      <div style={{ opacity: p2 }}>
        <span className="rounded-full px-5 py-2.5 text-[13px] font-bold text-white" style={{ background: CLAY }}>Start free at brandgauge.app</span>
      </div>
    </div>
  )
}

// ————— logo mark —————
export function GaugeMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <path d="M 8 30 A 16 16 0 1 1 32 30" fill="none" stroke="var(--s-track, rgba(20,24,43,0.2))" strokeWidth="4" strokeLinecap="round" />
      <path d="M 8 30 A 16 16 0 0 1 20 4" fill="none" stroke={CLAY} strokeWidth="4" strokeLinecap="round" />
      <line x1="20" y1="24" x2="28" y2="13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="20" cy="24" r="3" fill="currentColor" />
    </svg>
  )
}
