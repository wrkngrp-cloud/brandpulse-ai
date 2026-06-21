import { notFound } from 'next/navigation'
import { PortalClient } from './portal-client'

export const dynamic = 'force-dynamic'

interface PortalData {
  brand:      { name: string; category: string | null; logo_url: string | null }
  sections:   string[]
  sentiment:  { social_score: number; day: string; positive_pct: number; negative_pct: number }[] | null
  sov:        { social_sov: number; snapshot_date: string } | null
  bhiHistory: { bhi: number; snapshot_date: string }[] | null
  asOf:       string
}

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const baseUrl = process.env.APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/portal/view?token=${encodeURIComponent(token)}`, {
    cache: 'no-store',
  })

  if (res.status === 404 || res.status === 410) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-2 max-w-sm">
          <p className="text-2xl font-bold">Link not found</p>
          <p className="text-muted-foreground text-sm">{(body.error) ?? 'This portal link is invalid or has expired.'}</p>
        </div>
      </div>
    )
  }

  if (!res.ok) notFound()

  const data: PortalData = await res.json()

  return <PortalClient data={data} />
}
