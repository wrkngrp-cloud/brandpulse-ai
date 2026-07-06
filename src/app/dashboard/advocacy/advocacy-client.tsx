'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, Plus, Copy, Check, ExternalLink, Star,
  TrendingUp, MousePointer, ShoppingCart, Activity,
  ChevronDown, ChevronRight, Loader2, X, Link2,
  RefreshCw, UserCheck, Pause, UserX,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn, formatNGN } from '@/lib/utils'
import { toast } from 'sonner'
import { TourTrigger } from '@/components/tours/tour-trigger'

// ── Types ────────────────────────────────────────────────────────────────────

interface ReferralCode {
  id:                  string
  code:                string
  label:               string | null
  destination_url:     string
  clicks:              number
  unique_clicks:       number
  conversions:         number
  attributed_revenue:  number
  is_active:           boolean
  created_at:          string
}

interface Promoter {
  id:            string
  name:          string
  email:         string | null
  phone:         string | null
  source:        string
  nps_score:     number | null
  status:        string
  notes:         string | null
  created_at:    string
  referral_codes: ReferralCode[]
}

interface NpsCandidate {
  id:            string
  score:         number
  verbatim:      string | null
  promoter_type: string
  created_at:    string
}

type Tab = 'promoters' | 'performance'

// ── Main component ───────────────────────────────────────────────────────────

export function AdvocacyClient() {
  const [tab, setTab] = useState<Tab>('promoters')
  const [promoters, setPromoters]         = useState<Promoter[]>([])
  const [candidates, setCandidates]       = useState<NpsCandidate[]>([])
  const [loading, setLoading]             = useState(true)
  const [showAddForm, setShowAddForm]     = useState(false)
  const [showCodeForm, setShowCodeForm]   = useState<string | null>(null) // promoter id
  const [expandedId, setExpandedId]       = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [pRes, cRes] = await Promise.all([
      fetch('/api/promoters'),
      fetch('/api/promoters/nps-candidates'),
    ])
    if (pRes.ok)  setPromoters((await pRes.json()).promoters  ?? [])
    if (cRes.ok)  setCandidates((await cRes.json()).candidates ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Aggregate stats for performance tab
  const totalClicks      = promoters.flatMap(p => p.referral_codes).reduce((s, c) => s + c.clicks, 0)
  const totalUnique      = promoters.flatMap(p => p.referral_codes).reduce((s, c) => s + c.unique_clicks, 0)
  const totalConversions = promoters.flatMap(p => p.referral_codes).reduce((s, c) => s + c.conversions, 0)
  const totalRevenue     = promoters.flatMap(p => p.referral_codes).reduce((s, c) => s + c.attributed_revenue, 0)
  const activePromoters  = promoters.filter(p => p.status === 'active').length
  const convRate         = totalUnique > 0 ? ((totalConversions / totalUnique) * 100).toFixed(1) : '0.0'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Advocacy</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Activate your promoters and track referral performance
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <TourTrigger module="advocacy" autoStart />
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <div data-tour="advocacy-main">
      {/* Tabs */}
      <div className="flex border-b gap-1">
        {([['promoters', 'Promoters'], ['performance', 'Referral Performance']] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Promoters Tab ─────────────────────────────────────────────────── */}
      {tab === 'promoters' && (
        <div className="space-y-4">
          {/* NPS candidates banner */}
          {candidates.length > 0 && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-start gap-3">
                <Star className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-800">
                    {candidates.length} high-NPS respondent{candidates.length > 1 ? 's' : ''} ready to activate
                  </p>
                  <p className="text-xs text-green-700 mt-0.5">
                    These customers scored 9-10 in your NPS surveys and haven't been activated yet.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-green-300 text-green-800 hover:bg-green-100 shrink-0"
                  onClick={() => setShowAddForm(true)}
                >
                  Activate
                </Button>
              </div>
              {/* Show up to 3 candidate snippets */}
              <div className="mt-3 space-y-1">
                {candidates.slice(0, 3).map(c => (
                  <CandidateRow
                    key={c.id}
                    candidate={c}
                    onActivate={(name, email) => activateCandidate(c, name, email, loadAll)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Promoter list header */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {promoters.length} promoter{promoters.length !== 1 ? 's' : ''} total · {activePromoters} active
            </p>
            <Button size="sm" onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add promoter
            </Button>
          </div>

          {/* Add form */}
          {showAddForm && (
            <AddPromoterForm
              onSave={async (data) => {
                const res = await fetch('/api/promoters', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
                })
                if (!res.ok) { toast.error('Failed to add promoter'); return }
                toast.success('Promoter added')
                setShowAddForm(false)
                loadAll()
              }}
              onCancel={() => setShowAddForm(false)}
            />
          )}

          {/* List */}
          {loading && promoters.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && promoters.length === 0 && (
            <div className="rounded-xl border border-dashed p-12 text-center">
              <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">No promoters yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add your first promoter manually or activate from NPS high-scorers.</p>
            </div>
          )}

          <div className="space-y-2">
            {promoters.map(p => (
              <PromoterCard
                key={p.id}
                promoter={p}
                expanded={expandedId === p.id}
                onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                showCodeForm={showCodeForm === p.id}
                onGenerateCode={() => setShowCodeForm(showCodeForm === p.id ? null : p.id)}
                onCodeSaved={() => { setShowCodeForm(null); loadAll() }}
                onStatusChange={async (status) => {
                  await fetch(`/api/promoters/${p.id}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
                  })
                  toast.success(`Status updated to ${status}`)
                  loadAll()
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Performance Tab ──────────────────────────────────────────────── */}
      {tab === 'performance' && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<MousePointer className="h-4 w-4" />} label="Total clicks"       value={totalClicks.toLocaleString()} />
            <StatCard icon={<Users className="h-4 w-4" />}        label="Unique clicks"      value={totalUnique.toLocaleString()} />
            <StatCard icon={<ShoppingCart className="h-4 w-4" />} label="Conversions"        value={totalConversions.toLocaleString()} />
            <StatCard icon={<TrendingUp className="h-4 w-4" />}   label="Attributed revenue" value={formatNGN(totalRevenue)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <StatCard icon={<Activity className="h-4 w-4" />}    label="Conversion rate"    value={`${convRate}%`} />
            <StatCard icon={<UserCheck className="h-4 w-4" />}   label="Active promoters"   value={`${activePromoters}`} />
          </div>

          {/* Per-code leaderboard */}
          {promoters.flatMap(p => p.referral_codes).length > 0 ? (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b">
                <h2 className="font-semibold text-sm">Referral code leaderboard</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      {['Code', 'Promoter', 'Clicks', 'Unique', 'Conversions', 'Revenue', 'Status'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {promoters
                      .flatMap(p => p.referral_codes.map(c => ({ ...c, promoter: p })))
                      .sort((a, b) => b.clicks - a.clicks)
                      .map(c => (
                        <tr key={c.id} className="hover:bg-muted/20">
                          <td className="px-4 py-2 font-mono text-xs font-bold">{c.code}</td>
                          <td className="px-4 py-2 text-muted-foreground">{c.promoter.name}</td>
                          <td className="px-4 py-2">{c.clicks}</td>
                          <td className="px-4 py-2">{c.unique_clicks}</td>
                          <td className="px-4 py-2">{c.conversions}</td>
                          <td className="px-4 py-2">{formatNGN(c.attributed_revenue)}</td>
                          <td className="px-4 py-2">
                            <Badge variant={c.is_active ? 'default' : 'secondary'} className="text-xs">
                              {c.is_active ? 'Active' : 'Paused'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-12 text-center">
              <Link2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">No referral codes generated yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Activate promoters and generate referral codes to start tracking.
              </p>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
        {icon} {label}
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}

function PromoterCard({
  promoter, expanded, onToggle,
  showCodeForm, onGenerateCode, onCodeSaved, onStatusChange,
}: {
  promoter:      Promoter
  expanded:      boolean
  onToggle:      () => void
  showCodeForm:  boolean
  onGenerateCode: () => void
  onCodeSaved:   () => void
  onStatusChange: (s: string) => void
}) {
  const statusColor = {
    invited: 'bg-blue-50 text-blue-700 border-blue-200',
    active:  'bg-green-50 text-green-700 border-green-200',
    paused:  'bg-yellow-50 text-yellow-700 border-yellow-200',
    removed: 'bg-red-50 text-red-700 border-red-200',
  }[promoter.status] ?? 'bg-muted text-foreground'

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
      >
        {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{promoter.name}</span>
            {promoter.nps_score !== null && (
              <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                NPS {promoter.nps_score}
              </Badge>
            )}
            <Badge variant="outline" className={cn('text-xs capitalize', statusColor)}>
              {promoter.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {[promoter.email, promoter.phone].filter(Boolean).join(' · ') || 'No contact info'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold">{promoter.referral_codes.reduce((s, c) => s + c.clicks, 0)} clicks</p>
          <p className="text-xs text-muted-foreground">{promoter.referral_codes.length} code{promoter.referral_codes.length !== 1 ? 's' : ''}</p>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t bg-muted/10 px-5 py-4 space-y-4">
          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onGenerateCode}>
              <Link2 className="h-3 w-3 mr-1.5" />
              Generate referral code
            </Button>
            {promoter.status !== 'active' && (
              <Button size="sm" variant="outline" onClick={() => onStatusChange('active')}>
                <UserCheck className="h-3 w-3 mr-1.5" />Activate
              </Button>
            )}
            {promoter.status === 'active' && (
              <Button size="sm" variant="outline" onClick={() => onStatusChange('paused')}>
                <Pause className="h-3 w-3 mr-1.5" />Pause
              </Button>
            )}
            {promoter.status !== 'removed' && (
              <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => onStatusChange('removed')}>
                <UserX className="h-3 w-3 mr-1.5" />Remove
              </Button>
            )}
          </div>

          {/* Code generator form */}
          {showCodeForm && (
            <GenerateCodeForm
              promoterId={promoter.id}
              onSaved={onCodeSaved}
              onCancel={onGenerateCode}
            />
          )}

          {/* Notes */}
          {promoter.notes && (
            <p className="text-xs text-muted-foreground italic">"{promoter.notes}"</p>
          )}

          {/* Referral codes table */}
          {promoter.referral_codes.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[480px]">
                  <thead className="bg-muted border-b">
                    <tr>
                      {['Code', 'Label', 'Clicks', 'Uniq', 'Conv.', 'Revenue', ''].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {promoter.referral_codes.map(c => (
                      <ReferralCodeRow key={c.id} code={c} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ReferralCodeRow({ code }: { code: ReferralCode }) {
  const [copied, setCopied] = useState(false)

  const copyLink = async () => {
    const link = `${window.location.origin}/ref/${code.code}`
    await navigator.clipboard.writeText(link)
    setCopied(true)
    toast.success('Referral link copied')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <tr className={cn('hover:bg-muted/20', !code.is_active && 'opacity-50')}>
      <td className="px-3 py-2 font-mono font-bold">{code.code}</td>
      <td className="px-3 py-2 text-muted-foreground">{code.label ?? '—'}</td>
      <td className="px-3 py-2">{code.clicks}</td>
      <td className="px-3 py-2">{code.unique_clicks}</td>
      <td className="px-3 py-2">{code.conversions}</td>
      <td className="px-3 py-2">{formatNGN(code.attributed_revenue)}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <button onClick={copyLink} className="p-1 hover:bg-muted rounded" title="Copy referral link">
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </button>
          <a href={code.destination_url} target="_blank" rel="noreferrer" className="p-1 hover:bg-muted rounded">
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </td>
    </tr>
  )
}

function GenerateCodeForm({ promoterId, onSaved, onCancel }: { promoterId: string; onSaved: () => void; onCancel: () => void }) {
  const [label, setLabel]           = useState('')
  const [destination, setDest]      = useState('')
  const [saving, setSaving]         = useState(false)

  const handleSave = async () => {
    if (!destination) { toast.error('Destination URL is required'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/promoters/${promoterId}/referral-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label || undefined, destination_url: destination }),
      })
      if (!res.ok) {
        const e = await res.json()
        toast.error(e.error ?? 'Failed to generate code')
        return
      }
      const { code } = await res.json()
      toast.success(`Code ${code.code} generated`)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Generate referral code</p>
        <button onClick={onCancel}><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Label (optional)</Label>
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Summer campaign" className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Destination URL *</Label>
          <Input value={destination} onChange={e => setDest(e.target.value)} placeholder="https://yourbrand.com/offer" className="mt-1 h-8 text-sm" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Generate code
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function AddPromoterForm({ onSave, onCancel }: { onSave: (d: Record<string, unknown>) => void; onCancel: () => void }) {
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSave] = useState(false)

  const handle = async () => {
    if (!name.trim()) { toast.error('Name is required'); return }
    setSave(true)
    await onSave({ name, email, phone, notes, source: 'manual' })
    setSave(false)
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm">Add promoter</p>
        <button onClick={onCancel}><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Email</Label>
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="person@example.com" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Phone</Label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+2348012345678" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Notes</Label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Top customer, June NPS" className="mt-1" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handle} disabled={saving}>
          {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Add promoter
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function CandidateRow({
  candidate, onActivate,
}: {
  candidate:  NpsCandidate
  onActivate: (name: string, email: string) => void
}) {
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [open, setOpen]   = useState(false)

  return (
    <div className="bg-white/60 rounded-lg border border-green-100 px-3 py-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-200 font-bold text-green-800 text-[11px]">
          {candidate.score}
        </span>
        <span className="flex-1 text-muted-foreground line-clamp-1">
          {candidate.verbatim ?? 'Score only — no verbatim'} ·{' '}
          {new Date(candidate.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' })}
        </span>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="text-green-700 font-medium hover:underline"
          >
            Activate
          </button>
        )}
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap gap-2 items-end">
          <input
            className="border rounded px-2 py-1 text-xs w-36"
            placeholder="Name"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <input
            className="border rounded px-2 py-1 text-xs w-44"
            placeholder="Email (optional)"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <button
            onClick={() => { if (!name.trim()) return; onActivate(name, email); setOpen(false) }}
            className="bg-green-600 text-white text-xs px-3 py-1 rounded"
          >
            Save
          </button>
          <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground">Cancel</button>
        </div>
      )}
    </div>
  )
}

async function activateCandidate(
  candidate: NpsCandidate,
  name: string,
  email: string,
  reload: () => void,
) {
  const res = await fetch('/api/promoters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      email:              email || undefined,
      source:             'nps',
      source_response_id: candidate.id,
      nps_score:          candidate.score,
      status:             'invited',
    }),
  })
  if (!res.ok) { toast.error('Failed to activate promoter'); return }
  toast.success(`${name} added as promoter`)
  reload()
}
