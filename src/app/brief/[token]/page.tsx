import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { BrandLockup } from '@/components/brand/logo'
import { BriefView } from '@/components/brief/brief-view'
import type { BriefContent } from '@/lib/brief/build'

export const dynamic = 'force-dynamic'

// A forwarded brief is for the person it was sent to, not for search engines.
export const metadata: Metadata = {
  title: 'Monday Brief | BrandGauge',
  robots: { index: false, follow: false },
}

/**
 * A brief forwarded by link, with no login. Public token-gated read, the same
 * pattern as the survey and portal pages: the service role reads one row by
 * its unguessable token, and nothing else. Only a ready brief is shown.
 */
export default async function SharedBriefPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[0-9a-f]{64}$/.test(token)) notFound()

  const svc = await createServiceClient()
  const { data: brief } = await svc
    .from('weekly_briefs')
    .select('status, content, brands(name)')
    .eq('share_token', token)
    .maybeSingle()
  if (!brief || brief.status !== 'ready') notFound()

  const brandName = (brief.brands as { name?: string } | null)?.name ?? undefined
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <BrandLockup height={22} />
        <div className="rounded-sm border border-line bg-card p-5 sm:p-6">
          <BriefView content={brief.content as BriefContent} brandName={brandName} publicView />
        </div>
        <p className="text-xs text-tx-3">
          Written by BrandGauge from {brandName ?? 'the brand'}&rsquo;s own numbers, campaigns and the public press.{' '}
          <Link href="/" className="underline underline-offset-2">What is BrandGauge?</Link>
        </p>
      </div>
    </main>
  )
}
