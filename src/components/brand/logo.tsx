/**
 * The mark and the lockup, as supplied in brand/logo.
 *
 * These are the drawing, not a redraw: no path here is generated, simplified
 * or rebuilt from ratios. Duotone on Paper is the primary; the ink variants
 * are for the ink plane; mono is for anything below 24px, single-colour
 * print, embroidery, engraving, or a ground that is itself in the ramp,
 * where seven graded ticks turn into mud.
 */
import Image from 'next/image'

type Tone = 'duotone' | 'mono'
type Ground = 'paper' | 'ink'

/** The mark's own box is 305 x 200. Never squash it into a square. */
const MARK_RATIO = 305 / 200
const LOCKUP_RATIO = 1300 / 200

export function BrandMark({
  size = 32, tone = 'duotone', ground = 'paper', className,
}: { size?: number; tone?: Tone; ground?: Ground; className?: string }) {
  return (
    <Image
      src={`/brand-logo/brandgauge-mark-${tone}-${ground}.svg`}
      alt="BrandGauge"
      width={Math.round(size * MARK_RATIO)}
      height={size}
      className={className}
      priority
    />
  )
}

export function BrandLockup({
  height = 24, tone = 'duotone', ground = 'paper', className,
}: { height?: number; tone?: Tone; ground?: Ground; className?: string }) {
  return (
    <Image
      src={`/brand-logo/brandgauge-lockup-${tone}-${ground}.svg`}
      alt="BrandGauge"
      width={Math.round(height * LOCKUP_RATIO)}
      height={height}
      className={className}
      priority
    />
  )
}
