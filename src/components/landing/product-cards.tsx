import Image from 'next/image'

/**
 * The product section, as cards.
 *
 * This was a sticky horizontal track driven by vertical scroll: the page froze,
 * panels slid sideways, and each panel drew a re-creation of a dashboard screen
 * rather than the screen itself. Two problems. Scroll-jacking takes the scrollbar
 * off the reader, and a re-creation is a mockup — the very thing the eyebrow
 * above it claimed it was not.
 *
 * So: real screenshots, in a grid you can read at your own pace. Every image in
 * `public/landing/product/` is a crop of the running app, not a drawing of it.
 * The spans are uneven on purpose — a 7/5 then 5/7 alternation gives the column
 * an editorial rhythm instead of a catalogue of equal boxes.
 *
 * `object-top` on every frame: these are crops of screens, so the top edge is
 * the meaningful one and any overflow should fall off the bottom.
 */

interface Shot {
  src: string
  /** Pixel dimensions of the file, so Next can reserve the box. */
  w: number
  h: number
  alt: string
  kicker: string
  title: string
  body: string
  /** Tailwind column span at lg. */
  span: string
  /** Frame aspect ratio. Wide crops get a wide frame. */
  ratio: string
}

const SHOTS: Shot[] = [
  {
    src: '/landing/product/commercial-performance.webp',
    w: 1400, h: 458,
    alt: 'The Commercial Performance grid: revenue ₦152.0M, marketing spend ₦38.0M, CAC ₦3K, cost per lead ₦2K, 20,000 MQLs, 4.2% churn, +300% marketing ROI and 4.0X ROAS, each with its month-on-month change.',
    kicker: 'Commercial proof',
    title: 'Marketing you can defend in money',
    body: 'Revenue, spend, CAC, ROI and ROAS on one row, pulled from Meta Ads, GA4, Paystack and your site pixel. Every figure carries its change since last month, so the budget conversation starts with evidence.',
    span: 'lg:col-span-7',
    ratio: '1430 / 468',
  },
  {
    src: '/landing/product/brand-health-zones.webp',
    w: 1400, h: 495,
    alt: 'Brand Health Zones: At Risk 0 to 39, Building 40 to 64, Healthy 65 to 79 and Leading 80 to 100, with a “You are here” marker on Healthy.',
    kicker: 'Brand Health Index',
    title: 'One score, and what it means',
    body: 'Five signals weighted for your industry, landing in one of four zones. The score tells you where you are. The zone tells you what to do about it.',
    span: 'lg:col-span-5',
    ratio: '1400 / 495',
  },
  {
    src: '/landing/product/sentiment-readouts.webp',
    w: 1400, h: 550,
    alt: 'The Sentiment screen: a sentiment score of 80, trending up, and 71% positive mentions.',
    kicker: 'Cultural sentiment',
    title: 'Sentiment with street sense',
    body: 'Pidgin, Yoruba, Igbo and Hausa read the way a Lagos marketer would read them, across X and Instagram, refreshed nightly at 4 AM Lagos time.',
    span: 'lg:col-span-5',
    ratio: '972 / 382',
  },
  {
    src: '/landing/product/bhi-trend.webp',
    w: 1400, h: 380,
    alt: 'The Brand Health Index 90-day trend chart, rising from the low 70s to 80 across June, July and August.',
    kicker: 'Ninety days',
    title: 'Watch the number move',
    body: 'The index plotted daily, so a campaign, a crisis or a price change shows up as a shape you can point at in a meeting.',
    span: 'lg:col-span-7',
    ratio: '1260 / 342',
  },
  {
    src: '/landing/product/competitive-briefing.webp',
    w: 1264, h: 168,
    alt: 'An AI-written weekly competitive briefing describing PocketPay’s sentiment position, the missing share-of-voice data, and two high-risk issues needing attention.',
    kicker: 'Competitive intelligence',
    title: 'A briefing written every Monday',
    body: 'Your position, your blind spots and the two things to fix this week, written from live connector data and named competitors. Not a chart you have to interpret. A paragraph you can forward.',
    span: 'lg:col-span-12',
    ratio: '1264 / 168',
  },
]

export function ProductCards() {
  return (
    /* The raised ink band. The page runs Paper almost end to end, and five
       light screenshots on light paper disappeared into it — the mat has to be
       a different plane, not a different shade of the same one. `--lp-band` is
       the one value that holds in both modes, so this section reads the same
       whichever way the toggle is set. */
    <section
      id="tour"
      aria-label="Product"
      className="scroll-mt-24 px-6 py-28"
      style={{ background: 'var(--lp-band)' }}
    >
      <div className="mx-auto max-w-6xl">
        <p className="text-[11px]" style={{ color: 'var(--danfo)' }}>The product, not a mockup</p>
        <h2
          className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl"
          style={{ fontFamily: 'var(--font)', color: 'var(--lp-band-ink)' }}
        >
          Every screen below is the running app.
        </h2>
        <p className="mt-4 max-w-xl text-[14px] leading-relaxed" style={{ color: 'var(--tx-inv-2)' }}>
          Screenshots, taken from a live workspace. Nothing here is drawn for the website.
        </p>

        <div className="mt-12 grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
          {SHOTS.map(shot => (
            <article
              key={shot.src}
              className={`flex flex-col overflow-hidden rounded-sm border border-line-inv ${shot.span}`}
            >
              {/* The screenshot is mounted, not pasted: a capture of a paper
                  screen needs a ground that is not paper, or it reads as part of
                  the page rather than as a picture of a screen. */}
              <div className="border-b border-line-inv p-4" style={{ background: 'var(--bg-ink)' }}>
                <div
                  className="relative w-full overflow-hidden rounded-sm"
                  style={{ aspectRatio: shot.ratio, background: 'var(--bg-card)' }}
                >
                  <Image
                    src={shot.src}
                    alt={shot.alt}
                    width={shot.w}
                    height={shot.h}
                    sizes="(max-width: 1024px) 100vw, 55vw"
                    className="absolute inset-0 h-full w-full object-cover object-top"
                  />
                </div>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <p className="text-[10px]" style={{ color: 'var(--danfo)' }}>{shot.kicker}</p>
                <h3
                  className="mt-2 text-xl font-extrabold tracking-tight"
                  style={{ fontFamily: 'var(--font)', color: 'var(--lp-band-ink)' }}
                >
                  {shot.title}
                </h3>
                <p className="mt-3 max-w-[62ch] text-[13.5px] leading-relaxed" style={{ color: 'var(--tx-inv-2)' }}>
                  {shot.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
