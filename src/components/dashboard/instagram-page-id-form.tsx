'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ExternalLinkIcon as ExternalLink } from '@/components/brand/icon'
import { Working as Loader2 } from '@/components/brand/working'
import { AlertIcon as AlertTriangle } from '@/components/brand/icon'

export function InstagramPageIdForm({ pendingKey }: { pendingKey: string }) {
  const router = useRouter()
  const [pageId, setPageId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pageId.trim()) return
    setLoading(true)
    setError(null)

    const res = await fetch('/api/social/instagram/finish-connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: pendingKey, pageId: pageId.trim() }),
    })
    const data = await res.json() as { ok?: boolean; error?: string }

    if (data.ok) {
      router.push('/dashboard/content?connected=instagram')
    } else {
      setError(data.error ?? 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-line bg-shell dark:bg-shell/30 dark:border-line p-4 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-tx-2 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-tx-2 dark:text-tx-2">
            One more step to connect Instagram
          </p>
          <p className="text-sm text-tx-2 dark:text-tx-2 mt-1">
            Your permissions are all set. We just need your Facebook Page ID to link your Instagram Business account — Facebook&apos;s API doesn&apos;t surface newer Pages automatically.
          </p>
        </div>
      </div>

      <div className="ml-7 space-y-3">
        <div className="text-sm text-tx-2 dark:text-tx-2 space-y-1">
          <p className="font-medium">How to find your Page ID:</p>
          <ol className="list-decimal list-outside ml-4 space-y-1">
            <li>Click your Page&apos;s name in the left menu to go to it</li>
            <li>Click your Page&apos;s name beneath the cover photo</li>
            <li>Click <strong>Transparency and privacy policy</strong> — your Page ID is listed there</li>
          </ol>
          <a
            href="https://www.facebook.com/help/1503421039731588"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-tx-2 hover:underline mt-1"
          >
            Facebook help: Find your Page ID <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="e.g. 123456789012345"
            value={pageId}
            onChange={e => setPageId(e.target.value)}
            className="max-w-xs bg-card dark:bg-background"
          />
          <Button type="submit" disabled={loading || !pageId.trim()} size="sm">
            {loading ? <Loader2 className="h-4 w-4" /> : 'Connect'}
          </Button>
        </form>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    </div>
  )
}
