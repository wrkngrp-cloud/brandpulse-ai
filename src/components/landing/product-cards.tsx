import { SHOTS, ProductShotFrame, type ProductShot } from './product-shots'

/**
 * The product section, as cards.
 *
 * This was a sticky horizontal track driven by vertical scroll: the page froze,
 * panels slid sideways, and each panel drew a re-creation of a dashboard screen
 * rather than the screen itself. Two problems. Scroll-jacking takes the
 * scrollbar off the reader, and a re-creation is a mockup — the very thing the
 * eyebrow above it claimed it was not.
 *
 * So: real screenshots, in a grid you read at your own pace. The spans are
 * uneven on purpose — 7/5 then 5/7 gives the column an editorial rhythm rather
 * than a catalogue of equal boxes.
 */
interface Card {
  shot: ProductShot
  kicker: string
  title: string
  body: string
  /** Tailwind column span at lg. */
  span: string
}

const CARDS: Card[] = [
  {
    shot: SHOTS.commercial,
    kicker: 'Commercial proof',
    title: 'Marketing you can defend in money',
    body: 'Revenue, spend, CAC, ROI and ROAS on one row, pulled from Meta Ads, GA4, Paystack and your site pixel. Every figure carries its change since last month, so the budget conversation starts with evidence.',
    span: 'lg:col-span-7',
  },
  {
    shot: SHOTS.zones,
    kicker: 'Brand Health Index',
    title: 'One score, and what it means',
    body: 'Five signals weighted for your industry, landing in one of four zones. The score tells you where you are. The zone tells you what to do about it.',
    span: 'lg:col-span-5',
  },
  {
    shot: SHOTS.sentiment,
    kicker: 'Cultural sentiment',
    title: 'Sentiment with street sense',
    body: 'Pidgin, Yoruba, Igbo and Hausa read the way a Lagos marketer would read them, across X and Instagram, refreshed nightly at 4 AM Lagos time.',
    span: 'lg:col-span-5',
  },
  {
    shot: SHOTS.trend,
    kicker: 'Ninety days',
    title: 'Watch the number move',
    body: 'The index plotted daily, so a campaign, a crisis or a price change shows up as a shape you can point at in a meeting.',
    span: 'lg:col-span-7',
  },
  {
    shot: SHOTS.briefing,
    kicker: 'Competitive intelligence',
    title: 'A briefing written every Monday',
    body: 'Your position, your blind spots and the two things to fix this week, written from live connector data and named competitors. Not a chart you have to interpret. A paragraph you can forward.',
    span: 'lg:col-span-12',
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
          Every screen here is the running app.
        </h2>
        <p className="mt-4 max-w-xl text-[14px] leading-relaxed" style={{ color: 'var(--tx-inv-2)' }}>
          Screenshots, taken from a live workspace. Nothing here is drawn for the website.
        </p>

        <div className="mt-12 grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
          {CARDS.map(card => (
            <article
              key={card.shot.src}
              className={`flex flex-col overflow-hidden rounded-sm border border-line-inv ${card.span}`}
            >
              <ProductShotFrame shot={card.shot} className="border-b border-line-inv" />
              <div className="flex flex-1 flex-col p-6">
                <p className="text-[10px]" style={{ color: 'var(--danfo)' }}>{card.kicker}</p>
                <h3
                  className="mt-2 text-xl font-extrabold tracking-tight"
                  style={{ fontFamily: 'var(--font)', color: 'var(--lp-band-ink)' }}
                >
                  {card.title}
                </h3>
                <p className="mt-3 max-w-[62ch] text-[13.5px] leading-relaxed" style={{ color: 'var(--tx-inv-2)' }}>
                  {card.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
