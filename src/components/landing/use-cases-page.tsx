'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Check } from 'lucide-react'
import { MarketingShell } from './marketing-shell'

const rise = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
}

interface Industry {
  id: string
  name: string
  who: string
  jobs: { title: string; how: string }[]
  modules: string[]
}

/** Live-features-only rule: every job and module named here works in the
 *  product today. Keep this in sync with the features page. */
const INDUSTRIES: Industry[] = [
  {
    id: 'fmcg', name: 'FMCG',
    who: 'For brand and trade marketing teams moving fast-moving goods through distributors, open markets and modern trade.',
    jobs: [
      { title: 'Know if the street still loves the brand', how: 'Cultural sentiment reads Pidgin, Yoruba, Igbo and Hausa mentions from X and Instagram daily, next to share of voice against the brands you fight for shelf space.' },
      { title: 'Prove the billboard and the radio spot worked', how: 'Vanity links, geo attribution and AI analysis of your radio and TV media plans turn offline spend into numbers.' },
      { title: 'See what the field sees', how: 'Field officers log store visits and sightings in a phone-first app; activations report live event ROI with ambassador-captured leads.' },
    ],
    modules: ['Brand Health Index', 'Cultural sentiment', 'Share of voice', 'OOH + geo attribution', 'Radio/TV/print import', 'Field intelligence', 'Events'],
  },
  {
    id: 'fintech', name: 'Fintech',
    who: 'For growth and brand teams at banks, wallets and payment apps, where trust is the product.',
    jobs: [
      { title: 'Measure trust where it actually forms', how: 'Trust is not an app-store rating. It is what people write under your posts, what they tell each other in the market and at work, and what your own customers score you. BrandGauge blends social comments, street-level discourse picked up in mentions and surveys, and NPS into a trust pillar inside your Brand Health Index.' },
      { title: 'Catch a trust wobble before it spreads', how: 'A 14-hour USSD outage shows up as a Hausa-language negative spike the same day. Ask the AI why sentiment dipped and get an answer with the receipts.' },
      { title: 'Defend CAC and ROI to the board', how: 'Meta Ads, GA4, Paystack and your site pixel feed live CAC, ROI and funnel lift, with an AI-written business case for the budget meeting.' },
    ],
    modules: ['Trust pillar in BHI', 'Cultural sentiment', 'Surveys + NPS', 'Commercial proof', 'Competitive briefing', 'AI command layer'],
  },
  {
    id: 'venues', name: 'Venues & Restaurants',
    who: 'For operators of restaurants, lounges, cinemas and event spaces that live and die by footfall and word of mouth.',
    jobs: [
      { title: 'Turn events into measured revenue', how: 'Plan the activation, arm ambassadors with the lead-capture app, and watch the live event dashboard tally leads and ROI while the night is still on.' },
      { title: 'Hear what guests say when they are not talking to you', how: 'Social mentions classified by language and aspect show whether the kitchen, the service or the parking is what people talk about.' },
      { title: 'Know which neighbourhoods you pull from', how: 'Geo attribution ties new customers to the areas around your OOH sites and venues.' },
    ],
    modules: ['Events + ambassador PWA', 'Cultural sentiment', 'Geo attribution', 'Surveys + NPS', 'Brand Health Index'],
  },
  {
    id: 'saas', name: 'B2B SaaS',
    who: 'For marketing leads at software companies selling to Nigerian and West African businesses.',
    jobs: [
      { title: 'Tie brand work to pipeline', how: 'MQLs from your site pixel and forms, funnel lift stage by stage, and CAC from your ad accounts, in the same view as brand sentiment.' },
      { title: 'Feed in the metrics only you have', how: 'A first-party data API takes signups, activations or retention numbers from your own stack, and they join the funnel like any connector.' },
      { title: 'Walk into Monday knowing the category', how: 'Share of voice and an auto-written competitive briefing covering what rivals shipped, said and got dragged for.' },
    ],
    modules: ['Funnel + MQLs', 'First-party data API', 'Competitive briefing', 'AI command layer', 'BHI SaaS preset'],
  },
  {
    id: 'marketplaces', name: 'Marketplaces',
    who: 'For marketplace and platform teams balancing buyer growth with seller trust.',
    jobs: [
      { title: 'See both sides of the market', how: 'Buyer NPS through email and in-app surveys on one side; seller sentiment from social mentions on the other.' },
      { title: 'Attribute GMV to marketing', how: 'Paystack and pixel data connect campaign spend to transactions, so growth spend answers for itself.' },
      { title: 'Watch category share of voice', how: 'Track how loudly your marketplace is talked about against rivals, week by week.' },
    ],
    modules: ['Surveys + NPS', 'Commercial proof', 'Cultural sentiment', 'Share of voice', 'Site pixel'],
  },
  {
    id: 'beverage', name: 'Beverage & Alcohol',
    who: 'For brand teams whose product lives in venues, events and cultural moments.',
    jobs: [
      { title: 'Own the cultural moment', how: 'Sentiment and share of voice tracked through Detty December, match days and festival season, in the languages the celebration happens in.' },
      { title: 'Measure sponsorships and activations', how: 'Event dashboards, ambassador lead capture and field sightings show what a sponsorship actually moved.' },
      { title: 'Make OOH answer for itself', how: 'Billboards near your key venues get vanity links and geo attribution to nearby new customers.' },
    ],
    modules: ['Events + field intelligence', 'Cultural sentiment', 'OOH + geo attribution', 'Share of voice', 'Brand Health Index'],
  },
  {
    id: 'distribution', name: 'B2B Distribution',
    who: 'For distribution businesses managing trade partners, coverage and field teams.',
    jobs: [
      { title: 'Score trade partner health', how: 'Manual and first-party metrics track partner performance next to brand signals, with the BHI weighted for distribution.' },
      { title: 'Make field reports count', how: 'Field officers log visits, stock checks and sightings from their phones; it all lands on the dashboard the same day.' },
      { title: 'Keep coverage honest', how: 'Geo data from field activity shows where you are actually present versus where the plan says you are.' },
    ],
    modules: ['Field intelligence (FSO)', 'First-party data API', 'BHI distribution preset', 'AI command layer'],
  },
]

export function UseCasesPage() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-6xl px-6 pb-8 pt-36 sm:pt-44">
        <motion.p {...rise} className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: 'var(--lp-clay)' }}>
          Use cases
        </motion.p>
        <motion.h1 {...rise} className="mt-4 max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.02em] sm:text-6xl"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--lp-ink)' }}>
          One gauge, tuned to your industry.
        </motion.h1>
        <motion.p {...rise} className="mt-5 max-w-2xl text-[15px] leading-relaxed sm:text-lg" style={{ color: 'var(--lp-mut)' }}>
          Pick your industry once and the index, funnel signals and recommendations
          reshape around how your business works. Everything below is live in the
          product today, described the way you would actually use it.
        </motion.p>
        <motion.div {...rise} className="mt-8 flex flex-wrap gap-2.5">
          {INDUSTRIES.map(ind => (
            <a key={ind.id} href={`#${ind.id}`}
              className="rounded-full border px-4 py-2 text-[12px] transition-colors hover:border-[var(--lp-clay)]"
              style={{ borderColor: 'var(--lp-line)', color: 'var(--lp-ink)', background: 'var(--lp-card)' }}>
              {ind.name}
            </a>
          ))}
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl space-y-16 px-6 py-14">
        {INDUSTRIES.map(ind => (
          <motion.div key={ind.id} id={ind.id} {...rise}
            className="scroll-mt-28 rounded-2xl border p-7 sm:p-10"
            style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)', boxShadow: '0 1px 2px rgba(20,24,43,0.04)' }}>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--lp-ink)' }}>
              {ind.name}
            </h2>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>{ind.who}</p>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {ind.jobs.map(job => (
                <div key={job.title}>
                  <h3 className="text-[15px] font-bold leading-snug" style={{ fontFamily: 'var(--font-display)', color: 'var(--lp-ink)' }}>
                    {job.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>{job.how}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-2 border-t pt-6" style={{ borderColor: 'var(--lp-line)' }}>
              {ind.modules.map(m => (
                <span key={m} className="flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em]"
                  style={{ borderColor: 'var(--lp-line)', color: 'var(--lp-mut)', background: 'var(--lp-chip)' }}>
                  <Check className="h-3 w-3" style={{ color: 'var(--lp-clay)' }} /> {m}
                </span>
              ))}
            </div>
          </motion.div>
        ))}
      </section>

      <section className="px-6 py-20 text-center">
        <motion.h2 {...rise} className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--lp-ink)' }}>
          Your industry is already set up.
        </motion.h2>
        <motion.p {...rise} className="mx-auto mt-4 max-w-xl text-[14px]" style={{ color: 'var(--lp-mut)' }}>
          Choose it during onboarding and your dashboard arrives pre-tuned.
        </motion.p>
        <motion.div {...rise} className="mt-8">
          <Link href="/auth/signup"
            className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[14px] font-bold text-white shadow-[0_14px_44px_rgba(212,96,42,0.4)] transition-transform hover:scale-[1.03]"
            style={{ background: 'var(--lp-clay)' }}>
            Start free in beta <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </section>
    </MarketingShell>
  )
}
