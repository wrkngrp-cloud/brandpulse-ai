import Image from 'next/image'

/**
 * The real screens, in one registry.
 *
 * Both the home page's product grid and the features page draw from this, so a
 * screenshot cannot be current in one place and stale in the other. Every file
 * under `public/landing/product/` is a crop of the running app.
 *
 * `w`/`h` are the file's own pixels so Next can reserve the box; `ratio` is the
 * crop's aspect, which the frame holds so the image never stretches.
 */
export interface ProductShot {
  src: string
  w: number
  h: number
  ratio: string
  alt: string
}

export const SHOTS = {
  commercial: {
    src: '/landing/product/commercial-performance.webp',
    w: 1400, h: 458, ratio: '1430 / 468',
    alt: 'The Commercial Performance grid: revenue ₦152.0M, marketing spend ₦38.0M, CAC ₦3K, cost per lead ₦2K, 20,000 MQLs, 4.2% churn, +300% marketing ROI and 4.0X ROAS, each with its month-on-month change.',
  },
  zones: {
    src: '/landing/product/brand-health-zones.webp',
    w: 1400, h: 495, ratio: '1400 / 495',
    alt: 'Brand Health Zones: At Risk 0 to 39, Building 40 to 64, Healthy 65 to 79 and Leading 80 to 100, with a “You are here” marker on Healthy.',
  },
  sentiment: {
    src: '/landing/product/sentiment-readouts.webp',
    w: 1400, h: 550, ratio: '972 / 382',
    alt: 'The Sentiment screen: a sentiment score of 80, trending up, and 71% positive mentions.',
  },
  trend: {
    src: '/landing/product/bhi-trend.webp',
    w: 1400, h: 380, ratio: '1260 / 342',
    alt: 'The Brand Health Index 90-day trend chart, rising from the low 70s to 80 across June, July and August.',
  },
  briefing: {
    src: '/landing/product/competitive-briefing.webp',
    w: 1264, h: 168, ratio: '1264 / 168',
    alt: 'An AI-written weekly competitive briefing describing PocketPay’s sentiment position, the missing share-of-voice data, and two high-risk issues needing attention.',
  },
} satisfies Record<string, ProductShot>

/**
 * A screenshot, mounted.
 *
 * A capture of a paper screen dropped onto a paper page reads as part of the
 * page. The ink mat and the hairline are what make it read as a picture of a
 * screen instead.
 */
export function ProductShotFrame({
  shot, sizes = '(max-width: 1024px) 100vw, 55vw', className = '',
}: {
  shot: ProductShot
  sizes?: string
  className?: string
}) {
  return (
    <div className={`p-4 ${className}`} style={{ background: 'var(--bg-ink)' }}>
      <div
        className="relative w-full overflow-hidden rounded-sm"
        style={{ aspectRatio: shot.ratio, background: 'var(--bg-card)' }}
      >
        <Image
          src={shot.src}
          alt={shot.alt}
          width={shot.w}
          height={shot.h}
          sizes={sizes}
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      </div>
    </div>
  )
}
