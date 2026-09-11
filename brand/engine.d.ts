/* Ambient types for brand/engine.js. Declarations only — the engine itself is
 untouched, since the link between the data and the picture is the whole idea. */
type Opts = Record<string, unknown>
type Datum = Record<string, unknown>

export const ATOM: string
export const NEEDLE: { paths: string[]; nativeBearing: number; unitRadius: number; [k: string]: unknown }
/* The mark's construction, as the engine declares it. Typed to its real shape
   rather than Record<string, unknown> so the arc can be rebuilt as a mask
   without casting every field at the call site. */
export const GEOM: {
  /** Pivot in the mark's own 1000-unit box. */
  pivot: [number, number]
  radius: number
  /** Start and end bearing in degrees, y-up. The mark sweeps 163.3 to 2.4. */
  sweep: [number, number]
  ticks: number
  step: number
  /** Tick scale at the cold tail and at the head. */
  growth: [number, number]
  /** Share of the chord a tick occupies. Below 1 the ticks stand apart. */
  fill: number
  markOwnReading: number
}
export const RAMP: string[]
export const PRESETS: Record<string, Opts>

export function grade(t: number, st?: string[]): string
export function needle(cx: number, cy: number, R: number, angle: number, colour?: string): string
export function sweep(s: number[], r: () => number, W: number, H: number, ink?: string, n?: number, needleColour?: string): string
export function crescendo(val: number, W: number, H: number, ink?: string, n?: number): string
export function field(s: number[], r: () => number, W: number, H: number, ink?: string): string
export function ridge(s: number[], r: () => number, W: number, H: number, ink?: string): string
export function core(s: number[], r: () => number, W: number, H: number, ink?: string): string
export function render(o?: Opts): string
export function columns(series: Datum[], W: number, H: number, ink?: string, o?: Opts): string
export function trend(values: number[], W: number, H: number, ink?: string, o?: Opts): string
export function stack(parts: Datum[], W: number, H: number, ink?: string): string
export function funnelChart(stages: Datum[], W: number, H: number, ink?: string): string
export function dots(points: Datum[], r: () => number, W: number, H: number, ink?: string, o?: Opts): string
export function chart(body: string, o?: Opts): string
export function bloom(value: number, W: number, H: number, o?: Opts): string
export function heatLine(series: Datum[], o?: Opts): string
export function heatBars(series: Datum[], o?: Opts): string
export function asset(p: string, o?: Opts): string
