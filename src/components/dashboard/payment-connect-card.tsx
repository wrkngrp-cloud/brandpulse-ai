'use client'

import { useState } from 'react'
import { CheckCircle2, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PaymentProviderCardProps {
  provider: 'paystack' | 'flutterwave'
  isConfigured: boolean
  webhookUrl: string
}

function PaymentProviderCard({
  provider,
  isConfigured: initialConfigured,
  webhookUrl,
}: PaymentProviderCardProps) {
  const [configured, setConfigured]   = useState(initialConfigured)
  const [secretKey, setSecretKey]     = useState('')
  const [loading, setLoading]         = useState(false)
  const [copied, setCopied]           = useState(false)
  const [showUpdate, setShowUpdate]   = useState(false)

  const label = provider === 'paystack' ? 'Paystack' : 'Flutterwave'
  const apiUrl = `/api/connectors/${provider}/configure`

  async function handleCopy() {
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret_key: secretKey }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? `Failed to save ${label} config`)
        return
      }
      toast.success(`${label} webhook configured`)
      setConfigured(true)
      setShowUpdate(false)
      setSecretKey('')
    } catch {
      toast.error(`Failed to save ${label} config`)
    } finally {
      setLoading(false)
    }
  }

  const showForm = !configured || showUpdate

  return (
    <div className="border rounded-xl p-5 bg-card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{label}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Capture payments as funnel signals (Action stage)
          </p>
        </div>
        {configured && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Configured
          </span>
        )}
      </div>

      {/* Webhook URL row — always visible */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium">Webhook URL</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md bg-muted/50 border border-input px-3 py-1.5 text-[11px] font-mono truncate">
            {webhookUrl}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            title="Copy webhook URL"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'shrink-0 gap-1.5 text-xs px-2.5'
            )}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Go to {label} dashboard {'>'} Settings {'>'} Webhooks, paste this URL, then copy
          {provider === 'paystack' ? ' your webhook secret key' : ' your webhook hash secret'}
          {' '}below.
        </p>
      </div>

      {configured && !showUpdate ? (
        <button
          type="button"
          onClick={() => setShowUpdate(true)}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'text-xs')}
        >
          Update secret key
        </button>
      ) : (
        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor={`${provider}-secret-key`}
              className="text-xs font-medium"
            >
              {provider === 'paystack' ? 'Webhook secret key' : 'Webhook hash secret'}
            </label>
            <input
              id={`${provider}-secret-key`}
              type="password"
              value={secretKey}
              onChange={e => setSecretKey(e.target.value)}
              placeholder={provider === 'paystack' ? 'sk_live_...' : 'your-hash-secret'}
              required
              minLength={10}
              className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className={cn(buttonVariants({ size: 'sm' }), 'text-xs')}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
            {showUpdate && (
              <button
                type="button"
                onClick={() => { setShowUpdate(false); setSecretKey('') }}
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-xs')}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}

export interface PaymentConfigStatus {
  paystack: boolean
  flutterwave: boolean
}

export function PaymentConnectCard({
  status,
  appUrl,
}: {
  status: PaymentConfigStatus
  appUrl: string
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Payment connectors</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Every successful payment is logged as an Action-stage funnel signal. Repeat purchases push the customer toward the Loyalty stage.
        </p>
      </div>

      <PaymentProviderCard
        provider="paystack"
        isConfigured={status.paystack}
        webhookUrl={`${appUrl}/api/webhooks/paystack`}
      />

      <PaymentProviderCard
        provider="flutterwave"
        isConfigured={status.flutterwave}
        webhookUrl={`${appUrl}/api/webhooks/flutterwave`}
      />
    </div>
  )
}
