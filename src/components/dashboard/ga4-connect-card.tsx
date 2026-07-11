'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams }              from 'next/navigation'
import { CheckCircle2, RefreshCw, Unplug, BarChart3 } from 'lucide-react'
import { toast }                        from 'sonner'
import { buttonVariants }               from '@/components/ui/button'
import { cn }                           from '@/lib/utils'

export interface GA4ConnectionData {
  id:             string
  property_id:    string
  property_name:  string | null
  last_synced_at: string | null
}

interface GA4ConnectCardProps {
  connection: GA4ConnectionData | null
}

// Inline Google "G" icon
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export function GA4ConnectCard({ connection: initialConnection }: GA4ConnectCardProps) {
  const [connection, setConnection] = useState<GA4ConnectionData | null>(initialConnection)
  const [loading, setLoading]       = useState<'sync' | 'disconnect' | null>(null)
  const searchParams = useSearchParams()
  const toastFired   = useRef(false)

  // Show toast on redirect-back from OAuth flow
  useEffect(() => {
    if (toastFired.current) return
    const connected = searchParams.get('connected')
    const error     = searchParams.get('error')

    if (connected === 'ga4') {
      toastFired.current = true
      toast.success('Google Analytics 4 connected')
    } else if (error?.startsWith('ga4_')) {
      toastFired.current = true
      const messages: Record<string, string> = {
        ga4_denied:           'Access denied — you must grant Analytics permission',
        ga4_token_failed:     'Could not exchange the authorisation code',
        ga4_no_property:      'No GA4 property found on your Google account',
        ga4_invalid_state:    'Session expired — please try again',
        ga4_not_configured:   'Google OAuth is not configured on this server',
        ga4_db_error:         'Failed to save the connection — please try again',
      }
      toast.error(messages[error] ?? 'GA4 connection failed')
    }
  }, [searchParams])

  async function handleSync() {
    setLoading('sync')
    try {
      const res  = await fetch('/api/connectors/ga4/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Sync failed'); return }
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
      const res  = await fetch('/api/connectors/ga4/disconnect', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to disconnect'); return }
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
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos',
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
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5 text-xs')}
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
        <div className="space-y-3">
          <a
            href="/api/connectors/ga4/auth"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'inline-flex items-center gap-2 text-xs'
            )}
          >
            <GoogleIcon className="h-3.5 w-3.5" />
            Sign in with Google
          </a>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            You will be redirected to Google to grant Analytics read access.
            BrandGauge only reads data — it never modifies your GA4 property.
          </p>
        </div>
      )}
    </div>
  )
}
