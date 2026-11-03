'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Working as Loader2 } from '@/components/brand/working'
import { cn } from '@/lib/utils'

export interface SharedAccessState {
  status:     'pending' | 'active' | 'rejected'
  externalId: string
  name:       string | null
}

const COPY = {
  ga4: {
    title: 'Or share access, like you would with an agency',
    lead:  'No Google login needed. You add us to your GA4 property and keep full control.',
    steps: (who: string) => [
      'In GA4, open Admin, then Property access management.',
      `Add ${who} with the Viewer role. Viewer can read reports and cannot change anything.`,
      'Copy your property ID from Admin, Property details, and paste it below.',
    ],
    who:   'BrandGauge',
    label: 'GA4 property ID',
    placeholder: 'e.g. 312345678',
  },
  meta: {
    title: 'Or share access, like you would with an agency',
    lead:  'No Facebook login needed. You add BrandGauge as a partner in Business Manager and keep full control.',
    steps: (who: string) => [
      'In Meta Business Settings, open Partners and choose Add, then Give a partner access to your assets.',
      `Enter our Business ID, ${who}.`,
      'Share your ad account with View performance only. That lets us read results and nothing else.',
      'Paste your ad account ID below. It is the number at the top of Ads Manager.',
    ],
    who:   'BrandGauge',
    label: 'Ad account ID',
    placeholder: 'e.g. 1234567890',
  },
} as const

const STATUS: Record<SharedAccessState['status'], { label: string; line: string; cls: string }> = {
  pending:  { label: 'Waiting for our check', line: 'We confirm every shared account with your team before reading it, usually within one working day. Nothing syncs until then.', cls: 'text-tx-2' },
  active:   { label: 'Connected',            line: 'Syncing daily. You can remove our access in your own settings at any time.', cls: 'text-pos' },
  rejected: { label: 'Not confirmed',        line: 'We could not confirm this account belongs to your brand. Message us from the help button and we will sort it out.', cls: 'text-tx-2' },
}

export function SharedAccessCard({ platform, shareWith, current }: {
  platform:  'ga4' | 'meta'
  /** The email (GA4) or Business ID (Meta) the brand adds. Null when we have not set it up. */
  shareWith: string | null
  current:   SharedAccessState | null
}) {
  const copy = COPY[platform]
  const router = useRouter()
  const [id, setId] = useState('')
  const [pending, start] = useTransition()

  if (!shareWith) return null

  function submit() {
    start(async () => {
      const res = await fetch('/api/connectors/shared-access', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, id }),
      })
      const body = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) { toast.error(body.error ?? 'That did not go through. Try again.'); return }
      toast.success('Got it. We will confirm with your team and switch it on.')
      setId('')
      router.refresh()
    })
  }

  function withdraw() {
    start(async () => {
      const res = await fetch(`/api/connectors/shared-access?platform=${platform}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('That did not go through. Try again.'); return }
      toast.success('Removed. Remember to remove our access on your side too.')
      router.refresh()
    })
  }

  return (
    <div className="rounded-sm border border-line bg-card p-4 space-y-3" data-tour={`shared-access-${platform}`}>
      <div className="space-y-1">
        <p className="text-sm font-medium">{copy.title}</p>
        <p className="text-xs text-tx-2">{copy.lead}</p>
      </div>

      {current ? (
        <div className="space-y-2">
          <p className="text-sm">
            <span className={cn('rounded-full border border-line px-2 py-0.5 text-xs', STATUS[current.status].cls)}>{STATUS[current.status].label}</span>
            <span className="ml-2 text-xs text-tx-2">{current.name ?? copy.label} <span className="bg-num">{current.externalId}</span></span>
          </p>
          <p className="text-xs text-tx-2">{STATUS[current.status].line}</p>
          <Button variant="outline" size="sm" onClick={withdraw} disabled={pending}>
            {current.status === 'pending' ? 'Withdraw request' : 'Remove'}
          </Button>
        </div>
      ) : (
        <>
          <ol className="list-decimal space-y-1 pl-4 text-xs text-tx-2">
            {copy.steps(shareWith).map(step => <li key={step}>{step}</li>)}
          </ol>
          <p className="text-xs text-tx-2">
            {platform === 'ga4' ? 'Our email: ' : 'Our Business ID: '}
            <span className="select-all font-medium text-tx">{shareWith}</span>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label={copy.label}
              placeholder={copy.placeholder}
              value={id}
              onChange={e => setId(e.target.value)}
              className="text-sm"
            />
            <Button onClick={submit} disabled={pending || id.trim().length < 3} className="shrink-0">
              {pending ? <><Loader2 className="h-4 w-4 mr-2" /> Checking...</> : 'Share access'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
