'use client'

/**
 * Deterministic demo scenes. Every scene is a pure function of `t` (0 → 1),
 * so the same components drive the scroll stage, the in-page demo player,
 * and the Remotion MP4 port without divergence.
 */

// ————— timing helpers —————
export function clamp01(v: number) { return Math.min(1, Math.max(0, v)) }
/** progress remapped to a sub-window [a, b] of the scene */
export function win(t: number, a: number, b: number) { return clamp01((t - a) / (b - a)) }
export function easeOut(v: number) { return 1 - Math.pow(1 - clamp01(v), 3) }
export function easeInOut(v: number) { const x = clamp01(v); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }

const CLAY = '#E06A32'
const BLUE = '#4F7DFF'
const SAND = '#F4EDE4'

// ————— shared chrome —————
function Panel({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-[#111830]/90 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)] backdrop-blur ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}

function Tag({ children, tone = 'dim' }: { children: React.ReactNode; tone?: 'dim' | 'clay' | 'blue' | 'green' | 'red' }) {
  const tones = {
    dim:   'text-white/40 border-white/10',
    clay:  'text-[#E8926A] border-[#E06A32]/40 bg-[#E06A32]/10',
    blue:  'text-[#8FA9FF] border-[#4F7DFF]/40 bg-[#4F7DFF]/10',
    green: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10',
    red:   'text-rose-300 border-rose-400/30 bg-rose-400/10',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ${tones[tone]}`}>
      {children}
    </span>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/35">{children}</p>
}

// ————— Scene 1: Brand Health Index gauge —————
export function GaugeScene({ t }: { t: number }) {
  const sweep = easeOut(win(t, 0.05, 0.55))
  const score = Math.round(72 * sweep)
  const bars = [
    { label: 'Sentiment',     v: 0.78 },
    { label: 'Awareness',     v: 0.64 },
    { label: 'Consideration', v: 0.58 },
    { label: 'Loyalty',       v: 0.71 },
    { label: 'Advocacy',      v: 0.52 },
  ]
  // arc: 270° dial starting at 135°
  const angle = 135 + 270 * 0.72 * sweep
  const R = 74
  const rad = (a: number) => (a * Math.PI) / 180
  const arcPoint = (a: number) => [100 + R * Math.cos(rad(a)), 104 + R * Math.sin(rad(a))]
  const [nx, ny] = arcPoint(angle)
  const arcLen = 2 * Math.PI * R * (270 / 360)

  return (
    <Panel className="flex h-full w-full items-stretch gap-6 p-6">
      <div className="flex w-[46%] flex-col items-center justify-center">
        <Label>Brand Health Index</Label>
        <svg viewBox="0 0 200 190" className="mt-1 w-full max-w-[240px]">
          <path d="M 47.7 156.3 A 74 74 0 1 1 152.3 156.3" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" strokeLinecap="round" />
          <path
            d="M 47.7 156.3 A 74 74 0 1 1 152.3 156.3"
            fill="none" stroke={CLAY} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={arcLen}
            strokeDashoffset={arcLen * (1 - 0.72 * sweep)}
          />
          <line x1="100" y1="104" x2={nx} y2={ny} stroke={SAND} strokeWidth="2.5" strokeLinecap="round" opacity={0.9} />
          <circle cx="100" cy="104" r="5" fill={SAND} />
          <text x="100" y="96" textAnchor="middle" fill={SAND} fontSize="34" fontWeight="800" fontFamily="var(--font-display)">{score}</text>
          <text x="100" y="126" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="9" fontFamily="var(--font-mono)" letterSpacing="2">OF 100</text>
        </svg>
        <div style={{ opacity: win(t, 0.5, 0.65) }}>
          <Tag tone="green">▲ 6 pts vs last month</Tag>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-3">
        <Label>Signal breakdown · fintech weights</Label>
        {bars.map((b, i) => {
          const p = easeOut(win(t, 0.25 + i * 0.08, 0.55 + i * 0.08))
          return (
            <div key={b.label}>
              <div className="mb-1 flex justify-between font-mono text-[10px] text-white/55">
                <span>{b.label}</span><span>{Math.round(b.v * 100 * p)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full" style={{ width: `${b.v * 100 * p}%`, background: i === 0 ? CLAY : BLUE, opacity: i === 0 ? 1 : 0.7 }} />
              </div>
            </div>
          )
        })}
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
    <Panel className="flex h-full w-full gap-6 p-6">
      <div className="flex w-[52%] flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <Label>Live mentions</Label>
          <div className="flex gap-1.5">
            <Tag tone="blue">X</Tag><Tag tone="clay">Instagram</Tag>
          </div>
        </div>
        {MENTIONS.map((m, i) => {
          const p = easeOut(win(t, 0.08 + i * 0.16, 0.24 + i * 0.16))
          const tagged = win(t, 0.2 + i * 0.16, 0.28 + i * 0.16) > 0.5
          return (
            <div key={i} className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2"
              style={{ opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
              <p className="flex-1 text-[11.5px] leading-snug text-white/80">{m.text}</p>
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
        <p className="text-[11px] leading-relaxed text-white/45" style={{ opacity: win(t, 0.65, 0.8) }}>
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
    { label: 'CAC',  value: '₦412',  delta: '▼ 9%',  good: true },
    { label: 'ROI',  value: '3.8x',  delta: '▲ 0.4', good: true },
    { label: 'MQLs', value: '1,204', delta: '▲ 22%', good: true },
  ]
  const srcs = ['Meta Ads', 'GA4', 'Paystack', 'Pixel']
  return (
    <Panel className="flex h-full w-full flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <Label>Funnel · live connector data</Label>
        <div className="flex gap-1.5">
          {srcs.map((s, i) => (
            <span key={s} style={{ opacity: win(t, 0.05 + i * 0.06, 0.15 + i * 0.06) }}><Tag tone="blue">{s}</Tag></span>
          ))}
        </div>
      </div>
      <div className="flex flex-1 items-end gap-3">
        {stages.map((s, i) => {
          const p = easeOut(win(t, 0.12 + i * 0.1, 0.42 + i * 0.1))
          return (
            <div key={s.label} className="flex flex-1 flex-col items-center gap-2">
              <span className="font-mono text-[11px] text-white/70">{s.n}</span>
              <div className="w-full rounded-t-lg" style={{
                height: `${8 + s.v * 92 * p}%`,
                background: `linear-gradient(180deg, ${i === 2 ? CLAY : BLUE} 0%, transparent 140%)`,
                opacity: 0.85,
              }} />
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">{s.label}</span>
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((m, i) => {
          const p = easeOut(win(t, 0.5 + i * 0.09, 0.68 + i * 0.09))
          return (
            <div key={m.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3"
              style={{ opacity: p, transform: `translateY(${(1 - p) * 12}px)` }}>
              <Label>{m.label}</Label>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-[#F4EDE4]" style={{ fontFamily: 'var(--font-display)' }}>{m.value}</span>
                <span className={`font-mono text-[10px] ${m.good ? 'text-emerald-300' : 'text-rose-300'}`}>{m.delta}</span>
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
    <Panel className="flex h-full w-full gap-6 p-6">
      <div className="flex w-1/2 flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <Label>WhatsApp survey · NPS wave 4</Label>
          <Tag tone="green">Opt-in only</Tag>
        </div>
        <div className="rounded-2xl rounded-tr-sm bg-[#1F5C46] px-3 py-2 text-[11.5px] leading-snug text-white/90"
          style={{ opacity: easeOut(win(t, 0.05, 0.18)) }}>
          Quick one 🙏 On a scale of 0–10, how likely are you to recommend PocketPay to a friend?
        </div>
        {replies.map((r, i) => {
          const p = easeOut(win(t, 0.22 + i * 0.14, 0.36 + i * 0.14))
          return (
            <div key={i} className="mr-10 flex items-center gap-2 self-start rounded-2xl rounded-tl-sm bg-white/[0.07] px-3 py-2"
              style={{ opacity: p, transform: `translateX(${(1 - p) * -16}px)` }}>
              <p className="text-[11.5px] text-white/80">{r.text}</p>
              <Tag tone={r.score >= 9 ? 'green' : r.score >= 7 ? 'dim' : 'red'}>{r.score}</Tag>
            </div>
          )
        })}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <Label>Net Promoter Score</Label>
        <span className="text-6xl font-extrabold text-[#F4EDE4]" style={{ fontFamily: 'var(--font-display)' }}>+{nps}</span>
        <div className="flex gap-2" style={{ opacity: win(t, 0.7, 0.85) }}>
          <Tag tone="green">61% promoters</Tag><Tag tone="red">3% detractors</Tag>
        </div>
        <p className="max-w-[220px] text-center text-[11px] leading-relaxed text-white/45" style={{ opacity: win(t, 0.78, 0.92) }}>
          Surveys go where your customers already reply: WhatsApp, email, in-app and link.
        </p>
      </div>
    </Panel>
  )
}

// ————— Scene 5: offline attribution —————
export function OohScene({ t }: { t: number }) {
  const url = 'brandgauge.app/go/jara-lekki'
  const typed = url.slice(0, Math.floor(url.length * win(t, 0.15, 0.5)))
  const lift = Math.round(18 * easeOut(win(t, 0.6, 0.85)))
  return (
    <Panel className="flex h-full w-full gap-6 p-6">
      <div className="flex w-1/2 flex-col justify-center gap-3">
        <Label>OOH site · Lekki–Epe Expressway</Label>
        <div className="rounded-xl border border-white/[0.1] bg-gradient-to-br from-[#1A2342] to-[#10162C] p-4"
          style={{ opacity: easeOut(win(t, 0.02, 0.2)) }}>
          <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-white/15 bg-white/[0.03]">
            <span className="text-lg font-extrabold tracking-tight text-[#F4EDE4]" style={{ fontFamily: 'var(--font-display)' }}>
              JARA <span className="text-[#E06A32]">FOODS</span>
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="font-mono text-[10px] text-white/45">48-sheet billboard · 6.5195°N 3.6180°E</span>
            <Tag tone="clay">Live</Tag>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
          <span className="h-2 w-2 rounded-full bg-[#E06A32]" />
          <span className="font-mono text-[11px] text-white/75">{typed}<span className="animate-pulse text-[#E06A32]">▍</span></span>
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
                <span className="text-[11px] text-white/55">{row.label}</span>
                <span className="font-mono text-[12px] font-bold text-[#F4EDE4]">{row.value}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full" style={{ width: `${row.p * 100 * p}%`, background: row.clay ? CLAY : BLUE, opacity: row.clay ? 1 : 0.6 }} />
              </div>
            </div>
          )
        })}
        <p className="text-[11px] leading-relaxed text-white/45" style={{ opacity: win(t, 0.72, 0.88) }}>
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
    { name: 'ChatGPT',    score: 82 },
    { name: 'Gemini',     score: 74 },
    { name: 'Perplexity', score: 68 },
  ]
  return (
    <Panel className="flex h-full w-full flex-col gap-4 p-6">
      <div className="flex items-center gap-2 rounded-xl border border-[#E06A32]/30 bg-[#E06A32]/[0.06] px-4 py-3">
        <span className="text-[13px] text-[#E8926A]">✦</span>
        <span className="text-[12.5px] text-white/85">{typed}<span className="animate-pulse text-[#E06A32]">▍</span></span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {answers.map((a, i) => {
          const p = easeOut(win(t, 0.32 + i * 0.12, 0.46 + i * 0.12))
          return (
            <div key={i} className="flex items-start gap-2.5 rounded-lg bg-white/[0.03] px-3 py-2"
              style={{ opacity: p, transform: `translateY(${(1 - p) * 10}px)` }}>
              <span className="mt-0.5 font-mono text-[10px] text-[#E8926A]">{String(i + 1).padStart(2, '0')}</span>
              <p className="text-[11.5px] leading-relaxed text-white/75">{a}</p>
            </div>
          )
        })}
      </div>
      <div className="border-t border-white/[0.06] pt-3">
        <div className="mb-2 flex items-center justify-between">
          <Label>How AI answers about your brand</Label>
          <Tag tone="clay">Weekly check</Tag>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {platforms.map((pl, i) => {
            const p = easeOut(win(t, 0.68 + i * 0.08, 0.82 + i * 0.08))
            return (
              <div key={pl.name} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2" style={{ opacity: p }}>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">{pl.name}</p>
                <p className="text-lg font-extrabold text-[#F4EDE4]" style={{ fontFamily: 'var(--font-display)' }}>{Math.round(pl.score * p)}</p>
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
    { name: 'Competitor B', v: 22, color: 'rgba(255,255,255,0.25)' },
  ]
  const sweep = easeInOut(win(t, 0.08, 0.55))
  let acc = 0
  return (
    <Panel className="flex h-full w-full gap-6 p-6">
      <div className="flex w-[45%] flex-col items-center justify-center gap-3">
        <Label>Share of voice</Label>
        <svg viewBox="0 0 120 120" className="w-full max-w-[180px] -rotate-90">
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
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5"
              style={{ opacity: p, transform: `translateY(${(1 - p) * 12}px)` }}>
              <p className="text-[11.5px] leading-relaxed text-white/70">{line}</p>
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
    <div className="flex h-full w-full flex-col items-center justify-center gap-5">
      <div style={{ opacity: p1, transform: `scale(${0.92 + p1 * 0.08})` }} className="flex items-center gap-3">
        <GaugeMark className="h-10 w-10" />
        <span className="text-4xl font-extrabold tracking-tight text-[#F4EDE4]" style={{ fontFamily: 'var(--font-display)' }}>
          Brand<span className="text-[#E06A32]">Gauge</span>
        </span>
      </div>
      <p className="max-w-md text-center text-[15px] leading-relaxed text-white/55" style={{ opacity: p2 }}>
        Brand intelligence that speaks your market&apos;s language.
      </p>
      <div style={{ opacity: p2 }}>
        <span className="rounded-full bg-[#E06A32] px-5 py-2.5 text-[13px] font-bold text-white">Start free at brandgauge.app</span>
      </div>
    </div>
  )
}

// ————— logo mark —————
export function GaugeMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <path d="M 8 30 A 16 16 0 1 1 32 30" fill="none" stroke="rgba(244,237,228,0.25)" strokeWidth="4" strokeLinecap="round" />
      <path d="M 8 30 A 16 16 0 0 1 20 4" fill="none" stroke="#E06A32" strokeWidth="4" strokeLinecap="round" />
      <line x1="20" y1="24" x2="28" y2="13" stroke="#F4EDE4" strokeWidth="3" strokeLinecap="round" />
      <circle cx="20" cy="24" r="3" fill="#F4EDE4" />
    </svg>
  )
}
