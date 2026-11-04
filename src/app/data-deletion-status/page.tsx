import type { Metadata } from 'next'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { BrandLockup } from '@/components/brand/logo'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Data deletion status | BrandGauge',
  robots: { index: false, follow: false },
}

/**
 * The page Meta links people to after a data deletion request. Looked up by
 * the unguessable token we gave Meta, and shows the outcome only: never the
 * person, their brand, or what was deleted.
 */
const COPY: Record<string, { title: string; body: string }> = {
  completed:     { title: 'Your data has been deleted', body: 'We removed the Facebook and Instagram connections you made in BrandGauge, the access they gave us, and everything we had pulled through them.' },
  nothing_found: { title: 'There was nothing to delete', body: 'We looked for data connected through your Facebook login and found none. Nothing further is needed.' },
  received:      { title: 'Your request is being handled', body: 'We have your request and are finishing the deletion. Check this page again shortly.' },
}

export default async function DataDeletionStatusPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams
  let status: string | null = null
  let code: string | null = null
  if (id && /^[0-9a-f]{36}$/.test(id)) {
    const db = await createServiceClient()
    const { data } = await db.from('meta_deletion_requests').select('status, deletion_id').eq('status_token', id).maybeSingle()
    status = data?.status ?? null
    code = data?.deletion_id ?? null
  }
  const copy = status ? COPY[status] ?? COPY.received : { title: 'We could not find that request', body: 'Check the link from Facebook, or write to us and we will look it up.' }

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-lg space-y-6">
        <BrandLockup height={22} />
        <div className="rounded-sm border border-line bg-card p-6 space-y-3">
          <h1 className="text-lg font-medium">{copy.title}</h1>
          <p className="text-sm text-tx-2">{copy.body}</p>
          {code && <p className="text-xs text-tx-3">Confirmation code: <span className="bg-num">{code}</span></p>}
        </div>
        <p className="text-xs text-tx-3">
          Questions about your data? Read our <Link href="/privacy-policy" className="underline underline-offset-2">privacy policy</Link>.
        </p>
      </div>
    </main>
  )
}
