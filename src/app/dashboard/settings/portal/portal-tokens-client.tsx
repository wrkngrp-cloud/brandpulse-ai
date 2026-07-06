'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, Trash2, Plus, ExternalLink, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Token {
  id:            string
  token:         string
  label:         string
  sections:      string[]
  expires_at:    string | null
  last_accessed: string | null
  created_at:    string
  brands:        { name: string } | null
}

interface Props {
  tokens:      Token[]
  brands:      { id: string; name: string }[]
  plan:        string
  portalLimit: number
  appUrl:      string
}

const SECTION_OPTIONS = [
  { value: 'executive_summary', label: 'Executive Summary (AI)'              },
  { value: 'bhi',               label: 'Brand Health Index'                  },
  { value: 'sentiment',         label: 'Sentiment'                           },
  { value: 'sov',               label: 'Share of Voice'                      },
  { value: 'competitive',       label: 'Competitive Context'                 },
  { value: 'campaigns',         label: 'Campaign Performance'                },
  { value: 'nps',               label: 'NPS Score'                           },
  { value: 'insights',          label: 'Wins, Concerns & Priorities (AI)'   },
  { value: 'reporting',         label: 'Monthly Report (AI)'                 },
]

export function PortalTokensClient({ tokens: initial, brands, plan, portalLimit, appUrl }: Props) {
  const [tokens, setTokens]     = useState(initial)
  const [brandId, setBrandId]   = useState(brands[0]?.id ?? '')
  const [label, setLabel]       = useState('Client portal')
  const [sections, setSections] = useState(['executive_summary', 'bhi', 'sentiment', 'sov', 'campaigns', 'insights'])
  const [creating, setCreating] = useState(false)

  const atLimit = portalLimit !== -1 && tokens.length >= portalLimit

  function toggleSection(s: string) {
    setSections(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  async function createToken() {
    if (!brandId) { toast.error('Select a brand'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/portal/tokens', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ brandId, label, sections }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTokens(t => [{ ...data, brands: brands.find(b => b.id === brandId) ?? null, sections, label, expires_at: null, last_accessed: null, created_at: new Date().toISOString() }, ...t])
      toast.success('Portal link created')
      setLabel('Client portal')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setCreating(false)
    }
  }

  async function deleteToken(id: string) {
    if (!confirm('Delete this portal link? Anyone using it will lose access.')) return
    const res = await fetch(`/api/portal/tokens/${id}`, { method: 'DELETE' })
    if (res.ok) { setTokens(t => t.filter(x => x.id !== id)); toast.success('Link deleted') }
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${appUrl}/portal/${token}`)
    toast.success('Link copied')
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="eyebrow mb-1">Settings</p>
        <h1 className="h-display text-[26px] leading-none">Client Portal</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground/70 max-w-xl">
          Create read-only shareable links for clients to view brand performance data. No login required. Your {plan} plan supports {portalLimit === -1 ? 'unlimited' : portalLimit} portal link{portalLimit === 1 ? '' : 's'}.
        </p>
      </div>

      {/* Create form */}
      {atLimit ? (
        <div className="rounded-xl border border-dashed p-5 text-center">
          <p className="text-[13px] text-muted-foreground">You've reached your portal link limit.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.href = '/dashboard/settings/billing'}>
            Upgrade to add more
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-5 space-y-4">
          <p className="text-[13px] font-semibold">Create new link</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Brand</Label>
              <Select value={brandId} onValueChange={(v) => v && setBrandId(v)}>
                <SelectTrigger>
                  <span className="flex flex-1 text-left text-sm truncate">
                    {brands.find(b => b.id === brandId)?.name ?? 'Select brand'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">Link label</Label>
              <Input id="label" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Acme Co. portal" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Visible sections</Label>
            <div className="flex flex-wrap gap-2">
              {SECTION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleSection(opt.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all',
                    sections.includes(opt.value)
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-border text-muted-foreground hover:border-foreground/40'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={createToken} disabled={creating || !brandId} size="sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" />Create portal link
          </Button>
        </div>
      )}

      {/* Token list */}
      {tokens.length > 0 && (
        <div className="rounded-2xl border bg-card divide-y divide-border/50 overflow-hidden">
          {tokens.map(t => (
            <div key={t.id} className="p-4 flex items-start gap-3 hover:bg-muted/20">
              <Link2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-medium truncate">{t.label}</p>
                <p className="text-[12px] text-muted-foreground">
                  {(t.brands as { name: string } | null)?.name ?? '—'} ·{' '}
                  {t.last_accessed
                    ? `Last viewed ${new Date(t.last_accessed).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' })}`
                    : 'Not yet viewed'}
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {t.sections.map(s => (
                    <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0">{s}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyLink(t.token)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <a
                  href={`${appUrl}/portal/${t.token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => deleteToken(t.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tokens.length === 0 && !atLimit && (
        <p className="text-[13px] text-muted-foreground text-center py-6">No portal links yet. Create one above.</p>
      )}
    </div>
  )
}
