/* Ambient types for brand/engine.js. Declarations only — the engine itself is
 untouched, since the link between the data and the picture is the whole idea. */
type Opts = Record<string, unknown>
type Datum = Record<string, unknown>

export const ATOM: string
export const NEEDLE: { paths: string[]; nativeBearing: number; unitRadius: number; [k: string]: unknown }
export const GEOM: Record<string, unknown>
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
