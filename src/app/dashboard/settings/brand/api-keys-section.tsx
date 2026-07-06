'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Key, Plus, Trash2, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  last_used_at: string | null
  created_at: string
  revoked_at: string | null
}

const METRIC_DOCS = [
  {
    type: 'fintech',
    label: 'Fintech',
    description: 'Unlocks: Action (first transactions, KYC) + Loyalty (MAU, AUM, dormancy)',
    example: JSON.stringify({
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      mau: 450000,
      dau: 125000,
      new_signups: 12400,
      kyc_completed: 9800,
      first_txn_count: 7200,
      aum_ngn: 28500000000,
      funding_frequency_days: 8.4,
      dormancy_rate: 0.12,
    }, null, 2),
  },
  {
    type: 'saas',
    label: 'SaaS',
    description: 'Unlocks: Action (trial conversions) + Loyalty (MRR, NRR, churn)',
    example: JSON.stringify({
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      trial_signups: 320,
      trial_converted: 88,
      active_seats: 2140,
      mrr_ngn: 18500000,
      nrr: 108.4,
      renewal_rate: 0.91,
      churn_rate: 0.03,
    }, null, 2),
  },
  {
    type: 'venue',
    label: 'Venue',
    description: 'Unlocks: Action (covers) + Loyalty (repeat visits, occasion mix)',
    example: JSON.stringify({
      date: '2026-06-28',
      covers: 342,
      capacity: 450,
      reservation_count: 198,
      occasion_type: 'dinner',
    }, null, 2),
  },
  {
    type: 'platform',
    label: 'Marketplace / Platform',
    description: 'Unlocks: Action (GMV) + Loyalty (creator retention, avg revenue)',
    example: JSON.stringify({
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      active_creators: 14200,
      new_creators: 870,
      churned_creators: 210,
      storefronts_live: 13600,
      gmv_ngn: 4200000000,
      avg_revenue_per_creator_ngn: 295774,
    }, null, 2),
  },
  {
    type: 'trade',
    label: 'B2B / Distribution',
    description: 'Unlocks: Action (orders, fill rate) + Loyalty (partner retention)',
    example: JSON.stringify({
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      active_partners: 1840,
      new_partners: 142,
      churned_partners: 38,
      total_orders: 9200,
      fill_rate: 0.94,
      avg_order_value_ngn: 285000,
    }, null, 2),
  },
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button type="button" onClick={handleCopy} className="text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

export function ApiKeysSection() {
  const [keys, setKeys]             = useState<ApiKey[]>([])
  const [loading, setLoading]       = useState(true)
  const [newKeyName, setNewKeyName] = useState('')
  const [generating, setGenerating] = useState(false)
  const [revealed, setRevealed]     = useState<{ key: string; name: string } | null>(null)
  const [showDocs, setShowDocs]     = useState(false)
  const [openDoc, setOpenDoc]       = useState<string | null>(null)

  const fetchKeys = useCallback(async () => {
    const res = await fetch('/api/brand/api-keys')
    if (res.ok) {
      const data = await res.json() as { keys: ApiKey[] }
      setKeys((data.keys ?? []).filter(k => !k.revoked_at))
    }
    setLoading(false)
  }, [])

  useEffect(() => { void fetchKeys() }, [fetchKeys])

  const handleGenerate = async () => {
    if (generating) return
    setGenerating(true)
    const res = await fetch('/api/brand/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName || 'Default Key' }),
    })
    const data = await res.json() as { key?: string; name?: string; error?: string }
    if (!res.ok || !data.key) {
      toast.error(data.error ?? 'Failed to generate key')
    } else {
      setRevealed({ key: data.key, name: data.name ?? 'Default Key' })
      setNewKeyName('')
      void fetchKeys()
    }
    setGenerating(false)
  }

  const handleRevoke = async (id: string) => {
    const res = await fetch(`/api/brand/api-keys?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setKeys(prev => prev.filter(k => k.id !== id))
      toast.success('Key revoked')
    } else {
      toast.error('Failed to revoke key')
    }
  }

  return (
    <div className="rounded-xl border bg-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Key className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">API Keys</h3>
        <span className="text-xs text-muted-foreground ml-1">First-party data ingestion</span>
      </div>

      {/* Key list */}
      <div className="space-y-2">
        {loading && (
          <p className="text-xs text-muted-foreground">Loading...</p>
        )}
        {!loading && keys.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No active keys. Generate one below.</p>
        )}
        {keys.map(k => (
          <div key={k.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm">
            <code className="flex-1 font-mono text-xs text-muted-foreground">{k.key_prefix}</code>
            <span className="text-xs text-muted-foreground/70 shrink-0">{k.name}</span>
            <span className="text-xs text-muted-foreground/50 shrink-0">
              {k.last_used_at
                ? `Last used ${new Date(k.last_used_at).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos' })}`
                : 'Never used'}
            </span>
            <button
              type="button"
              onClick={() => void handleRevoke(k.id)}
              className="text-muted-foreground hover:text-destructive transition-colors ml-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Revealed key — shown once */}
      {revealed && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
            Copy this key now — it will not be shown again.
          </p>
          <div className="flex items-center gap-2 rounded-md bg-background border px-3 py-2">
            <code className="flex-1 font-mono text-xs break-all select-all">{revealed.key}</code>
            <CopyButton text={revealed.key} />
          </div>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setRevealed(null)}>
            Done
          </Button>
        </div>
      )}

      {/* Generate form */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="keyName" className="text-xs">Key name</Label>
          <Input
            id="keyName"
            value={newKeyName}
            onChange={e => setNewKeyName(e.target.value)}
            placeholder="e.g. Production"
            className="h-8 text-xs w-44"
          />
        </div>
        <Button size="sm" className="h-8 gap-1.5" onClick={() => void handleGenerate()} disabled={generating}>
          <Plus className="w-3.5 h-3.5" />
          {generating ? 'Generating...' : 'Generate key'}
        </Button>
      </div>

      {/* API docs accordion */}
      <div className="border-t pt-4">
        <button
          type="button"
          onClick={() => setShowDocs(v => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showDocs ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          How to send your data
        </button>

        {showDocs && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              POST to <code className="font-mono bg-muted px-1 rounded">https://your-domain.com/api/first-party/[type]</code> with your key in the Authorization header.
            </p>
            <div className="rounded-md bg-muted p-2 font-mono text-xs text-muted-foreground overflow-x-auto">
              Authorization: Bearer bp_live_...
            </div>

            {METRIC_DOCS.map(doc => (
              <div key={doc.type} className="border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenDoc(v => v === doc.type ? null : doc.type)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-accent transition-colors"
                >
                  <span>{doc.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-normal">{doc.description}</span>
                    {openDoc === doc.type ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </div>
                </button>
                {openDoc === doc.type && (
                  <div className="px-3 pb-3 pt-1 border-t bg-muted/30">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs text-muted-foreground">POST /api/first-party/{doc.type}</p>
                      <CopyButton text={doc.example} />
                    </div>
                    <pre className="text-[11px] font-mono bg-background rounded-md p-2 overflow-x-auto max-h-52 border">
                      {doc.example}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
