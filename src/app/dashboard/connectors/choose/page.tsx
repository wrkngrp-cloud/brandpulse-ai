'use client'

import { Suspense, useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type Kind = 'facebook' | 'instagram' | 'meta_ads'
const COPY: Record<Kind, { title: string; body: string }> = {
  facebook:  { title: 'Which Facebook Page is this brand?',  body: 'Your login manages more than one Page. Pick the one for this brand. You can connect another brand’s Page from that brand.' },
  instagram: { title: 'Which Page holds this brand’s Instagram?', body: 'Your login manages more than one Page. Pick the one linked to this brand’s Instagram Business account.' },
  meta_ads:  { title: 'Which ad account is this brand?', body: 'Your login can see more than one ad account. Pick the one this brand’s campaigns run from.' },
}

export default function ChoosePage() {
  return <Suspense fallback={<Skeleton className="h-64 max-w-lg rounded-sm" />}><Choose /></Suspense>
}

function Choose() {
  const key = useSearchParams().get('key') ?? ''
  const router = useRouter()
  const [data, setData] = useState<{ kind: Kind; options: { id: string; name: string; note?: string }[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  const [pending, start] = useTransition()

  useEffect(() => {
    fetch(`/api/social/meta-pick?key=${encodeURIComponent(key)}`)
      .then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error); setData(b) })
      .catch(e => setError(e instanceof Error ? e.message : 'That choice has expired.'))
  }, [key])

  const connect = () => start(async () => {
    const r = await fetch('/api/social/meta-pick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, id: chosen }) })
    const b = await r.json().catch(() => ({})) as { error?: string; redirect?: string }
    if (!r.ok) { toast.error(b.error ?? 'That did not go through. Try again.'); return }
    router.push(b.redirect ?? '/dashboard/connectors')
  })

  if (error) {
    return (
      <div className="max-w-lg space-y-3 rounded-sm border border-line bg-card p-5">
        <p className="font-medium">{error}</p>
        <Link href="/dashboard/connectors" className="text-sm underline underline-offset-2">Back to Connectors</Link>
      </div>
    )
  }
  if (!data) return <Skeleton className="h-64 max-w-lg rounded-sm" />

  const copy = COPY[data.kind]
  return (
    <div className="max-w-lg space-y-4" data-tour="meta-choose">
      <div className="space-y-1">
        <h1 className="text-lg font-medium">{copy.title}</h1>
        <p className="text-sm text-tx-2">{copy.body}</p>
      </div>
      <ul className="space-y-2" role="radiogroup">
        {data.options.map(o => (
          <li key={o.id}>
            <button
              type="button" role="radio" aria-checked={chosen === o.id} onClick={() => setChosen(o.id)}
              className={cn('w-full rounded-sm border bg-card px-4 py-3 text-left bg-press',
                chosen === o.id ? 'border-foreground ring-2 ring-foreground/10' : 'border-line hover:border-foreground/40')}
            >
              <span className="block text-sm font-medium">{o.name}</span>
              {o.note && <span className="block text-xs text-tx-3">{o.note}</span>}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button onClick={connect} disabled={!chosen || pending}>{pending ? 'Connecting...' : 'Connect this one'}</Button>
        <Link href="/dashboard/connectors" className="inline-flex items-center px-3 text-sm text-tx-2 underline underline-offset-2">Cancel</Link>
      </div>
    </div>
  )
}
