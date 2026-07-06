'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Database, RefreshCw, Search, Loader2, Users,
  Star, Minus, ThumbsDown, ShieldCheck, Activity,
  Mail, Phone, Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn, formatNGN } from '@/lib/utils'
import { toast } from 'sonner'
import { TourTrigger } from '@/components/tours/tour-trigger'

interface CustomerProfile {
  id:                   string
  email:                string | null
  phone:                string | null
  name:                 string | null
  first_seen_at:        string | null
  last_seen_at:         string | null
  acquisition_source:   string | null
  total_orders:         number
  total_spend:          number
  nps_score:            number | null
  nps_label:            string | null
  is_promoter:          boolean
  retention_risk_score: number
  segments:             string[]
  sources:              Record<string, boolean>
  last_synced_at:       string | null
}

const NPS_ICON = {
  promoter:  <Star className="h-3 w-3 text-green-500" />,
  passive:   <Minus className="h-3 w-3 text-yellow-500" />,
  detractor: <ThumbsDown className="h-3 w-3 text-red-500" />,
}

const SOURCE_LABEL: Record<string, string> = {
  survey:     'Survey',
  whatsapp:   'WhatsApp',
  app_review: 'App Review',
  ecommerce:  'Ecommerce',
}

export function CdpClient() {
  const [profiles, setProfiles] = useState<CustomerProfile[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [syncing, setSyncing]   = useState(false)
  const [search, setSearch]     = useState('')
  const [npsFilter, setNpsFilter] = useState('')
  const [page, setPage]         = useState(1)
  const searchTimer             = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (q: string, nps: string, pg: number) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(pg) })
    if (q)   params.set('q', q)
    if (nps) params.set('nps_label', nps)
    const res = await fetch(`/api/cdp/profiles?${params}`)
    if (res.ok) {
      const d = await res.json()
      setProfiles(d.profiles ?? [])
      setTotal(d.total ?? 0)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load(search, npsFilter, page) }, [page, npsFilter, load, search])

  // Debounced search
  const handleSearch = (v: string) => {
    setSearch(v)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setPage(1); load(v, npsFilter, 1) }, 350)
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/cdp/sync', { method: 'POST' })
      if (!res.ok) throw new Error('Sync failed')
      const d = await res.json()
      toast.success(`Sync complete — ${d.synced} profiles processed`)
      load(search, npsFilter, page)
    } catch {
      toast.error('Sync failed. Please try again.')
    } finally {
      setSyncing(false)
    }
  }

  const totalPages = Math.ceil(total / 50)

  const promoters  = profiles.filter(p => p.nps_label === 'promoter').length
  const passives   = profiles.filter(p => p.nps_label === 'passive').length
  const detractors = profiles.filter(p => p.nps_label === 'detractor').length
  const atRisk     = profiles.filter(p => p.retention_risk_score >= 50).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Customer Data Platform</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Unified profiles merged from surveys, WhatsApp, and reviews
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <TourTrigger module="cdp" autoStart />
          <Button onClick={handleSync} disabled={syncing} size="sm">
            {syncing
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing...</>
              : <><RefreshCw className="h-4 w-4 mr-2" />Sync data</>}
          </Button>
        </div>
      </div>

      {/* KPI chips */}
      <div className="flex flex-wrap gap-2" data-tour="cdp-main">
        <KpiChip icon={<Users className="h-3 w-3" />}      label="Total profiles"   value={total} />
        <KpiChip icon={<Star className="h-3 w-3 text-green-500" />}     label="Promoters"   value={promoters} />
        <KpiChip icon={<Minus className="h-3 w-3 text-yellow-500" />}   label="Passives"    value={passives} />
        <KpiChip icon={<ThumbsDown className="h-3 w-3 text-red-500" />} label="Detractors"  value={detractors} />
        <KpiChip icon={<Activity className="h-3 w-3 text-orange-500" />} label="At risk"    value={atRisk} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, email or phone..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {['', 'promoter', 'passive', 'detractor'].map(v => (
            <button
              key={v}
              onClick={() => { setNpsFilter(v); setPage(1); load(search, v, 1) }}
              className={cn(
                'px-3 py-1.5 rounded-full border text-xs font-medium transition-colors capitalize',
                npsFilter === v
                  ? 'bg-foreground text-background border-foreground'
                  : 'hover:bg-muted border-border'
              )}
            >
              {v || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {!loading && profiles.length === 0 && total === 0 && (
        <div className="rounded-xl border border-dashed p-16 text-center">
          <Database className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <p className="font-medium">No customer profiles yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Click "Sync data" to merge customer records from your surveys, WhatsApp contacts, and app reviews.
          </p>
          <Button className="mt-4" size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sync now
          </Button>
        </div>
      )}

      {/* Profile grid */}
      {loading && profiles.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {profiles.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map(p => <ProfileCard key={p.id} profile={p} />)}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function KpiChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-card text-xs">
      {icon}
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-semibold">{value.toLocaleString()}</span>
    </div>
  )
}

function ProfileCard({ profile }: { profile: CustomerProfile }) {
  const riskColor =
    profile.retention_risk_score >= 70 ? 'border-red-300 bg-red-50/30' :
    profile.retention_risk_score >= 45 ? 'border-orange-200 bg-orange-50/20' :
    'border-border bg-card'

  const activeSources = Object.entries(profile.sources)
    .filter(([, v]) => v)
    .map(([k]) => SOURCE_LABEL[k] ?? k)

  return (
    <div className={cn('rounded-xl border p-4 space-y-3 hover:shadow-sm transition-shadow', riskColor)}>
      {/* Identity */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">
            {profile.name ?? profile.email ?? profile.phone ?? 'Unknown'}
          </p>
          {profile.email && profile.name && (
            <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {profile.is_promoter && (
            <Badge variant="outline" className="text-xs border-green-300 text-green-700">Promoter</Badge>
          )}
          {profile.nps_label && (
            <div className="flex items-center gap-1">
              {NPS_ICON[profile.nps_label as keyof typeof NPS_ICON]}
            </div>
          )}
        </div>
      </div>

      {/* Contact */}
      <div className="space-y-1 text-xs text-muted-foreground">
        {profile.email && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{profile.email}</span>
          </div>
        )}
        {profile.phone && (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3 w-3 shrink-0" />
            <span>{profile.phone}</span>
          </div>
        )}
        {profile.last_seen_at && (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3 shrink-0" />
            <span>Last seen {new Date(profile.last_seen_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' })}</span>
          </div>
        )}
      </div>

      {/* NPS / Risk row */}
      <div className="flex items-center gap-2 flex-wrap">
        {profile.nps_score !== null && (
          <Badge variant="outline" className={cn(
            'text-xs',
            profile.nps_label === 'promoter' ? 'border-green-300 text-green-700' :
            profile.nps_label === 'detractor' ? 'border-red-300 text-red-700' :
            'border-yellow-300 text-yellow-700'
          )}>
            NPS {profile.nps_score} · {profile.nps_label}
          </Badge>
        )}
        {profile.retention_risk_score >= 45 && (
          <Badge variant="outline" className={cn(
            'text-xs',
            profile.retention_risk_score >= 70 ? 'border-red-300 text-red-700' : 'border-orange-300 text-orange-700'
          )}>
            Risk: {profile.retention_risk_score}
          </Badge>
        )}
      </div>

      {/* Sources */}
      <div className="flex flex-wrap gap-1">
        {activeSources.map(s => (
          <span key={s} className="px-1.5 py-0.5 rounded-sm bg-muted text-[10px] font-medium text-muted-foreground">
            {s}
          </span>
        ))}
      </div>

      {/* Spend */}
      {profile.total_spend > 0 && (
        <div className="flex items-center justify-between text-xs border-t pt-2 mt-1">
          <span className="text-muted-foreground">{profile.total_orders} orders</span>
          <span className="font-semibold">{formatNGN(profile.total_spend)}</span>
        </div>
      )}
    </div>
  )
}
