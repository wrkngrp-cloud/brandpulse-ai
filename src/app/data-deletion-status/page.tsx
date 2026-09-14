import type { Metadata } from 'next'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Data Deletion Status — BrandGauge',
}

// Meta's Data Deletion Request callback returns a confirmation code plus this URL.
// The reviewer opens it to confirm the request was recorded, so it has to resolve
// for an anonymous visitor. The deletion id is the token: it is random, single
// purpose, and we surface status only, never the Meta user id behind it.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CONTACT_EMAIL = 'privacy@brandgauge.app'

type DeletionRow = {
  deletion_id:  string
  status:       string
  requested_at: string
  completed_at: string | null
}

export default async function DataDeletionStatusPage(
  { searchParams }: { searchParams: Promise<{ id?: string }> },
) {
  const { id } = await searchParams

  let row: DeletionRow | null = null

  if (id) {
    const supabase = await createServiceClient()
    const { data } = await supabase
      .from('meta_deletion_requests')
      .select('deletion_id, status, requested_at, completed_at')
      .eq('deletion_id', id)
      .maybeSingle()
    row = (data as DeletionRow | null) ?? null
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold text-sm tracking-tight">
            BrandGauge
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-medium tracking-tight">Data deletion status</h1>
          <p className="text-sm text-muted-foreground">
            Status of a request to delete data BrandGauge holds about you.
          </p>
        </div>

        {!id && (
          <div className="border rounded-[4px] p-6 space-y-3">
            <p className="text-muted-foreground leading-7">
              No request reference was supplied. If you asked a platform to delete your
              BrandGauge data, open the link that platform gave you, or email us and we
              will find the request for you.
            </p>
            <ContactLine />
          </div>
        )}

        {id && !row && (
          <div className="border rounded-[4px] p-6 space-y-3">
            <p className="text-sm font-medium">Reference not found</p>
            <p className="text-muted-foreground leading-7">
              We have no record of a deletion request with the reference{' '}
              <span className="text-foreground">{id}</span>. It may have been issued against a
              different environment, or the reference may be mistyped.
            </p>
            <ContactLine />
          </div>
        )}

        {row && (
          <div className="border rounded-[4px] p-6 space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {row.status === 'completed' ? 'Deletion complete' : 'Deletion in progress'}
              </p>
              <p className="text-muted-foreground leading-7">
                {row.status === 'completed'
                  ? 'All data associated with this account has been removed from BrandGauge.'
                  : 'We have received this request and are working through it. Deletion completes within 30 days of the request date.'}
              </p>
            </div>

            <dl className="grid gap-3 text-sm border-t pt-4">
              <Row label="Reference" value={row.deletion_id} />
              <Row label="Requested" value={new Date(row.requested_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} />
              {row.completed_at && (
                <Row label="Completed" value={new Date(row.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} />
              )}
            </dl>

            <div className="border-t pt-4">
              <ContactLine />
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Read how we handle your data in our{' '}
          <Link href="/privacy-policy" className="text-foreground underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>
      </main>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  )
}

function ContactLine() {
  return (
    <p className="text-sm text-muted-foreground">
      Questions about this request? Email{' '}
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="text-foreground underline underline-offset-4"
      >
        {CONTACT_EMAIL}
      </a>
      .
    </p>
  )
}
