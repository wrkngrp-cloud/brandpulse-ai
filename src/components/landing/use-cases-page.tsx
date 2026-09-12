'use client'

import Link from 'next/link'
import { ArrowRightIcon as ArrowRight, CheckIcon as Check } from '@/components/brand/icon'
import { MarketingShell } from './marketing-shell'
import { TickReveal, Tick } from './reading'
import { INDUSTRY_PHOTOS, PhotoFrame } from './photo-frame'

/* Was a `rise` object holding a transition and nothing to transition — no
   initial, no animate — so every block on this page was inert while looking
   animated in the source. Replaced with the system's own reveal: one group per
   section, ticks lighting in sequence. */

interface Industry {
  id: string
  name: string
  /** Key into INDUSTRY_PHOTOS. Matches `brand_type`. */
  photo: string
  who: string
  jobs: { title: string; how: string }[]
  modules: string[]
}

/** Live-features-only rule: every job and module named here works in the
 *  product today. Keep this in sync with the features page. */
const INDUSTRIES: Industry[] = [
  {
    id: 'fmcg', name: 'FMCG', photo: 'fmcg',
    who: 'For brand and trade marketing teams moving fast-moving goods through distributors, open markets and modern trade.',
    jobs: [
      { title: 'Know if the street still loves the brand', how: 'Cultural sentiment reads Pidgin, Yoruba, Igbo and Hausa mentions from X and Instagram daily, next to share of voice against the brands you fight for shelf space.' },
      { title: 'Prove the billboard and the radio spot worked', how: 'Vanity links, geo attribution and AI analysis of your radio and TV media plans turn offline spend into numbers.' },
      { title: 'See what the field sees', how: 'Field officers log store visits and sightings in a phone-first app. Activations report live event ROI with ambassador-captured leads.' },
    ],
    modules: ['Brand Health Index', 'Cultural sentiment', 'Share of voice', 'OOH + geo attribution', 'Radio/TV/print import', 'Field intelligence', 'Events'],
  },
  {
    id: 'fintech', name: 'Fintech', photo: 'fintech',
    who: 'For growth and brand teams at banks, wallets and payment apps, where trust is the product.',
    jobs: [
      { title: 'Measure trust where it actually forms', how: 'Trust is not an app-store rating. It is what people write under your posts, what they tell each other in the market and at work, and what your own customers score you. BrandGauge blends social comments, street-level discourse picked up in mentions and surveys, and NPS into a trust pillar inside your Brand Health Index.' },
      { title: 'Catch a trust wobble before it spreads', how: 'A 14-hour app outage shows up as a Hausa-language negative spike the same day. Ask the AI why sentiment dipped and get an answer with the receipts.' },
      { title: 'Defend CAC and ROI to the board', how: 'Meta Ads, GA4, Paystack and your site pixel feed live CAC, ROI and funnel lift, with an AI-written business case for the budget meeting.' },
    ],
    modules: ['Trust pillar in BHI', 'Cultural sentiment', 'Surveys + NPS', 'Commercial proof', 'Competitive briefing', 'AI command layer'],
  },
  {
    id: 'venues', name: 'Venues & Restaurants', photo: 'venue',
    who: 'For operators of restaurants, lounges, cinemas and event spaces that live and die by footfall and word of mouth.',
    jobs: [
      { title: 'Turn events into measured revenue', how: 'Plan the activation, arm ambassadors with the lead-capture app, and watch the live event dashboard tally leads and ROI while the night is still on.' },
      { title: 'Hear what guests say when they are not talking to you', how: 'Social mentions classified by language and aspect show whether the kitchen, the service or the parking is what people talk about.' },
      { title: 'Know which neighbourhoods you pull from', how: 'Geo attribution ties new customers to the areas around your OOH sites and venues.' },
    ],
    modules: ['Events + ambassador PWA', 'Cultural sentiment', 'Geo attribution', 'Surveys + NPS', 'Brand Health Index'],
  },
  {
    id: 'saas', name: 'B2B SaaS', photo: 'b2b_saas',
    who: 'For marketing leads at software companies selling to Nigerian and West African businesses.',
    jobs: [
      { title: 'Tie brand work to pipeline', how: 'See MQLs from your site pixel and forms, funnel lift stage by stage, and CAC from your ad accounts, all in the same view as brand sentiment.' },
      { title: 'Feed in the metrics only you have', how: 'A first-party data API takes signups, activations or retention numbers from your own stack, and they join the funnel like any connector.' },
      { title: 'Walk into Monday knowing the category', how: 'Get share of voice and an auto-written competitive briefing covering what rivals shipped, said and got dragged for.' },
    ],
    modules: ['Funnel + MQLs', 'First-party data API', 'Competitive briefing', 'AI command layer', 'BHI SaaS preset'],
  },
  {
    id: 'marketplaces', name: 'Marketplaces', photo: 'marketplace',
    who: 'For marketplace and platform teams balancing buyer growth with seller trust.',
    jobs: [
      { title: 'See both sides of the market', how: 'See buyer NPS through email and in-app surveys on one side, and seller sentiment from social mentions on the other.' },
      { title: 'Attribute GMV to marketing', how: 'Paystack and pixel data connect campaign spend to transactions, so growth spend answers for itself.' },
      { title: 'Watch category share of voice', how: 'Track how loudly your marketplace is talked about against rivals, week by week.' },
    ],
    modules: ['Surveys + NPS', 'Commercial proof', 'Cultural sentiment', 'Share of voice', 'Site pixel'],
  },
  {
    id: 'beverage', name: 'Beverage & Alcohol', photo: 'beverage_alcohol',
    who: 'For brand teams whose product lives in venues, events and cultural moments.',
    jobs: [
      { title: 'Own the cultural moment', how: 'Track sentiment and share of voice through Detty December, match days and festival season, in the languages the celebration happens in.' },
      { title: 'Measure sponsorships and activations', how: 'Event dashboards, ambassador lead capture and field sightings show what a sponsorship actually moved.' },
      { title: 'Make OOH answer for itself', how: 'Billboards near your key venues get vanity links and geo attribution to nearby new customers.' },
    ],
    modules: ['Events + field intelligence', 'Cultural sentiment', 'OOH + geo attribution', 'Share of voice', 'Brand Health Index'],
  },
  {
    id: 'distribution', name: 'B2B Distribution', photo: 'b2b_distribution',
    who: 'For distribution businesses managing trade partners, coverage and field teams.',
    jobs: [
      { title: 'Score trade partner health', how: 'Manual and first-party metrics track partner performance next to brand signals, with the BHI weighted for distribution.' },
      { title: 'Make field reports count', how: 'Field officers log visits, stock checks and sightings from their phones. It all lands on the dashboard the same day.' },
      { title: 'Keep coverage honest', how: 'Geo data from field activity shows where you are actually present versus where the plan says you are.' },
    ],
    modules: ['Field intelligence (FSO)', 'First-party data API', 'BHI distribution preset', 'AI command layer'],
  },
  {
    id: 'agencies', name: 'Agencies', photo: 'agency',
    who: 'For marketing, media and creative agencies carrying several client brands at once, who get asked to prove the work every quarter.',
    jobs: [
      { title: 'Run a gauge per client, in one account', how: 'Every client brand gets its own index, sentiment feed, funnel and connectors. Switch between them from the topbar without logging out or starting a new account.' },
      { title: 'Walk into the review with the numbers already made', how: 'The monthly AI report writes itself from live data for each client, and the business case turns a budget ask into something a client finance lead will read.' },
      { title: 'Win the pitch on evidence', how: 'Pull share of voice and a competitive briefing for a prospect\'s category before the room, so the credentials deck arrives with the category already read.' },
      { title: 'Reconcile the media buy', how: 'Radio, TV and print plans import from the post-buy report, so planned against delivered is a number you can show the client rather than a spreadsheet you rebuild.' },
    ],
    modules: ['One Brand Health Index per client', 'Monthly AI reports', 'Competitive briefing', 'Share of voice', 'Radio/TV/print import', 'AI command layer', 'BHI agency preset'],
  },
]

export function UseCasesPage() {
  return (
    <MarketingShell>
      <TickReveal className="mx-auto max-w-6xl px-6 pb-8 pt-36 sm:pt-44">
        <Tick as="p" className="bg-label" style={{ color: 'var(--tx-flare)' }}>
          Use cases
        </Tick>
        <Tick as="div"><h1 className="mt-4 max-w-3xl text-4xl font-medium leading-[1.05] tracking-[-0.02em] sm:text-6xl"
          style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
          One gauge, tuned to your industry.
        </h1></Tick>
        <Tick as="p" className="mt-5 max-w-2xl text-[15px] leading-relaxed sm:text-lg" style={{ color: 'var(--lp-mut)' }}>
          Pick your industry once and the index, funnel signals and recommendations
          reshape around how your business works. Everything below is live in the
          product today, described the way you would actually use it.
        </Tick>
        <Tick className="mt-8 flex flex-wrap gap-2.5">
          {INDUSTRIES.map(ind => (
            <a key={ind.id} href={`#${ind.id}`}
              className="rounded-sm border px-4 py-2 text-[12px] transition-colors hover:border-[var(--lp-clay)] bg-press"
              style={{ borderColor: 'var(--lp-line)', color: 'var(--lp-ink)', background: 'var(--lp-card)' }}>
              {ind.name}
            </a>
          ))}
        </Tick>
      </TickReveal>

      <section className="mx-auto max-w-6xl space-y-16 px-6 py-14">
        {INDUSTRIES.map((ind, i) => {
          const shot = INDUSTRY_PHOTOS[ind.photo]
          /* The photograph alternates sides down the page. Same card every
             time would run as a column of identical blocks; alternating gives
             the scroll a rhythm without changing the shape of anything.
             On small screens the name of the industry leads and the picture
             follows it, which is the order you read in. */
          const photoRight = i % 2 === 1
          return (
            <TickReveal key={ind.id} className="scroll-mt-28" amount={0.2}>
              <div id={ind.id}
                className="grid grid-cols-1 gap-8 rounded-2xl border p-7 sm:p-10 lg:grid-cols-12 lg:gap-12"
                style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>

                <Tick className={`order-last lg:col-span-4 ${photoRight ? 'lg:order-last' : 'lg:order-first'}`}>
                  <PhotoFrame photo={shot} ratio="4 / 5"
                    sizes="(max-width: 1024px) 100vw, 32vw" />
                  {/* The placeholder already names the slot inside the frame;
                      a caption under it would say the word twice. */}
                  {shot.src && <p className="bg-label mt-2.5" style={{ color: 'var(--lp-mut)' }}>{shot.slot}</p>}
                </Tick>

                <div className="lg:col-span-8">
                  <Tick as="div"><h2 className="text-2xl font-medium tracking-tight sm:text-3xl"
                    style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
                    {ind.name}
                  </h2></Tick>
                  <Tick as="p" className="mt-2 max-w-2xl text-[14px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
                    {ind.who}
                  </Tick>
                  <div className="mt-8 space-y-5">
                    {ind.jobs.map(job => (
                      <Tick key={job.title} className="border-t pt-5 first:border-t-0 first:pt-0"
                        style={{ borderColor: 'var(--lp-line)' }}>
                        <h3 className="text-[15px] font-medium leading-snug" style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
                          {job.title}
                        </h3>
                        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>{job.how}</p>
                      </Tick>
                    ))}
                  </div>
                  <Tick className="mt-8 flex flex-wrap gap-2 border-t pt-6" style={{ borderColor: 'var(--lp-line)' }}>
                    {ind.modules.map(m => (
                      <span key={m} className="flex items-center gap-1.5 rounded-sm border px-3 py-1 text-[10px]"
                        style={{ borderColor: 'var(--lp-line)', color: 'var(--lp-mut)', background: 'var(--lp-chip)' }}>
                        <Check className="h-3 w-3" style={{ color: 'var(--tx-flare)' }} /> {m}
                      </span>
                    ))}
                  </Tick>
                </div>
              </div>
            </TickReveal>
          )
        })}
      </section>

      <TickReveal className="px-6 py-20 text-center">
        <Tick as="div"><h2 className="mx-auto max-w-2xl text-3xl font-medium tracking-tight sm:text-4xl"
          style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
          Your industry is already set up.
        </h2></Tick>
        <Tick as="p" className="mx-auto mt-4 max-w-xl text-[14px]" style={{ color: 'var(--lp-mut)' }}>
          Choose it during onboarding and your dashboard arrives pre-tuned.
        </Tick>
        <Tick className="mt-8">
          <Link href="/auth/signup"
            className="inline-flex items-center gap-2 rounded-sm px-7 py-3.5 text-[14px] font-bold text-on-hot border border-line bg-press"
            style={{ background: 'var(--flare)' }}>
            Start free in beta <ArrowRight className="h-4 w-4" />
          </Link>
        </Tick>
      </TickReveal>
    </MarketingShell>
  )
}
