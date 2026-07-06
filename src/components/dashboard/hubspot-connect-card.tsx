'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams }              from 'next/navigation'
import { CheckCircle2, Unplug }         from 'lucide-react'
import { toast }                        from 'sonner'
import { buttonVariants }               from '@/components/ui/button'
import { cn }                           from '@/lib/utils'

export interface HubSpotConnectionData {
  id:             string
  portal_id:      string | null
  last_synced_at: string | null
}

interface HubSpotConnectCardProps {
  connection: HubSpotConnectionData | null
}

// Inline HubSpot sprocket icon
function HubSpotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="15.5" cy="13.5" r="4.25" stroke="#FF7A59" strokeWidth="2" />
      <path d="M15.5 9.25V5.5" stroke="#FF7A59" strokeWidth="2" strokeLinecap="round" />
      <circle cx="15.5" cy="4.5" r="1.5" fill="#FF7A59" />
      <path d="M12.3 10.6 6.5 6.2" stroke="#FF7A59" strokeWidth="2" strokeLinecap="round" />
      <circle cx="5.5" cy="5.5" r="1.5" fill="#FF7A59" />
      <path d="m12.6 16.2-3.4 3.3" stroke="#FF7A59" strokeWidth="2" strokeLinecap="round" />
      <circle cx="8.25" cy="20.25" r="1.5" fill="#FF7A59" />
    </svg>
  )
}

export function HubSpotConnectCard({ connection: initialConnection }: HubSpotConnectCardProps) {
  const [connection, setConnection] = useState<HubSpotConnectionData | null>(initialConnection)
  const [loading, setLoading]       = useState<'disconnect' | null>(null)
  const searchParams = useSearchParams()
  const toastFired   = useRef(false)

  // Show toast on redirect-back from OAuth flow
  useEffect(() => {
    if (toastFired.current) return
    const connected = searchParams.get('connected')
    const error     = searchParams.get('error')

    if (connected === 'hubspot') {
      toastFired.current = true
      toast.success('HubSpot connected. MQL counts will sync daily at 6:30 AM Lagos time')
    } else if (error?.startsWith('hubspot_')) {
      toastFired.current = true
      const messages: Record<string, string> = {
        hubspot_not_configured: "HubSpot isn't configured on this server yet",
        hubspot_denied:         'Access denied. You need to grant contact read permission',
        hubspot_no_code:        'HubSpot did not return an authorisation code. Please try again',
        hubspot_invalid_state:  'Session expired. Please try again',
        hubspot_token_failed:   'Could not exchange the authorisation code',
        hubspot_no_brand:       'No brand found. Complete onboarding first',
        hubspot_db_error:       'Failed to save the connection. Please try again',
      }
      toast.error(messages[error] ?? 'HubSpot connection failed')
    }
  }, [searchParams])

  async function handleDisconnect() {
    setLoading('disconnect')
    try {
      const res  = await fetch('/api/connectors/hubspot/disconnect', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to disconnect'); return }
      toast.success('HubSpot disconnected')
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
          <HubSpotIcon className="h-4 w-4" />
          <div>
            <h3 className="text-sm font-semibold">HubSpot</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Read your marketing qualified lead count from HubSpot contact lifecycle stages
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
            {connection.portal_id && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Portal</span>
                <span className="font-mono">{connection.portal_id}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last synced</span>
              <span>
                {connection.last_synced_at
                  ? new Date(connection.last_synced_at).toLocaleDateString('en-NG', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos',
                    })
                  : 'Tonight at 6:30 AM Lagos time'}
              </span>
            </div>
          </div>

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
      ) : (
        <div className="space-y-3">
          <a
            href="/api/connectors/hubspot/auth"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'inline-flex items-center gap-2 text-xs'
            )}
          >
            <HubSpotIcon className="h-3.5 w-3.5" />
            Connect HubSpot
          </a>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            You will be redirected to HubSpot to grant read access to your contacts.
            BrandPulse only counts lifecycle stages. It never edits or creates anything in HubSpot.
          </p>
        </div>
      )}
    </div>
  )
}
