/* BrandGauge brand primitives — v3.4
 *
 * Dependency-free React. No Tailwind, no CSS-in-JS, no icon library.
 * Everything reads from brand/tokens.css, so a token change moves the whole app.
 *
 * Rename to .jsx and delete the type annotations if the repo is not TypeScript.
 */

import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { render, sweep, crescendo as crescendoSvg, grade } from './engine.js';

/* The engine draws into a string of SVG, so it needs a resolved colour rather
   than a var(). This is --bg-ink / --tx from tokens.css, read once. */
const INK = '#16120E';

/* ---------------------------------------------------------------- Label
 * The ONLY place capitals are allowed. Disket 700, .20em tracking.
 * Never set Nohemi in caps. */
export function Label({ children, tone = 'muted', style, ...rest }:
  { children?: ReactNode; tone?: 'muted' | 'strong'; style?: CSSProperties; [k: string]: unknown }) {
  return (
    <span className="bg-label"
      style={{ color: tone === 'strong' ? 'var(--tx)' : 'var(--tx-3)', ...style }}
      {...rest}>{children}</span>
  );
}

/* --------------------------------------------------------------- Readout
 * Every number in the app. Disket 400, tabular. Currency falls through the
 * font stack to IBM Plex Mono for ₦, which Disket does not have. */
export function Readout({ value, unit, label, size = 'lg' }:
  { value: ReactNode; unit?: string; label?: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const px = { sm: '20px', md: '32px', lg: 'var(--t-readout)' }[size];
  return (
    <div>
      {label && <Label style={{ display: 'block', marginBottom: 'var(--s-2)' }}>{label}</Label>}
      <span className="bg-num" style={{ fontSize: px, letterSpacing: '-.03em', lineHeight: 1 }}>
        {value}
        {unit && <span style={{ fontSize: '.34em', color: 'var(--tx-3)', marginLeft: '.3em' }}>{unit}</span>}
      </span>
    </div>
  );
}

/* ----------------------------------------------------------------- Delta
 * Direction is carried by the glyph, never by hue. Never colour a delta to
 * mean good or bad — there is no green in this system. */
export function Delta({ value, direction }:
  { value: string | number; direction?: 'up' | 'down' }) {
  const dir = direction || (parseFloat(String(value)) < 0 ? 'down' : 'up');
  return (
    <span className="bg-num" style={{ color: 'var(--tx-2)', fontSize: 'var(--t-small)' }}>
      {dir === 'up' ? '+' : '−'}{String(value).replace(/^[-+−]/, '')}
    </span>
  );
}

/* ------------------------------------------------------------- Crescendo
 * The arc unrolled. The workhorse: meters, progress, sparklines.
 * Ticks grow in size and heat together, which is the mark's own rule. */
export function Crescendo({ value, segments = 16, height = 20, ink = INK }:
  { value: number; segments?: number; height?: number; ink?: string }) {
  const svg = crescendoSvg(Math.max(0, Math.min(1, value / 100)), 300, 30, ink, segments);
  return (
    <span style={{ display: 'block', height }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{
        __html: `<svg viewBox="0 0 300 30" width="100%" height="${height}" preserveAspectRatio="none">${svg}</svg>`
      }} />
  );
}

/* ----------------------------------------------------------------- Meter
 * Label, crescendo, value. Sentiment, share of voice, survey, funnel,
 * offline, industry weights — all of them use this. */
export function Meter({ label, value }: { label: ReactNode; value: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '112px 1fr 40px', gap: 'var(--s-3)', alignItems: 'center' }}>
      <Label>{label}</Label>
      <Crescendo value={value} />
      <span className="bg-num" style={{ fontSize: 'var(--t-small)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

/* ----------------------------------------------------------------- Gauge
 * The Brand Health Index. Seven ticks at n=7 and a reading of 60 IS the logo.
 * The needle is rotated whole — see engine.js. */
export function Gauge({ value, size = 320, ticks, ground = 'transparent', ink = INK, needleColour }:
  { value: number; size?: number; ticks?: number; ground?: string; ink?: string; needleColour?: string }) {
  const n = ticks || (size < 160 ? 7 : size < 260 ? 9 : 14);
  const svg = render({ mode: 'sweep', signals: [value], n, w: 400, h: 300, ground, ink, needleColour });
  return (
    <div style={{ width: size }} role="img" aria-label={`Brand health index, ${value} out of 100`}
      dangerouslySetInnerHTML={{ __html: svg.replace('width="400" height="300"', 'width="100%" height="auto"') }} />
  );
}

/* --------------------------------------------------------------- Pattern
 * Background texture generated from live signals. Never behind body copy. */
export function Pattern({ mode = 'field', signals = [72, 78, 64, 71, 55], seed = 'brandgauge',
                          ground = 'transparent', ink = INK, opacity = 1, style }:
  { mode?: string; signals?: number[]; seed?: string; ground?: string; ink?: string;
    opacity?: number; style?: CSSProperties }) {
  const svg = render({ mode, signals, seed, w: 1200, h: 1200, ground, ink });
  return (
    <div aria-hidden="true"
      style={{ position: 'absolute', inset: 0, opacity, pointerEvents: 'none', ...style }}
      dangerouslySetInnerHTML={{ __html: svg.replace(/width="\d+" height="\d+"/, 'width="100%" height="100%" preserveAspectRatio="xMidYMid slice"') }} />
  );
}

/* ------------------------------------------------------------ StatusPill
 * The only fully-round element in the system. */
export function StatusPill({ state = 'live', children }:
  { state?: 'live' | 'paused' | 'error'; children?: ReactNode }) {
  const tick = { live: 'var(--flare)', paused: 'var(--neu)', error: 'var(--flare)' }[state];
  const bg = state === 'error' ? 'var(--flare)' : 'var(--bg-shell)';
  const fg = state === 'error' ? 'var(--bg-paper)' : 'var(--tx-2)';
  return (
    <span className="bg-label" style={{
      display: 'inline-flex', alignItems: 'center', gap: 'var(--s-2)',
      background: bg, color: fg, padding: '4px 11px', borderRadius: 'var(--r-pill)'
    }}>
      <i style={{ width: 6, height: 11, borderRadius: 2, background: state === 'error' ? 'var(--bg-paper)' : tick }} />
      {children || state}
    </span>
  );
}

/* ------------------------------------------------------------ MentionCard
 * Pidgin, Yorùbá, Igbo and Hausa stay verbatim, unglossed and unitalicised.
 * That is a brand decision, not an oversight. Polarity is a tick, never a hue
 * pair, because ink-versus-flare survives colour blindness. */
export function MentionCard({ text, language, platform, polarity = 'neutral' }:
  { text: string; language?: string; platform?: string; polarity?: 'positive' | 'neutral' | 'negative' }) {
  const bar = { positive: 'var(--pos)', neutral: 'var(--neu)', negative: 'var(--neg)' }[polarity];
  return (
    <article style={{
      background: polarity === 'negative' ? 'var(--flare-wash)' : 'var(--bg-card)',
      padding: 'var(--s-3) var(--s-4)', borderBottom: '1px solid var(--line)'
    }}>
      <p style={{ fontSize: 'var(--t-body)', color: 'var(--tx)', margin: 0, marginBottom: 'var(--s-2)' }}>{text}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
        <span aria-label={polarity} style={{ width: 6, height: 14, borderRadius: 2, background: bar }} />
        {language && <Label>{language}</Label>}
        {platform && <Label>{platform}</Label>}
      </div>
    </article>
  );
}

/* ---------------------------------------------------------- ReadingStrip
 * Wherever a photograph appears it carries the number, the place, and the
 * source count. If a picture cannot carry a reading, it does not go out. */
export function ReadingStrip({ value, place, sources }:
  { value: ReactNode; place?: ReactNode; sources?: ReactNode }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 3,
      background: 'var(--bg-ink)', color: 'var(--tx-inv)',
      display: 'flex', alignItems: 'center', gap: 'var(--s-4)', padding: '10px 15px'
    }}>
      <span className="bg-num" style={{ fontSize: 16 }}>{value}</span>
      <Label style={{ color: 'var(--tx-inv-2)' }}>{place}</Label>
      <Label style={{ marginLeft: 'auto', color: 'var(--tx-inv-2)' }}>{sources}</Label>
    </div>
  );
}

/* ---------------------------------------------------------------- AskBar
 * The AI command layer. No chat bubbles, no avatar, no typing dots.
 * The cursor is a tick, because everything in this brand is. */
export function AskBar({ placeholder = 'Ask your data', value, onChange, onSubmit }:
  { placeholder?: string; value?: string; onChange?: (v: string) => void; onSubmit?: (v?: string) => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--s-3)',
      border: '1px solid var(--line-strong)', borderRadius: 'var(--r-control)',
      padding: '10px 13px', background: 'var(--bg-card)'
    }}>
      <Icon name="bg-ask" size={17} colour="var(--flare)" />
      <input
        value={value} onChange={e => onChange?.(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onSubmit?.(value)}
        placeholder={placeholder}
        style={{
          flex: 1, border: 0, outline: 'none', background: 'transparent',
          font: 'inherit', fontSize: 'var(--t-small)', color: 'var(--tx)'
        }} />
      <span style={{ width: 5, height: 15, borderRadius: 2, background: 'var(--flare)', animation: 'bg-blink 1.1s steps(1) infinite' }} />
      <style>{`@keyframes bg-blink{50%{opacity:0}}
        @media(prefers-reduced-motion:reduce){@keyframes bg-blink{}}`}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ Icon
 * Load brand/icons.svg once near the root of the app, then reference by id.
 * Icons are --tx or --tx-3. An icon is Flare only when it is the single hero
 * element of a card, and then it is a filled tick, not a stroke. */
export function Icon({ name, size = 20, colour = 'currentColor', title }:
  { name: string; size?: number; colour?: string; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={colour} strokeWidth="1.75" strokeLinecap="butt" strokeLinejoin="miter"
      role={title ? 'img' : 'presentation'} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <use href={`#${name}`} />
    </svg>
  );
}

export { grade, render, sweep };
