'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams }              from 'next/navigation'
import { CheckCircle2, Unplug, Zap }   from 'lucide-react'
import { toast }                        from 'sonner'
import { buttonVariants }               from '@/components/ui/button'
import { cn }                           from '@/lib/utils'

export interface GoogleAdsAccountData {
  id:             string
  account_name:   string | null
  ad_account_id:  string | null
  sync_status:    string
  last_synced_at: string | null
}

interface Props {
  account: GoogleAdsAccountData | null
}

function GoogleAdsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="6" width="8" height="20" rx="4" transform="rotate(-30 8 16)" fill="#FBBC04"/>
      <rect x="20" y="6" width="8" height="20" rx="4" transform="rotate(30 24 16)" fill="#4285F4"/>
      <circle cx="8" cy="24" r="4" fill="#34A853"/>
    </svg>
  )
}

export function GoogleAdsConnectCard({ account: initialAccount }: Props) {
  const [account, setAccount]   = useState<GoogleAdsAccountData | null>(initialAccount)
  const [loading, setLoading]   = useState<'disconnect' | null>(null)
  const searchParams = useSearchParams()
  const toastFired   = useRef(false)

  useEffect(() => {
    if (toastFired.current) return
    const connected = searchParams.get('connected')
    const error     = searchParams.get('error')

    if (connected === 'google_ads') {
      toastFired.current = true
      toast.success('Google Ads connected. Data will sync tonight at 5:30 AM Lagos time.')
      window.history.replaceState({}, '', window.location.pathname)
    } else if (error) {
      const messages: Record<string, string> = {
        oauth_cancelled:           'OAuth cancelled. Try connecting again.',
        token_exchange_failed:     'Could not exchange the authorisation code. Try again.',
        account_list_failed:       'Could not list your Google Ads accounts. Try again.',
        no_ad_accounts:            'No Google Ads accounts found for this Google login.',
        no_workspace:              'No workspace found.',
        no_brand:                  'No brand found. Complete onboarding first.',
        db_error:                  'Failed to save the connection. Try again.',
        oauth_failed:              'Google Ads connection failed. Try again.',
        invalid_state:             'Session expired. Try connecting again.',
        google_ads_not_configured: "Google Ads isn't configured on this server yet. It needs a developer token.",
      }
      const reason = searchParams.get('reason') ?? ''
      if (messages[error]) {
        toastFired.current = true
        toast.error(messages[error] + (reason ? ` (${reason})` : ''))
      }
    }
  }, [searchParams])

  async function disconnect() {
    setLoading('disconnect')
    try {
      const res = await fetch('/api/ads/google-ads/connect', { method: 'DELETE' })
      if (!res.ok) throw new Error("Couldn't disconnect Google Ads. Try again.")
      setAccount(null)
      toast.success('Google Ads disconnected')
    } catch {
      toast.error("Couldn't disconnect Google Ads. Try again.")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="border rounded-xl p-5 bg-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-[#4285F4]/10 flex items-center justify-center shrink-0">
            <GoogleAdsIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Google Ads</p>
            {account ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                <p className="text-xs text-muted-foreground">
                  {account.account_name ?? 'Connected'}
                  {account.ad_account_id && (
                    <span className="text-muted-foreground/50 ml-1">· {account.ad_account_id}</span>
                  )}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">
                Connect your Google Ads account to sync search and display campaign performance.
              </p>
            )}
          </div>
        </div>

        {account ? (
          <button
            onClick={disconnect}
            disabled={loading === 'disconnect'}
            className={cn(
              buttonVariants({ size: 'sm', variant: 'outline' }),
              'shrink-0 inline-flex items-center gap-1.5 text-muted-foreground'
            )}
          >
            <Unplug className="h-3.5 w-3.5" />
            {loading === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
          </button>
        ) : (
          <a
            href="/api/ads/google-ads/connect?return_to=connectors"
            className={cn(
              buttonVariants({ size: 'sm' }),
              'shrink-0 inline-flex items-center gap-1.5'
            )}
          >
            <Zap className="h-3.5 w-3.5" />
            Connect Google Ads
          </a>
        )}
      </div>

      {account?.last_synced_at && (
        <p className="text-[11px] text-muted-foreground/50 mt-3 pl-12">
          Last synced {new Date(account.last_synced_at).toLocaleDateString('en-NG', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos'
          })}
        </p>
      )}
    </div>
  )
}
