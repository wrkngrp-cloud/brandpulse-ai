'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { MarketingShell } from './marketing-shell'
import { FunnelScene, GaugeScene, OohScene, SentimentScene } from './scenes'

const rise = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
}

interface Feature {
  n: string
  title: string
  body: string
  chips: string[]
  Scene?: (p: { t: number }) => React.ReactNode
}

/** Everything on this page is live in the product today. When something ships
 *  behind a credential or is still in testing, it does not belong here yet. */
const FEATURES: Feature[] = [
  {
    n: '01', title: 'Brand Health Index',
    body: 'Five signal families blend into one score your CEO can ask about, weighted for your industry. A fintech counts trust. An FMCG counts shelf and share of voice. Signals you have not connected yet redistribute their weight instead of dragging the score down.',
    chips: ['Industry-weighted score', 'Six-stage funnel', 'Trust pillar', '30-day trend'],
    Scene: GaugeScene,
  },
  {
    n: '02', title: 'Cultural sentiment',
    body: 'BrandGauge reads mentions from X and Instagram in Pidgin, Yoruba, Igbo and Hausa. It classifies them the way a Lagos marketer would. "This brand no try" is negative. Every mention carries its language, platform and aspect, so you see what people praise and what they drag.',
    chips: ['4 languages', 'X + Instagram mentions', 'Aspect tags', 'Per-platform breakdown'],
    Scene: SentimentScene,
  },
  {
    n: '03', title: 'Commercial proof',
    body: 'CAC, ROI, MQLs and funnel lift pulled live from Meta Ads, GA4, Paystack and your site pixel. Budget pacing flags overspend before month end. An AI-written business case turns the numbers into something you can hand to the board.',
    chips: ['CAC / ROI / MQLs', 'Budget pacing', 'AI business case', 'Board pack'],
    Scene: FunnelScene,
  },
  {
    n: '04', title: 'Offline and OOH attribution',
    body: 'Every billboard, radio spot, TV flight and print placement gets a branded vanity link and a place on the map. Geo attribution ties nearby new customers back to the site. Your media plans import straight from Excel, with AI analysis of daypart efficiency and delivery.',
    chips: ['Site map + geo attribution', 'Vanity links', 'Geo-retargeting audiences', 'Radio / TV / print import'],
    Scene: OohScene,
  },
  {
    n: '05', title: 'Surveys and NPS',
    body: 'Ask your customers directly, by email, in-app or a shareable link. Replies score live as they land. NPS waves track movement over time. Consent is built in from the first question.',
    chips: ['Email · in-app · link', 'Live NPS scoring', 'Opt-in, NDPR-aware'],
  },
  {
    n: '06', title: 'Competitive intelligence',
    body: 'See share of voice against your named competitors, competitor sightings from the field, and an auto-written briefing every Monday morning. When a rival cuts prices, you hear it from us first.',
    chips: ['Share of voice', 'Monday briefing', 'Competitor sightings'],
  },
  {
    n: '07', title: 'Events and field intelligence',
    body: 'Plan an activation, hand your ambassadors a phone-first app that captures leads even offline, and watch the event dashboard move live. Field officers log store visits and sightings, so the street reports into the same place as your ads.',
    chips: ['Ambassador PWA', 'Live event ROI', 'Field team reports'],
  },
  {
    n: '08', title: 'Creative intelligence',
    body: 'A library holds every asset you run. Fatigue alerts fire before an ad wears out. A brand voice builder checks new content against how your brand actually speaks, before it goes out.',
    chips: ['Creative library', 'Fatigue alerts', 'Voice builder', 'Pre-post check'],
  },
  {
    n: '09', title: 'AI command layer',
    body: 'Ask a plain question, get a straight answer sourced from your own numbers. Monthly reports write themselves. A weekly check tracks how AI assistants describe your brand when customers ask about your category.',
    chips: ['Ask anything', 'Monthly AI reports', 'AI visibility check'],
  },
  {
    n: '10', title: 'Connectors and data',
    body: 'Meta Ads, Instagram, X, GA4, Paystack, Mailchimp and your own site pixel feed the dashboard daily. A first-party data API takes anything else you measure. Every token is encrypted at rest.',
    chips: ['7 live connectors', 'Site pixel + SDK', 'First-party API', 'Encrypted tokens'],
  },
]

export function FeaturesPage() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-6xl px-6 pb-10 pt-36 sm:pt-44">
        <motion.p {...rise} className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: 'var(--lp-clay)' }}>
          Features
        </motion.p>
        <motion.h1 {...rise} className="mt-4 max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.02em] sm:text-6xl"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--lp-ink)' }}>
          Every module, working today.
        </motion.h1>
        <motion.p {...rise} className="mt-5 max-w-2xl text-[15px] leading-relaxed sm:text-lg" style={{ color: 'var(--lp-mut)' }}>
          This page only lists what is live in the product right now. No roadmap
          slides, no coming-soon labels. If it is written here, you can use it the
          day you sign up.
        </motion.p>
      </section>

      <section className="mx-auto max-w-6xl space-y-20 px-6 py-14">
        {FEATURES.map((f, i) => (
          <motion.div key={f.n} {...rise}
            className={`flex flex-col gap-8 lg:items-center ${f.Scene ? (i % 2 ? 'lg:flex-row-reverse' : 'lg:flex-row') : ''}`}>
            <div className={f.Scene ? 'lg:w-[38%]' : 'max-w-2xl'}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--lp-clay)' }}>{f.n}</span>
              <h2 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--lp-ink)' }}>
                {f.title}
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>{f.body}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {f.chips.map(c => (
                  <span key={c} className="rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em]"
                    style={{ borderColor: 'var(--lp-line)', color: 'var(--lp-mut)', background: 'var(--lp-chip)' }}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
            {f.Scene && (
              <div className="@container h-[430px] flex-1 sm:h-[360px]">
                <f.Scene t={1} />
              </div>
            )}
          </motion.div>
        ))}
      </section>

      <section className="px-6 py-20 text-center">
        <motion.h2 {...rise} className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--lp-ink)' }}>
          See it with your own data.
        </motion.h2>
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
