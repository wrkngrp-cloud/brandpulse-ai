'use client'

import { useState } from 'react'
import { CheckCircle2, Mail, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface EmailConnectorStatus {
  mailchimp: boolean
  brevo:     boolean
  last_synced_at?: string | null
}

interface EmailConnectCardProps {
  status: EmailConnectorStatus
}

type Provider = 'mailchimp' | 'brevo'

const PROVIDERS: { id: Provider; label: string; placeholder: string; helpText: string }[] = [
  {
    id:          'mailchimp',
    label:       'Mailchimp',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us1',
    helpText:    'API key from Account → Extras → API Keys',
  },
  {
    id:          'brevo',
    label:       'Brevo (Sendinblue)',
    placeholder: 'xkeysib-...',
    helpText:    'API key from Settings → SMTP & API → API Keys',
  },
]

function ProviderCard({
  provider,
  label,
  placeholder,
  helpText,
  isConnected: initialConnected,
  onSynced,
}: {
  provider:    Provider
  label:       string
  placeholder: string
  helpText:    string
  isConnected: boolean
  onSynced:    () => void
}) {
  const [connected, setConnected] = useState(initialConnected)
  const [apiKey, setApiKey]       = useState('')
  const [listId, setListId]       = useState('')
  const [loading, setLoading]     = useState<'save' | 'sync' | null>(null)
  const [showUpdate, setShowUpdate] = useState(false)

  const apiUrl = `/api/connectors/${provider}/configure`

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!apiKey.trim()) {
      toast.error('Enter your API key')
      return
    }
    setLoading('save')
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey.trim(), list_id: listId.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? `Failed to save ${label} config`)
        return
      }
      toast.success(`${label} connected. Sync runs daily at 7 AM Lagos time.`)
      setConnected(true)
      setShowUpdate(false)
      setApiKey('')
      setListId('')
    } finally {
      setLoading(null)
    }
  }

  async function handleSync() {
    setLoading('sync')
    try {
      await fetch('/api/connectors/mailchimp/sync', { method: 'POST' })
      toast.success('Email sync triggered — results appear within a few minutes.')
      onSynced()
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="border border-border/60 rounded-xl p-4 bg-card/50 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        {connected && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Connected
          </span>
        )}
      </div>

      {connected && !showUpdate ? (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleSync}
            disabled={loading === 'sync'}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2 text-xs')}
          >
            {loading === 'sync'
              ? <RefreshCw className="h-3 w-3 animate-spin" />
              : <RefreshCw className="h-3 w-3" />
            }
            Sync now
          </button>
          <button
            onClick={() => setShowUpdate(true)}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-xs')}
          >
            Update key
          </button>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-2">
          <div>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">{helpText}</p>
          </div>
          <input
            type="text"
            value={listId}
            onChange={e => setListId(e.target.value)}
            placeholder="Audience / List ID (optional)"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading === 'save'}
              className={cn(buttonVariants({ size: 'sm' }), 'text-xs')}
            >
              {loading === 'save' ? 'Saving…' : 'Save'}
            </button>
            {connected && (
              <button
                type="button"
                onClick={() => { setShowUpdate(false); setApiKey(''); setListId('') }}
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

export function EmailConnectCard({ status: initialStatus }: EmailConnectCardProps) {
  const [, forceUpdate] = useState(0)

  return (
    <div className="border rounded-xl p-5 bg-card space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Email Marketing</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Connect Mailchimp or Brevo to pull open rates and click rates as Loyalty signals in the Brand Funnel.
          Campaign metrics sync daily at 7 AM Lagos time.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {PROVIDERS.map(p => (
          <ProviderCard
            key={p.id}
            provider={p.id}
            label={p.label}
            placeholder={p.placeholder}
            helpText={p.helpText}
            isConnected={initialStatus[p.id]}
            onSynced={() => forceUpdate(n => n + 1)}
          />
        ))}
      </div>
    </div>
  )
}
