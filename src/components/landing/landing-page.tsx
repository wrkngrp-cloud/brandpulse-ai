'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { DemoPlayer } from './demo-player'
import { ScrollStage } from './scroll-stage'
import { AiScene, CompetitiveScene, GaugeMark, OohScene } from './scenes'

const rise = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
}

function Wordmark({ className = 'text-xl' }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight text-[#F4EDE4] ${className}`} style={{ fontFamily: 'var(--font-display)' }}>
      Brand<span className="text-[#E06A32]">Gauge</span>
    </span>
  )
}

function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto mt-4 flex max-w-6xl items-center justify-between rounded-2xl border border-white/[0.07] bg-[#0B1022]/75 px-5 py-3 backdrop-blur-xl sm:mx-6 lg:mx-auto">
        <Link href="/" className="flex items-center gap-2.5">
          <GaugeMark className="h-7 w-7" />
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-7 font-mono text-[11px] uppercase tracking-[0.18em] text-white/50 md:flex">
          <a href="#tour" className="transition-colors hover:text-white">Product</a>
          <a href="#builtforhere" className="transition-colors hover:text-white">Why us</a>
          <a href="#industries" className="transition-colors hover:text-white">Industries</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-[13px] font-medium text-white/70 transition-colors hover:text-white">Sign in</Link>
          <Link href="/auth/signup"
            className="rounded-full bg-[#E06A32] px-4 py-2 text-[13px] font-bold text-white shadow-[0_0_28px_rgba(224,106,50,0.35)] transition-transform hover:scale-[1.03]">
            Start free
          </Link>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-36 sm:pt-44">
      {/* cinematic backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_-10%,rgba(43,89,255,0.16),transparent_65%)]" />
        <div className="absolute left-1/2 top-[46%] h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[#E06A32]/[0.10] blur-[140px]" />
        <div className="absolute inset-0 opacity-[0.35]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)', backgroundSize: '72px 72px', maskImage: 'radial-gradient(70% 60% at 50% 30%, black, transparent)' }} />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 text-center">
        <motion.p {...rise} className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#E8926A]">
          Brand intelligence · Lagos to Accra
        </motion.p>
        <motion.h1 {...rise} transition={{ ...rise.transition, delay: 0.08 }}
          className="mx-auto mt-5 max-w-4xl text-5xl font-black leading-[1.02] tracking-[-0.03em] text-[#F4EDE4] sm:text-7xl"
          style={{ fontFamily: 'var(--font-display)' }}>
          See your brand the way the street sees it.
        </motion.h1>
        <motion.p {...rise} transition={{ ...rise.transition, delay: 0.16 }}
          className="mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-white/55 sm:text-lg">
          BrandGauge reads sentiment in Pidgin, Yoruba, Igbo and Hausa, measures every channel
          from Instagram to a billboard on the expressway, and turns it all into numbers your
          board will trust.
        </motion.p>
        <motion.div {...rise} transition={{ ...rise.transition, delay: 0.24 }} className="mt-9 flex items-center justify-center gap-4">
          <Link href="/auth/signup"
            className="group flex items-center gap-2 rounded-full bg-[#E06A32] px-6 py-3.5 text-[14px] font-bold text-white shadow-[0_0_44px_rgba(224,106,50,0.4)] transition-transform hover:scale-[1.03]">
            Start free in beta
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a href="#demo" className="rounded-full border border-white/15 px-6 py-3.5 text-[14px] font-medium text-white/80 transition-colors hover:border-white/35 hover:text-white">
            Watch the demo
          </a>
        </motion.div>

        <motion.div id="demo" {...rise} transition={{ ...rise.transition, delay: 0.34 }} className="relative mx-auto mt-16 max-w-4xl scroll-mt-28">
          <DemoPlayer />
        </motion.div>

        <motion.div {...rise} className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
          {['Meta Ads', 'Instagram', 'X', 'GA4', 'Paystack', 'App Store', 'WhatsApp', 'Mailchimp'].map(c => <span key={c}>{c}</span>)}
        </motion.div>
      </div>
    </section>
  )
}

const DIFFS = [
  {
    n: '01', title: 'It speaks your market’s language',
    body: 'Sentiment models that understand Pidgin, Yoruba, Igbo and Hausa, tuned on how customers here actually talk about brands. Global tools guess. This one knows.',
  },
  {
    n: '02', title: 'WhatsApp is a first-class channel',
    body: 'Surveys, NPS and campaign messages over WhatsApp with consent built in. Research goes where the replies are.',
  },
  {
    n: '03', title: 'Offline media finally measured',
    body: 'Billboards, radio, TV and print get vanity links, search uplift and geo attribution. The biggest slice of your budget stops being a blind spot.',
  },
  {
    n: '04', title: 'Numbers for the boardroom',
    body: 'CAC, ROI, funnel lift and an AI-written business case, generated from live connector data. Walk into the budget meeting with proof.',
  },
  {
    n: '05', title: 'Tracks how AI talks about you',
    body: 'A weekly check on what ChatGPT, Gemini and Perplexity say when customers ask about your category. A channel your competitors ignore.',
  },
  {
    n: '06', title: 'Built for seven industries',
    body: 'FMCG, fintech, venues, B2B SaaS, marketplaces, beverages and distribution. The index, funnel and recommendations reshape for each.',
  },
]

function Differentiators() {
  return (
    <section id="builtforhere" className="relative mx-auto max-w-6xl scroll-mt-24 px-6 py-28">
      <motion.p {...rise} className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#E8926A]">Why BrandGauge</motion.p>
      <motion.h2 {...rise} className="mt-4 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight text-[#F4EDE4] sm:text-5xl"
        style={{ fontFamily: 'var(--font-display)' }}>
        Built for here. Not adapted for here.
      </motion.h2>
      <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-3">
        {DIFFS.map((d, i) => (
          <motion.div key={d.n} {...rise} transition={{ ...rise.transition, delay: i * 0.05 }}
            className="group bg-[#0B1022] p-7 transition-colors hover:bg-[#101733]">
            <span className="font-mono text-[11px] text-[#E8926A]">{d.n}</span>
            <h3 className="mt-3 text-[17px] font-bold leading-snug text-[#F4EDE4]" style={{ fontFamily: 'var(--font-display)' }}>{d.title}</h3>
            <p className="mt-2.5 text-[13px] leading-relaxed text-white/50">{d.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

function DeepDives() {
  return (
    <section className="mx-auto max-w-6xl space-y-24 px-6 py-16">
      {[
        { Comp: OohScene, kicker: 'Offline attribution', title: 'From billboard to bank alert',
          body: 'Every OOH site gets a short branded link and a search uplift study. Radio spots, TV buys and print placements load in from templates and report back like digital.' },
        { Comp: AiScene, kicker: 'AI command layer', title: 'Ask your data anything',
          body: 'Plain questions, straight answers, sourced from your own numbers. And once a week, BrandGauge asks the big AI assistants about your category and scores how you show up.' },
        { Comp: CompetitiveScene, kicker: 'Competitive intelligence', title: 'Know their moves before Monday',
          body: 'Share of voice, competitor sightings and an auto-written briefing at the start of every week. When a rival cuts prices, you hear it from us first.' },
      ].map((s, i) => (
        <motion.div key={s.kicker} {...rise}
          className={`flex flex-col gap-10 lg:items-center ${i % 2 ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
          <div className="lg:w-[38%]">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#E8926A]">{s.kicker}</p>
            <h3 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-[#F4EDE4] sm:text-3xl" style={{ fontFamily: 'var(--font-display)' }}>{s.title}</h3>
            <p className="mt-4 text-[14px] leading-relaxed text-white/50">{s.body}</p>
          </div>
          <div className="h-[360px] flex-1"><s.Comp t={1} /></div>
        </motion.div>
      ))}
    </section>
  )
}

function Industries() {
  const list = ['FMCG', 'Fintech', 'Venues & Restaurants', 'B2B SaaS', 'Marketplaces', 'Beverage & Alcohol', 'B2B Distribution']
  return (
    <section id="industries" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24 text-center">
      <motion.h2 {...rise} className="text-3xl font-extrabold tracking-tight text-[#F4EDE4] sm:text-4xl" style={{ fontFamily: 'var(--font-display)' }}>
        One gauge. Seven industries.
      </motion.h2>
      <motion.p {...rise} className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-white/50">
        Pick your industry once. The health index, funnel signals and connector
        recommendations reshape themselves around how your business actually works.
      </motion.p>
      <motion.div {...rise} className="mt-10 flex flex-wrap justify-center gap-3">
        {list.map(v => (
          <span key={v} className="rounded-full border border-white/[0.1] bg-white/[0.03] px-5 py-2.5 text-[13px] text-white/70 transition-colors hover:border-[#E06A32]/50 hover:text-white">
            {v}
          </span>
        ))}
      </motion.div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden px-6 py-32 text-center">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E06A32]/[0.13] blur-[130px]" />
      <motion.h2 {...rise} className="relative mx-auto max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.02em] text-[#F4EDE4] sm:text-6xl" style={{ fontFamily: 'var(--font-display)' }}>
        Your brand already has a reputation. Start measuring it.
      </motion.h2>
      <motion.p {...rise} className="relative mx-auto mt-6 max-w-xl text-[15px] text-white/55">
        Free while in beta. Connect a social account and see your first Brand Health Index in minutes.
      </motion.p>
      <motion.div {...rise} className="relative mt-10">
        <Link href="/auth/signup"
          className="inline-flex items-center gap-2 rounded-full bg-[#E06A32] px-8 py-4 text-[15px] font-bold text-white shadow-[0_0_60px_rgba(224,106,50,0.45)] transition-transform hover:scale-[1.04]">
          Create your workspace <ArrowRight className="h-4 w-4" />
        </Link>
      </motion.div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.06] px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2">
          <GaugeMark className="h-5 w-5" />
          <Wordmark className="text-sm" />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">
          Made for West African marketers
        </p>
        <div className="flex gap-6 text-[12px] text-white/45">
          <Link href="/privacy-policy" className="transition-colors hover:text-white">Privacy</Link>
          <a href="mailto:hello@brandgauge.app" className="transition-colors hover:text-white">Contact</a>
        </div>
      </div>
    </footer>
  )
}

export function LandingPage() {
  return (
    <main className="min-h-screen bg-[#080C1A] text-white antialiased selection:bg-[#E06A32]/40">
      <Nav />
      <Hero />
      <div id="tour" className="scroll-mt-20"><ScrollStage /></div>
      <Differentiators />
      <DeepDives />
      <Industries />
      <FinalCta />
      <Footer />
    </main>
  )
}
