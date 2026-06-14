'use client'

import { useState } from 'react'
import { CheckCircle2, RefreshCw, Smartphone, Star } from 'lucide-react'
import { toast } from 'sonner'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface AppStoreConfigData {
  apple_app_id:    string | null
  google_pkg_name: string | null
  avg_rating:      number | null
  review_count:    number
}

interface AppStoreConnectCardProps {
  config: AppStoreConfigData | null
}

export function AppStoreConnectCard({ config: initialConfig }: AppStoreConnectCardProps) {
  const [config, setConfig] = useState<AppStoreConfigData | null>(initialConfig)
  const [appleAppId, setAppleAppId]       = useState('')
  const [googlePkgName, setGooglePkgName] = useState('')
  const [loading, setLoading] = useState<'save' | 'sync' | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!appleAppId.trim() && !googlePkgName.trim()) {
      toast.error('Enter at least one App ID or package name')
      return
    }
    setLoading('save')
    try {
      const res = await fetch('/api/connectors/app-store/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apple_app_id:    appleAppId.trim() || undefined,
          google_pkg_name: googlePkgName.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save')
        return
      }
      toast.success('App store IDs saved. Sync will run next Sunday at 7 AM Lagos time.')
      setConfig({
        apple_app_id:    appleAppId.trim() || null,
        google_pkg_name: googlePkgName.trim() || null,
        avg_rating:      null,
        review_count:    0,
      })
      setAppleAppId('')
      setGooglePkgName('')
    } catch {
      toast.error('Failed to save')
    } finally {
      setLoading(null)
    }
  }

  async function handleSync() {
    setLoading('sync')
    try {
      const res = await fetch('/api/connectors/app-store/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Sync failed')
        return
      }
      toast.success(data.message ?? 'Sync queued')
    } catch {
      toast.error('Sync failed')
    } finally {
      setLoading(null)
    }
  }

  const isConfigured = Boolean(config?.apple_app_id || config?.google_pkg_name)

  return (
    <div className="border rounded-xl p-5 bg-card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Smartphone className="h-4 w-4 text-blue-500" />
          <div>
            <h3 className="text-sm font-semibold">App Store Reviews</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pull Apple App Store ratings and reviews weekly for sentiment analysis
            </p>
          </div>
        </div>
        {isConfigured && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Configured
          </span>
        )}
      </div>

      {isConfigured && config ? (
        <div className="space-y-3">
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs space-y-1">
            {config.apple_app_id && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Apple App ID</span>
                <span className="font-mono">{config.apple_app_id}</span>
              </div>
            )}
            {config.google_pkg_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Android package</span>
                <span className="font-mono">{config.google_pkg_name}</span>
              </div>
            )}
            {config.avg_rating !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg rating (last 30 reviews)</span>
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {config.avg_rating.toFixed(1)}
                </span>
              </div>
            )}
            {config.review_count > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reviews collected</span>
                <span>{config.review_count}</span>
              </div>
            )}
            {config.google_pkg_name && (
              <p className="text-[11px] text-amber-600 pt-1">
                Google Play reviews need the official Publisher API. Apple reviews sync automatically.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleSync}
            disabled={loading !== null}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'gap-1.5 text-xs'
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading === 'sync' && 'animate-spin')} />
            {loading === 'sync' ? 'Queuing...' : 'Sync now'}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-medium" htmlFor="apple-app-id">
              Apple App ID
            </label>
            <input
              id="apple-app-id"
              type="text"
              value={appleAppId}
              onChange={e => setAppleAppId(e.target.value)}
              placeholder="e.g. 123456789"
              className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground">
              Find this in App Store Connect under App Information.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium" htmlFor="google-pkg-name">
              Google Play Package Name
            </label>
            <input
              id="google-pkg-name"
              type="text"
              value={googlePkgName}
              onChange={e => setGooglePkgName(e.target.value)}
              placeholder="e.g. com.example.app"
              className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground">
              Google Play reviews require the official Publisher API. Package name is saved for future integration.
            </p>
          </div>
          <button
            type="submit"
            disabled={loading !== null}
            className={cn(buttonVariants({ size: 'sm' }), 'text-xs')}
          >
            {loading === 'save' ? 'Saving...' : 'Save'}
          </button>
        </form>
      )}
    </div>
  )
}
