'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams }              from 'next/navigation'
import { CheckCircle2, Unplug, Zap }   from 'lucide-react'
import { toast }                        from 'sonner'
import { buttonVariants }               from '@/components/ui/button'
import { cn }                           from '@/lib/utils'

export interface MetaAdsAccountData {
  id:             string
  account_name:   string | null
  ad_account_id:  string | null
  sync_status:    string
  last_synced_at: string | null
}

interface Props {
  account: MetaAdsAccountData | null
}

function MetaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 2.667C8.636 2.667 2.667 8.636 2.667 16S8.636 29.333 16 29.333 29.333 23.364 29.333 16 23.364 2.667 16 2.667z" fill="#1877F2"/>
      <path d="M21.76 13.04c-.12-1.52-1.12-2.72-2.56-2.72-1.04 0-1.84.56-2.24 1.36-.4-.8-1.2-1.36-2.24-1.36-1.44 0-2.44 1.2-2.56 2.72L11.6 20h2.08l.48-4.64c.08-.8.56-1.28 1.12-1.28.64 0 1.04.56 1.04 1.28V20h2.08v-4.64c0-.72.4-1.28 1.04-1.28.56 0 1.04.48 1.12 1.28L20.96 20h2.08l-.56-6.96z" fill="white"/>
    </svg>
  )
}

export function MetaAdsConnectCard({ account: initialAccount }: Props) {
  const [account, setAccount]   = useState<MetaAdsAccountData | null>(initialAccount)
  const [loading, setLoading]   = useState<'disconnect' | null>(null)
  const searchParams = useSearchParams()
  const toastFired   = useRef(false)

  useEffect(() => {
    if (toastFired.current) return
    const connected = searchParams.get('connected')
    const error     = searchParams.get('error')

    if (connected === 'meta') {
      toastFired.current = true
      toast.success('Meta Ads connected. Data will sync tonight at 5 AM Lagos time.')
      window.history.replaceState({}, '', window.location.pathname)
    } else if (error) {
      const messages: Record<string, string> = {
        oauth_cancelled:        'OAuth cancelled. Try connecting again.',
        token_exchange_failed:  'Could not exchange the authorisation code. Try again.',
        no_workspace:           'No workspace found.',
        no_brand:               'No brand found. Complete onboarding first.',
        db_error:               'Failed to save the connection. Try again.',
        oauth_failed:           'Meta Ads connection failed. Try again.',
        invalid_state:          'Session expired. Try connecting again.',
        meta_not_configured:    'Meta Ads is not configured on this server. Add META_APP_ID and META_APP_SECRET.',
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
      const res = await fetch('/api/ads/meta/connect', { method: 'DELETE' })
      if (!res.ok) throw new Error("Couldn't disconnect Meta Ads. Try again.")
      setAccount(null)
      toast.success('Meta Ads disconnected')
    } catch {
      toast.error("Couldn't disconnect Meta Ads. Try again.")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="border rounded-xl p-5 bg-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-[#1877F2]/10 flex items-center justify-center shrink-0">
            <MetaIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Meta Ads</p>
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
                Connect your Meta Ads account to sync campaign performance and enable geo-retargeting.
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
            href="/api/ads/meta/connect?return_to=connectors"
            className={cn(
              buttonVariants({ size: 'sm' }),
              'shrink-0 inline-flex items-center gap-1.5'
            )}
          >
            <Zap className="h-3.5 w-3.5" />
            Connect Meta Ads
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
