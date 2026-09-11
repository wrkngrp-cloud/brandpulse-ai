'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRightIcon as ArrowRight } from '@/components/brand/icon'
import { HERO_PHOTOS } from './photo-frame'
import { ReadingLine } from './reading'
import { ARC_ASPECT, TickArcMask, useArcReveal } from './tick-mask'

/**
 * The arc as ground, for comparison with the arc as subject.
 *
 * Same mask, same seven ticks, same growth curve. The difference is who the
 * frame belongs to. Here the arc is oversized until it runs off both edges and
 * the top, so the reader never sees it whole and it stops reading as an object
 * on the page and starts reading as the material the page is made of. The
 * photograph sits under a scrim, the type sits on top left-aligned, and the
 * hot end of the sweep is placed behind the call to action so the densest part
 * of the picture is where the eye is meant to finish.
 *
 * The cost is that the shape is no longer legible as the mark, and the picture
 * is no longer legible as a market. Both become texture. Whether that trade is
 * worth it is the thing being compared, not something to settle in a comment.
 */
export function HeroGround() {
  const street = HERO_PHOTOS.street
  const reveal = useArcReveal({ startDelayMs: 160 })
  return (
    <section className="relative isolate flex min-h-[86vh] items-end overflow-hidden" style={{ background: 'var(--bg-ink)' }}>
      {/* The arc, oversized and cropped. Width is the driver and the height
          follows the measured proportion, so the geometry cannot be stretched. */}
      <div aria-hidden className="pointer-events-none absolute left-[58%] top-[-16%] -z-10 w-[175%] -translate-x-1/2 lg:w-[152%]"
        style={{ aspectRatio: ARC_ASPECT }}>
        <TickArcMask id="hero-ground-arc" reveal={reveal} className="h-full w-full">
          <div className="relative h-full w-full">
            {street.src && (
              <Image src={street.src} alt="" fill priority sizes="130vw" className="object-cover" />
            )}
          </div>
        </TickArcMask>
        {/* Ground holds about three quarters of the surface, so the picture is
            held back to texture rather than competing with the claim. */}
        <div className="absolute inset-0" style={{ background: 'color-mix(in srgb, var(--bg-ink) 72%, transparent)' }} />
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 pb-24 pt-40">
        <p className="text-[11px]" style={{ color: 'var(--danfo)' }}>
          Brand intelligence built in Lagos, for West Africa
        </p>
        <ReadingLine
          text="See your brand the way the street sees it."
          accent="street"
          accentStyle={{ color: 'var(--danfo)' }}
          className="mt-4 max-w-3xl text-[2.5rem] font-black leading-[1.04] tracking-[-0.03em] sm:text-6xl xl:text-7xl"
          style={{ fontFamily: 'var(--font)', color: 'var(--tx-inv)' }}
        />
        <p className="mt-6 max-w-xl text-[15px] leading-relaxed sm:text-lg" style={{ color: 'var(--tx-inv-2)' }}>
          BrandGauge reads sentiment in Pidgin, Yoruba, Igbo and Hausa. It measures every
          channel, from Instagram to a billboard on the expressway. Then it turns it all
          into numbers your board will trust.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Link href="/auth/signup"
            className="flex items-center justify-center gap-2 rounded-sm px-6 py-3.5 text-[14px] font-bold text-on-hot bg-press"
            style={{ background: 'var(--flare)' }}>
            Start free in beta
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#demo" className="rounded-sm border px-6 py-3.5 text-center text-[14px] font-medium"
            style={{ borderColor: 'var(--line-inv)', color: 'var(--tx-inv)' }}>
            Watch the demo
          </a>
        </div>
      </div>
    </section>
  )
}
