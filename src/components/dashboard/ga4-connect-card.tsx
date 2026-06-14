'use client'

import { useState } from 'react'
import { CheckCircle2, RefreshCw, Unplug, BarChart3 } from 'lucide-react'
import { toast } from 'sonner'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface GA4ConnectionData {
  id: string
  property_id: string
  property_name: string | null
  last_synced_at: string | null
}

interface GA4ConnectCardProps {
  connection: GA4ConnectionData | null
}

export function GA4ConnectCard({ connection: initialConnection }: GA4ConnectCardProps) {
  const [connection, setConnection] = useState<GA4ConnectionData | null>(initialConnection)
  const [propertyId, setPropertyId]   = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [loading, setLoading] = useState<'connect' | 'sync' | 'disconnect' | null>(null)

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setLoading('connect')
    try {
      const res = await fetch('/api/connectors/ga4/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId, access_token: accessToken }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to connect GA4')
        return
      }
      toast.success('GA4 connected')
      setConnection({
        id: data.id ?? '',
        property_id: propertyId,
        property_name: null,
        last_synced_at: null,
      })
      setPropertyId('')
      setAccessToken('')
    } catch {
      toast.error('Failed to connect GA4')
    } finally {
      setLoading(null)
    }
  }

  async function handleSync() {
    setLoading('sync')
    try {
      const res = await fetch('/api/connectors/ga4/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Sync failed')
        return
      }
      toast.success(`Synced — ${data.sessions?.toLocaleString()} sessions in the last 30 days`)
      setConnection(prev => prev ? { ...prev, last_synced_at: new Date().toISOString() } : prev)
    } catch {
      toast.error('Sync failed')
    } finally {
      setLoading(null)
    }
  }

  async function handleDisconnect() {
    setLoading('disconnect')
    try {
      const res = await fetch('/api/connectors/ga4/disconnect', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to disconnect')
        return
      }
      toast.success('GA4 disconnected')
      setConnection(null)
    } catch {
      toast.error('Failed to disconnect')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="border rounded-xl p-5 bg-card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BarChart3 className="h-4 w-4 text-orange-500" />
          <div>
            <h3 className="text-sm font-semibold">Google Analytics 4</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pull sessions, active users and conversions from your GA4 property
            </p>
          </div>
        </div>
        {connection && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Connected
          </span>
        )}
      </div>

      {connection ? (
        <div className="space-y-3">
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Property</span>
              <span className="font-mono">{connection.property_name ?? connection.property_id}</span>
            </div>
            {connection.last_synced_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last synced</span>
                <span>
                  {new Date(connection.last_synced_at).toLocaleDateString('en-NG', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
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
              {loading === 'sync' ? 'Syncing...' : 'Sync now'}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={loading !== null}
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'gap-1.5 text-xs text-destructive hover:text-destructive'
              )}
            >
              <Unplug className="h-3.5 w-3.5" />
              {loading === 'disconnect' ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-medium" htmlFor="ga4-property-id">
              GA4 Property ID
            </label>
            <input
              id="ga4-property-id"
              type="text"
              value={propertyId}
              onChange={e => setPropertyId(e.target.value)}
              placeholder="properties/123456789"
              required
              className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium" htmlFor="ga4-access-token">
              Access Token
            </label>
            <input
              id="ga4-access-token"
              type="password"
              value={accessToken}
              onChange={e => setAccessToken(e.target.value)}
              placeholder="ya29.a0..."
              required
              className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Paste an OAuth access token from{' '}
            <a
              href="https://developers.google.com/oauthplayground"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Google OAuth Playground
            </a>{' '}
            or your GA4 service account. Scope needed:{' '}
            <code className="font-mono">analytics.readonly</code>.
          </p>
          <button
            type="submit"
            disabled={loading !== null}
            className={cn(buttonVariants({ size: 'sm' }), 'text-xs')}
          >
            {loading === 'connect' ? 'Connecting...' : 'Connect GA4'}
          </button>
        </form>
      )}
    </div>
  )
}
