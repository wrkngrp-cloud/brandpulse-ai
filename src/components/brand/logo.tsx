/**
 * The mark and the lockup, as supplied in brand/logo.
 *
 * These are the drawing, not a redraw: no path here is generated, simplified
 * or rebuilt from ratios. Duotone on Paper is the primary; the ink variants
 * are for the ink plane; mono is for anything below 24px, single-colour
 * print, embroidery, engraving, or a ground that is itself in the ramp,
 * where seven graded ticks turn into mud.
 *
 * Each supplied file carries its own full-bleed ground rect, so the Paper
 * lockup draws a Paper plate wherever it lands. The default used to be Paper
 * regardless of the mode, which put a white plate around the wordmark at the
 * top of the sign-up page, the dashboard shell and the mobile nav the moment
 * the app went dark.
 *
 * So `ground` defaults to `auto`: both files are rendered and CSS shows the
 * one that belongs. Switching in CSS rather than in JS matters — next-themes
 * writes `.dark` on the document before first paint, so the right plate is
 * there from the first frame, with no flash and nothing for hydration to
 * disagree about. Pass `paper` or `ink` explicitly for a plane that does not
 * follow the mode, like the sign-in rail or a frame in the film.
 */
import Image from 'next/image'

type Tone = 'duotone' | 'mono'
type Ground = 'paper' | 'ink'

/** The mark's own box is 305 x 200. Never squash it into a square. */
const MARK_RATIO = 305 / 200
const LOCKUP_RATIO = 1300 / 200

interface LogoProps {
  tone?: Tone
  /** `auto` follows the document mode. Name a ground to pin it. */
  ground?: Ground | 'auto'
  className?: string
}

function Art({
  kind, tone, ground, w, h, className,
}: { kind: 'mark' | 'lockup'; tone: Tone; ground: Ground; w: number; h: number; className?: string }) {
  return (
    <Image
      src={`/brand-logo/brandgauge-${kind}-${tone}-${ground}.svg`}
      alt="BrandGauge"
      width={w}
      height={h}
      className={className}
      priority
    />
  )
}

function Pair(props: { kind: 'mark' | 'lockup'; tone: Tone; w: number; h: number; className?: string }) {
  return (
    <>
      <Art {...props} ground="paper" className={`dark:hidden ${props.className ?? ''}`} />
      <Art {...props} ground="ink" className={`hidden dark:block ${props.className ?? ''}`} />
    </>
  )
}

export function BrandMark({
  size = 32, tone = 'duotone', ground = 'auto', className,
}: LogoProps & { size?: number }) {
  const box = { kind: 'mark' as const, tone, w: Math.round(size * MARK_RATIO), h: size, className }
  return ground === 'auto' ? <Pair {...box} /> : <Art {...box} ground={ground} />
}

export function BrandLockup({
  height = 24, tone = 'duotone', ground = 'auto', className,
}: LogoProps & { height?: number }) {
  const box = { kind: 'lockup' as const, tone, w: Math.round(height * LOCKUP_RATIO), h: height, className }
  return ground === 'auto' ? <Pair {...box} /> : <Art {...box} ground={ground} />
}
