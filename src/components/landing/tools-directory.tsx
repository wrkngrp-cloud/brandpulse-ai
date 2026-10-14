'use client'

import Link from 'next/link'
import { MarketingShell } from './marketing-shell'
import { Tick, TickReveal } from './reading'
import { Icon, ArrowRightIcon as ArrowRight } from '@/components/brand/icon'
import { FREE_TOOLS, toolsByCategory } from '@/lib/tools/registry'
import { useToolAnalytics } from '@/components/tools/use-tool-analytics'

/**
 * The directory. One card per tool, grouped by the problem it solves rather
 * than by how it is built, because a marketing lead arrives with a problem.
 *
 * Everything on this page comes from the registry, including the grouping, so
 * a sixth tool appears here, in the nav dropdown and in the end-of-report
 * recommendation from one edit to one file.
 */
export function ToolsDirectory() {
  const groups = toolsByCategory()
  useToolAnalytics({ event: 'free_tool_viewed', toolId: 'directory' })

  return (
    <MarketingShell>
      <TickReveal className="mx-auto max-w-5xl px-6 pb-12 pt-36 sm:pt-44">
        <Tick as="p" className="bg-label" style={{ color: 'var(--tx-flare)' }}>Free intelligence tools</Tick>
        <Tick as="div">
          <h1 className="mt-4 max-w-3xl text-4xl font-medium leading-[1.05] tracking-[-0.02em] sm:text-5xl"
            style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
            Better marketing decisions start here.
          </h1>
        </Tick>
        <Tick as="p" className="mt-5 max-w-2xl text-[15px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
          Explore free tools that help you understand your market, uncover opportunities, track
          competitors, and measure what matters. No account required to get started.
        </Tick>
      </TickReveal>

      <div className="mx-auto max-w-5xl px-6 pb-20">
        {groups.map(group => (
          <section key={group.category} className="border-t py-10" style={{ borderColor: 'var(--lp-line)' }}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[17px] font-medium tracking-tight" style={{ color: 'var(--lp-ink)' }}>
                {group.label}
              </h2>
              <p className="text-[13px]" style={{ color: 'var(--lp-mut)' }}>{group.blurb}</p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {group.tools.map(tool => (
                <Link key={tool.id} href={tool.route}
                  className="group flex flex-col justify-between rounded-sm border p-6 bg-press"
                  style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
                  <div>
                    <Icon name={tool.icon} className="h-5 w-5" style={{ color: 'var(--tx-flare)' }} />
                    <h3 className="mt-4 text-[16px] font-medium tracking-tight" style={{ color: 'var(--lp-ink)' }}>
                      {tool.name}
                    </h3>
                    <p className="mt-1.5 text-[13.5px] font-medium" style={{ color: 'var(--lp-ink)' }}>{tool.blurb}</p>
                    <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>{tool.detail}</p>
                  </div>
                  <span className="mt-6 flex items-center gap-1.5 text-[13px] font-medium" style={{ color: 'var(--tx-flare)' }}>
                    {tool.cta} <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <section className="border-t pt-10" style={{ borderColor: 'var(--lp-line)' }}>
          <div className="rounded-sm border p-7" style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
            <h2 className="text-[18px] font-medium tracking-tight" style={{ color: 'var(--lp-ink)' }}>
              All {FREE_TOOLS.length} are free, and they stay free
            </h2>
            <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
              Each one answers its question on its own, without an account and without connecting
              anything. When you want to keep working on what it found, BrandGauge picks up the same
              report: your competitor is already on a watchlist, your campaign links keep working,
              your audit becomes a plan. BrandGauge is free while we are in open beta.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/auth/signup"
                className="flex items-center gap-2 rounded-sm px-6 py-3 text-[14px] font-bold text-on-hot bg-press"
                style={{ background: 'var(--flare)' }}>
                Create your free BrandGauge account <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/features"
                className="rounded-sm border px-6 py-3 text-[14px] font-medium bg-press"
                style={{ borderColor: 'var(--lp-line)', color: 'var(--lp-ink)' }}>
                See the whole platform
              </Link>
            </div>
          </div>
        </section>
      </div>
    </MarketingShell>
  )
}
