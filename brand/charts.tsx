/* BrandGauge charts — v3.6
 *
 * TWO TIERS. Read this before picking a component.
 *
 * TIER 1 — INSTRUMENT (the default, and what almost everything should use).
 *   HeatLine, HeatBars. Conventional shapes people already know how to read:
 *   a line with an area fill, axes, horizontal gridlines, value labels.
 *   The brand lives in the COLOUR ENCODING, not in a novel geometry —
 *   heat = value, vertically, exactly as it does on the gauge. A line that
 *   climbs literally heats up. The atom appears only as the point marker,
 *   which is where a fingerprint costs the reader nothing.
 *
 * TIER 2 — EXPRESSIVE (the atom-native forms).
 *   ColumnChart, TrendChart, FunnelChart, DistributionChart, RingChart.
 *   Beautiful, unmistakable, and slower to read. They belong where the
 *   picture IS the message: the gauge, report covers, social, OOH, empty
 *   states, a single hero panel.
 *
 * THE RULE: if the reader has to extract a number or compare quantities to
 * make a decision, Tier 1. If the reader has to feel a state, Tier 2. Never
 * put a Tier 2 chart in a dashboard panel alongside more than one other chart.
 *
 * Each chart ships with its loading and empty state. A chart that only has a
 * success state is half a component.
 */

import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type Datum = { label?: string; value?: number; own?: boolean; muted?: boolean; [k: string]: unknown };
type Guarded = { height?: number; loading?: boolean; emptyMessage?: string; emptyAction?: ReactNode; label?: string; [k: string]: unknown };
import { heatLine, heatBars, columns, trend, stack, funnelChart, dots, chart, crescendo, core, grade } from './engine.js';

const INK_LIGHT = '#16120E';
const INK_DARK = '#FAF6EF';

function useInk() {
  const [ink, setInk] = useState(INK_LIGHT);
  useEffect(() => {
    const dark = document.documentElement.dataset.mode === 'dark';
    setInk(dark ? INK_DARK : INK_LIGHT);
  }, []);
  return ink;
}

/* Reveal once on entry. IntersectionObserver only — never a scroll listener. */
function useReveal() {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { el.classList.add('is-in'); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add('is-in'); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function Frame({ svg, height = 300, label, children }:
  { svg: string; height?: number; label?: string; children?: ReactNode }) {
  const ref = useReveal();
  return (
    <figure ref={ref} className="bg-reveal" style={{ margin: 0 }} role="group" aria-label={label}>
      <div style={{ minHeight: height }} dangerouslySetInnerHTML={{ __html: svg }} />
      {children}
    </figure>
  );
}

/* Skeleton shaped like the chart that is coming, so the layout never jumps. */
export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="bg-skeleton-block" style={{ height, borderRadius: 'var(--r-card)' }}
      role="status" aria-label="Loading" />
  );
}

/* Empty states name the next action. They never just say "no data". */
export function ChartEmpty({ height = 300, message, action }:
  { height?: number; message?: ReactNode; action?: ReactNode }) {
  return (
    <div className="bg-dawn" style={{
      height, display: 'grid', placeItems: 'center', textAlign: 'center',
      border: '1px solid var(--line)', borderRadius: 'var(--r-card)', padding: 'var(--s-5)'
    }}>
      <div>
        <p style={{ fontSize: 'var(--t-small)', color: 'var(--tx-2)', marginBottom: 'var(--s-3)' }}>{message}</p>
        {action}
      </div>
    </div>
  );
}

function guard(data: unknown[] | undefined, props: Guarded) {
  if (props.loading) return <ChartSkeleton height={props.height} />;
  if (!data || data.length === 0)
    return <ChartEmpty height={props.height} message={props.emptyMessage || 'Connect a source to see this reading.'} action={props.emptyAction} />;
  return null;
}


/* ============================== TIER 1 — INSTRUMENT (use these by default) */

/* --------------------------------------------------------------- HeatLine
 * The signature product chart, and the right answer for almost every trend.
 * Familiar shape, brand-locked encoding: the stroke and fill run cool at the
 * bottom of the value domain and Flare at the top, so a climbing line heats up.
 * Pass `compare` for a neutral dashed second series — comparison series never
 * get heat, which is what stops the chart turning into a rainbow. */
export function HeatLine({ data = [], compare = null, height = 340, width = 720,
                           label, unit = '', min, max, ...p }:
  Guarded & { data?: Datum[]; compare?: Datum[] | null; width?: number; unit?: string;
              min?: number; max?: number }) {
  const ink = useInk();
  const stop = guard(data, { height, ...p });
  if (stop) return stop;
  const svg = heatLine(data, { W: width, H: height, ink, label, unit, min, max, compare });
  return <Frame svg={svg} height={height} label={label || 'Trend over time'} />;
}

/* --------------------------------------------------------------- HeatBars
 * The legible bar. Same encoding: fill heats with height. Set `muted: true`
 * on any bar that is context rather than the subject, so the reader's eye
 * lands on yours without needing a legend. */
export function HeatBars({ data = [], height = 320, width = 720, unit = '', max, ...p }:
  Guarded & { data?: Datum[]; width?: number; unit?: string; max?: number }) {
  const ink = useInk();
  const stop = guard(data, { height, ...p });
  if (stop) return stop;
  const svg = heatBars(data, { W: width, H: height, ink, unit, max });
  return <Frame svg={svg} height={height} label={p.label || 'Comparison'} />;
}

/* ================================ TIER 2 — EXPRESSIVE (the atom-native set) */

/* ---------------------------------------------------------------- Columns
 * Comparison across a handful of named things. Each column is a stack of
 * atoms, so the reader can count it rather than estimate it. */
export function ColumnChart({ data = [], height = 300, width = 620, ...p }:
  Guarded & { data?: Datum[]; width?: number }) {
  const ink = useInk();
  const stop = guard(data, { height, ...p });
  if (stop) return stop;
  const svg = chart(columns(data, width, height - 26, ink), {
    W: width, H: height, labels: data.map(d => d.label)
  });
  return <Frame svg={svg} height={height} label={p.label || 'Column chart'} />;
}

/* ------------------------------------------------------------------ Trend
 * A line without a line. Atoms grow in size and heat toward the newest
 * reading, so recency is legible without a legend. */
export function TrendChart({ values = [], labels = [], height = 300, width = 620, ...p }:
  Guarded & { values?: number[]; labels?: string[]; width?: number }) {
  const ink = useInk();
  const stop = guard(values, { height, ...p });
  if (stop) return stop;
  const svg = chart(trend(values, width, height - 26, ink), { W: width, H: height, labels });
  return <Frame svg={svg} height={height} label={p.label || 'Trend over time'} />;
}

/* ------------------------------------------------------------------ Share
 * Share of voice. Your slice is graded; everyone else is ink stepping down
 * in opacity, so the competitive set reads without four extra colours. */
export function ShareChart({ parts = [], height = 110, width = 620, ...p }:
  Guarded & { parts?: Datum[]; width?: number }) {
  const ink = useInk();
  const stop = guard(parts, { height, ...p });
  if (stop) return stop;
  const svg = chart(stack(parts, width, height - 20, ink), { W: width, H: height });
  return (
    <Frame svg={svg} height={height} label={p.label || 'Share of voice'}>
      <figcaption style={{ display: 'flex', gap: 'var(--s-4)', marginTop: 'var(--s-2)' }}>
        {parts.map((s, i) => (
          <span key={i} className="bg-label" style={{ color: s.own ? 'var(--tx-flare)' : 'var(--tx-3)' }}>
            {s.label} {s.value}%
          </span>
        ))}
      </figcaption>
    </Frame>
  );
}

/* ----------------------------------------------------------------- Funnel
 * Stages as rows of atoms. The drop-off is countable, which is the point.
 * Never a tapering gradient block. */
export function FunnelChart({ stages = [], height = 300, width = 620, ...p }:
  Guarded & { stages?: Datum[]; width?: number }) {
  const ink = useInk();
  const stop = guard(stages, { height, ...p });
  if (stop) return stop;
  const svg = chart(funnelChart(stages, width, height - 26, ink), { W: width, H: height });
  return (
    <Frame svg={svg} height={height} label={p.label || 'Conversion funnel'}>
      <figcaption style={{ display: 'grid', gap: 'var(--s-1)', marginTop: 'var(--s-2)' }}>
        {stages.map((s, i) => (
          <span key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="bg-label">{s.label}</span>
            <span className="bg-num" style={{ fontSize: 'var(--t-small)' }}>{s.value}</span>
          </span>
        ))}
      </figcaption>
    </Frame>
  );
}

/* ----------------------------------------------------------- Distribution
 * One atom per observation. Survey spreads, mention scatter, anywhere the
 * shape of the spread matters more than the average. */
export function DistributionChart({ points = [], height = 300, width = 620, seed = 'bg', ...p }:
  Guarded & { points?: Datum[]; width?: number; seed?: string }) {
  const ink = useInk();
  const stop = guard(points, { height, ...p });
  if (stop) return stop;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const r = () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const svg = chart(dots(points, r, width, height - 26, ink), { W: width, H: height });
  return <Frame svg={svg} height={height} label={p.label || 'Distribution'} />;
}

/* ------------------------------------------------------------------- Ring
 * Part-to-whole for a small set. Concentric, one ring per signal family. */
export function RingChart({ signals = [], size = 260, ...p }:
  Guarded & { signals?: number[]; size?: number }) {
  const ink = useInk();
  const stop = guard(signals, { height: size, ...p });
  if (stop) return stop;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" role="img">${core(signals, () => 0, 400, 400, ink)}</svg>`;
  return <div style={{ width: size }}>{<Frame svg={svg} height={size} label={p.label || 'Signal rings'} />}</div>;
}

/* --------------------------------------------------------------- Sparkline
 * Inline, table-sized. The only chart allowed inside a row of text. */
export function Sparkline({ value, width = 90, height = 16 }:
  { value: number; width?: number; height?: number }) {
  const ink = useInk();
  const svg = `<svg viewBox="0 0 300 30" width="${width}" height="${height}" preserveAspectRatio="none">${crescendo(value / 100, 300, 30, ink, 12)}</svg>`;
  return <span aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle' }}
    dangerouslySetInnerHTML={{ __html: svg }} />;
}

export { grade };
