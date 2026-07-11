'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Award, Plus, Users, Star, TrendingUp,
  RefreshCw, Loader2, X, Gift, Coins,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn, formatNGN } from '@/lib/utils'
import { toast } from 'sonner'
import { TourTrigger } from '@/components/tours/tour-trigger'

interface LoyaltyTier {
  id:          string
  name:        string
  min_points:  number
  max_points:  number | null
  multiplier:  number
  color:       string
  sort_order:  number
}

interface LoyaltyProgram {
  id:              string
  name:            string
  description:     string | null
  points_currency: string
  points_per_ngn:  number
  status:          string
  tiers:           LoyaltyTier[]
  member_count:    { count: number }[]
  rewards:         { id: string; name: string; points_cost: number; reward_type: string; is_active: boolean }[]
}

interface LoyaltyMember {
  id:             string
  name:           string
  email:          string | null
  phone:          string | null
  points_balance: number
  lifetime_points: number
  status:         string
  joined_at:      string
  tier:           { name: string; color: string; multiplier: number } | null
}

type Tab = 'programs' | 'members' | 'leaderboard'

export function LoyaltyClient() {
  const [tab, setTab]           = useState<Tab>('programs')
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([])
  const [members, setMembers]   = useState<LoyaltyMember[]>([])
  const [loading, setLoading]   = useState(true)
  const [showNewProg, setShowNewProg] = useState(false)
  const [showNewMember, setShowNewMember] = useState(false)
  const [awardFor, setAwardFor] = useState<string | null>(null) // member id

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [pRes, mRes] = await Promise.all([
      fetch('/api/loyalty/programs'),
      fetch('/api/loyalty/members'),
    ])
    if (pRes.ok) setPrograms((await pRes.json()).programs ?? [])
    if (mRes.ok) setMembers((await mRes.json()).members ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const totalMembers = members.length
  const activeMembers = members.filter(m => m.status === 'active').length
  const topMember = members[0] // sorted by lifetime_points desc

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Loyalty Engine</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage points programs, tiers, and member rewards</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <TourTrigger module="loyalty" autoStart />
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {totalMembers > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Users className="h-4 w-4" />}      label="Total members"  value={String(totalMembers)} />
          <StatCard icon={<Star className="h-4 w-4" />}       label="Active"         value={String(activeMembers)} />
          <StatCard icon={<Coins className="h-4 w-4" />}      label="Top earner"     value={topMember ? `${topMember.lifetime_points.toLocaleString()} pts` : '—'} />
          <StatCard icon={<Gift className="h-4 w-4" />}       label="Programs"       value={String(programs.length)} />
        </div>
      )}

      <div data-tour="loyalty-main">
      {/* Tabs */}
      <div className="flex border-b gap-1">
        {([['programs', 'Programs'], ['members', 'Members'], ['leaderboard', 'Leaderboard']] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === id ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && programs.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Programs tab */}
      {tab === 'programs' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowNewProg(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New program
            </Button>
          </div>

          {showNewProg && (
            <NewProgramForm
              onSave={async (data) => {
                const res = await fetch('/api/loyalty/programs', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
                })
                if (!res.ok) { toast.error('Failed to create program'); return }
                toast.success('Program created')
                setShowNewProg(false)
                loadAll()
              }}
              onCancel={() => setShowNewProg(false)}
            />
          )}

          {programs.length === 0 && !showNewProg && (
            <div className="rounded-xl border border-dashed p-16 text-center">
              <Award className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">No loyalty programs yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create your first program to start rewarding customers.</p>
            </div>
          )}

          <div className="space-y-3">
            {programs.map(prog => (
              <ProgramCard key={prog.id} program={prog} />
            ))}
          </div>
        </div>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowNewMember(true)} disabled={programs.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Add member
            </Button>
          </div>

          {showNewMember && (
            <AddMemberForm
              programs={programs}
              onSave={async (data) => {
                const res = await fetch('/api/loyalty/members', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
                })
                if (!res.ok) { toast.error('Failed to add member'); return }
                toast.success('Member added')
                setShowNewMember(false)
                loadAll()
              }}
              onCancel={() => setShowNewMember(false)}
            />
          )}

          {members.length === 0 && !showNewMember && (
            <div className="rounded-xl border border-dashed p-16 text-center">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">No members yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add members or sync from your CDP profiles.</p>
            </div>
          )}

          <div className="rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead className="bg-muted border-b">
                  <tr>
                    {['Member', 'Tier', 'Balance', 'Lifetime', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {members.map(m => (
                    <tr key={m.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.email ?? m.phone ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        {m.tier ? (
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                            style={{ backgroundColor: m.tier.color }}
                          >
                            {m.tier.name}
                          </span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 font-semibold">{m.points_balance.toLocaleString()}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.lifetime_points.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Badge variant={m.status === 'active' ? 'default' : 'secondary'} className="text-xs capitalize">{m.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setAwardFor(awardFor === m.id ? null : m.id)}
                          className="text-xs text-primary hover:underline"
                        >
                          Award pts
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Award points inline */}
          {awardFor && (
            <AwardPointsForm
              memberId={awardFor}
              memberName={members.find(m => m.id === awardFor)?.name ?? ''}
              onSave={async (data) => {
                const res = await fetch('/api/loyalty/transactions', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
                })
                if (!res.ok) { toast.error('Failed to award points'); return }
                const d = await res.json()
                toast.success(`Points awarded. New balance: ${d.new_balance}`)
                setAwardFor(null)
                loadAll()
              }}
              onCancel={() => setAwardFor(null)}
            />
          )}
        </div>
      )}

      {/* Leaderboard tab */}
      {tab === 'leaderboard' && (
        <div className="space-y-4">
          {members.length === 0 ? (
            <div className="rounded-xl border border-dashed p-16 text-center">
              <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm">No members to rank yet.</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <div className="px-5 py-3 border-b bg-muted/30">
                <h2 className="text-sm font-semibold">Top members by lifetime points</h2>
              </div>
              <div className="divide-y">
                {members.slice(0, 20).map((m, i) => (
                  <div key={m.id} className="flex items-center gap-4 px-5 py-3">
                    <span className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0',
                      i === 0 ? 'bg-yellow-400 text-yellow-900' :
                      i === 1 ? 'bg-gray-300 text-gray-700' :
                      i === 2 ? 'bg-orange-300 text-orange-900' :
                      'bg-muted text-muted-foreground'
                    )}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.email ?? m.phone ?? '—'}</p>
                    </div>
                    {m.tier && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: m.tier.color }}>
                        {m.tier.name}
                      </span>
                    )}
                    <div className="text-right shrink-0">
                      <p className="font-bold">{m.lifetime_points.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{m.points_balance.toLocaleString()} balance</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">{icon} {label}</div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}

function ProgramCard({ program }: { program: LoyaltyProgram }) {
  const memberCount = program.member_count?.[0]?.count ?? 0
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{program.name}</h3>
            <Badge variant={program.status === 'active' ? 'default' : 'secondary'} className="text-xs capitalize">{program.status}</Badge>
          </div>
          {program.description && <p className="text-sm text-muted-foreground mt-0.5">{program.description}</p>}
          <p className="text-xs text-muted-foreground mt-1">{program.points_per_ngn} {program.points_currency} per ₦1 · {memberCount} members</p>
        </div>
        <Award className="h-5 w-5 text-yellow-500 shrink-0" />
      </div>

      {program.tiers?.length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {program.tiers
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(t => (
              <div key={t.id} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: t.color }}>
                {t.name} · {t.min_points.toLocaleString()}+ pts
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

function NewProgramForm({ onSave, onCancel }: { onSave: (d: Record<string, unknown>) => void; onCancel: () => void }) {
  const [name, setName]     = useState('')
  const [desc, setDesc]     = useState('')
  const [curr, setCurr]     = useState('points')
  const [rate, setRate]     = useState('1')
  const [saving, setSave]   = useState(false)

  const handle = async () => {
    if (!name.trim()) { toast.error('Name required'); return }
    setSave(true)
    await onSave({ name, description: desc || undefined, points_currency: curr, points_per_ngn: parseFloat(rate) || 1 })
    setSave(false)
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm">New loyalty program</p>
        <button onClick={onCancel}><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Program name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. BrandGauge Rewards" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Points currency name</Label>
          <Input value={curr} onChange={e => setCurr(e.target.value)} placeholder="points / stars / coins" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Points per ₦1 spent</Label>
          <Input value={rate} onChange={e => setRate(e.target.value)} type="number" step="0.1" min="0.1" placeholder="1" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Description</Label>
          <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional" className="mt-1" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handle} disabled={saving}>
          {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Create
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function AddMemberForm({ programs, onSave, onCancel }: { programs: LoyaltyProgram[]; onSave: (d: Record<string, unknown>) => void; onCancel: () => void }) {
  const [programId, setProgramId] = useState(programs[0]?.id ?? '')
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [phone, setPhone]         = useState('')
  const [saving, setSave]         = useState(false)

  const handle = async () => {
    if (!name || !programId) { toast.error('Name and program required'); return }
    setSave(true)
    await onSave({ program_id: programId, name, email: email || undefined, phone: phone || undefined })
    setSave(false)
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm">Add member</p>
        <button onClick={onCancel}><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Program *</Label>
          <select value={programId} onChange={e => setProgramId(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background">
            {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">Name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Email</Label>
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="optional" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Phone</Label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+234..." className="mt-1" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handle} disabled={saving}>
          {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Add member
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function AwardPointsForm({ memberId, memberName, onSave, onCancel }: { memberId: string; memberName: string; onSave: (d: Record<string, unknown>) => void; onCancel: () => void }) {
  const [points, setPoints]   = useState('')
  const [type, setType]       = useState<'earn' | 'redeem' | 'bonus' | 'adjust'>('earn')
  const [desc, setDesc]       = useState('')
  const [saving, setSave]     = useState(false)

  const handle = async () => {
    if (!points || !desc) { toast.error('Points and description required'); return }
    const pts = parseInt(points)
    if (!pts) { toast.error('Invalid points value'); return }
    setSave(true)
    await onSave({
      member_id:        memberId,
      transaction_type: type,
      points:           type === 'redeem' ? -Math.abs(pts) : pts,
      description:      desc,
    })
    setSave(false)
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm">Award / adjust points for {memberName}</p>
        <button onClick={onCancel}><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs">Type</Label>
          <select value={type} onChange={e => setType(e.target.value as typeof type)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background">
            {['earn', 'redeem', 'bonus', 'adjust'].map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">Points</Label>
          <Input value={points} onChange={e => setPoints(e.target.value)} type="number" placeholder="100" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Description</Label>
          <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Reason..." className="mt-1" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handle} disabled={saving}>
          {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Confirm
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}
