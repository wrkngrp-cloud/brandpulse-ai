'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react'

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
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            One more step to connect Instagram
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
            Your permissions are all set. We just need your Facebook Page ID to link your Instagram Business account — Facebook&apos;s API doesn&apos;t surface newer Pages automatically.
          </p>
        </div>
      </div>

      <div className="ml-7 space-y-3">
        <div className="text-sm text-amber-700 dark:text-amber-400 space-y-1">
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
            className="inline-flex items-center gap-1 text-amber-600 hover:underline mt-1"
          >
            Facebook help: Find your Page ID <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="e.g. 123456789012345"
            value={pageId}
            onChange={e => setPageId(e.target.value)}
            className="max-w-xs bg-white dark:bg-background"
          />
          <Button type="submit" disabled={loading || !pageId.trim()} size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
          </Button>
        </form>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    </div>
  )
}
