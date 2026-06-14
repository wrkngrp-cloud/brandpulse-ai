'use client'

import { useState } from 'react'
import {
  Users, Star, AlertCircle, TrendingUp, Loader2,
  Plus, X, Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

export interface Influencer {
  id: string
  brand_id: string
  name: string
  handle: string
  platform: string
  category: string | null
  followers: number | null
  cultural_iq: number | null
  risk_score: number | null
  ai_notes: string | null
  status: string
  campaign_id: string | null
  created_at: string
  updated_at: string
}

interface Props {
  brandId: string
  brandName: string
  initialInfluencers: Influencer[]
}

const PLATFORMS = ['Instagram', 'TikTok', 'Twitter', 'YouTube', 'Facebook'] as const
type Platform = typeof PLATFORMS[number]

function formatFollowers(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function PlatformIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase()
  if (p === 'tiktok') return <TrendingUp className="h-3.5 w-3.5" />
  return <Globe className="h-3.5 w-3.5" />
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    prospect: 'bg-muted text-muted-foreground',
    active:   'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    paused:   'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', map[status] ?? 'bg-muted text-muted-foreground')}>
      {status}
    </span>
  )
}

function CulturalIQBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-xs text-muted-foreground">Not scored</span>
  }
  const color = score >= 70
    ? 'text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
    : score >= 50
    ? 'text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400'
    : 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400'
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', color)}>
      {score}
    </span>
  )
}

function RiskBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>
  if (score < 30) {
    return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Low risk</span>
  }
  if (score <= 60) {
    return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Medium</span>
  }
  return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">High risk</span>
}

export function InfluencersClient({ brandId, brandName, initialInfluencers }: Props) {
  const [influencers, setInfluencers] = useState<Influencer[]>(initialInfluencers)
  const [showForm, setShowForm] = useState(false)
  const [scoringId, setScoringId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [platform, setPlatform] = useState<Platform | ''>('')
  const [category, setCategory] = useState('')
  const [followers, setFollowers] = useState('')

  // Derived stats
  const total = influencers.length
  const activeCount = influencers.filter(i => i.status === 'active').length
  const scored = influencers.filter(i => i.cultural_iq !== null)
  const avgCulturalIQ = scored.length
    ? Math.round(scored.reduce((sum, i) => sum + i.cultural_iq!, 0) / scored.length)
    : null
  const highRiskCount = influencers.filter(i => i.risk_score !== null && i.risk_score > 60).length

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!platform) {
      toast.error('Please select a platform.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/influencers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          handle: handle.trim(),
          platform,
          category: category.trim() || undefined,
          followers: followers ? Number(followers) : undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to add influencer.')
      }
      const { influencer } = await res.json()
      setInfluencers(prev => [influencer, ...prev])
      setName('')
      setHandle('')
      setPlatform('')
      setCategory('')
      setFollowers('')
      setShowForm(false)
      toast.success(`${influencer.name} added.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleScore(id: string) {
    setScoringId(id)
    try {
      const res = await fetch(`/api/influencers/${id}/score`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Scoring failed.')
      }
      const { influencer: updated } = await res.json()
      setInfluencers(prev => prev.map(i => (i.id === id ? updated : i)))
      toast.success('Scored successfully.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scoring failed.')
    } finally {
      setScoringId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Influencer Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Discover, score, and track creators for your brand.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowForm(v => !v)}
          variant={showForm ? 'outline' : 'default'}
          className="shrink-0"
        >
          {showForm ? (
            <><X className="h-4 w-4 mr-1.5" /> Cancel</>
          ) : (
            <><Plus className="h-4 w-4 mr-1.5" /> Add influencer</>
          )}
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border rounded-xl p-4 bg-card space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">Total</span>
          </div>
          <p className="text-2xl font-bold">{total}</p>
        </div>
        <div className="border rounded-xl p-4 bg-card space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium">Active</span>
          </div>
          <p className="text-2xl font-bold">{activeCount}</p>
        </div>
        <div className="border rounded-xl p-4 bg-card space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Star className="h-4 w-4" />
            <span className="text-xs font-medium">Avg Cultural IQ</span>
          </div>
          <p className="text-2xl font-bold">{avgCulturalIQ !== null ? avgCulturalIQ : '—'}</p>
        </div>
        <div className="border rounded-xl p-4 bg-card space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs font-medium">High risk</span>
          </div>
          <p className="text-2xl font-bold">{highRiskCount}</p>
        </div>
      </div>

      {/* Add influencer form */}
      {showForm && (
        <div className="border rounded-xl p-5 bg-card">
          <h2 className="text-sm font-semibold mb-4">Add influencer</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="inf-name">Name</Label>
                <Input
                  id="inf-name"
                  placeholder="Creator name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inf-handle">Handle</Label>
                <Input
                  id="inf-handle"
                  placeholder="@handle"
                  value={handle}
                  onChange={e => setHandle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inf-platform">Platform</Label>
                <Select value={platform} onValueChange={v => setPlatform(v as Platform)}>
                  <SelectTrigger id="inf-platform">
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inf-category">Category</Label>
                <Input
                  id="inf-category"
                  placeholder="e.g. Fashion, Tech, Food"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="inf-followers">Followers</Label>
                <Input
                  id="inf-followers"
                  type="number"
                  min={0}
                  placeholder="e.g. 45000"
                  value={followers}
                  onChange={e => setFollowers(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                {submitting ? 'Adding...' : 'Add influencer'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Influencer list */}
      {influencers.length === 0 ? (
        <div className="border rounded-xl p-12 text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm">No influencers yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add your first creator to get started.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add influencer
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {influencers.map(inf => (
            <div key={inf.id} className="border rounded-xl p-4 bg-card hover:bg-muted/20 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                {/* Left: name + handle + meta */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{inf.name}</span>
                    <StatusBadge status={inf.status} />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <PlatformIcon platform={inf.platform} />
                    <span>@{inf.handle.replace(/^@/, '')} on {inf.platform}</span>
                    {inf.category && (
                      <><span className="text-muted-foreground/40">·</span><span>{inf.category}</span></>
                    )}
                  </div>
                  {inf.ai_notes && (
                    <p className="text-xs text-muted-foreground leading-snug line-clamp-2 pt-0.5">
                      {inf.ai_notes}
                    </p>
                  )}
                </div>

                {/* Right: scores + followers + action */}
                <div className="flex flex-row sm:flex-col items-start sm:items-end gap-3 sm:gap-2 shrink-0 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {inf.followers !== null && (
                      <span className="text-xs text-muted-foreground font-medium">
                        {formatFollowers(inf.followers)} followers
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3" />
                      <span>Cultural IQ:</span>
                    </div>
                    <CulturalIQBadge score={inf.cultural_iq} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <AlertCircle className="h-3 w-3" />
                      <span>Risk:</span>
                    </div>
                    <RiskBadge score={inf.risk_score} />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2.5"
                    disabled={scoringId === inf.id}
                    onClick={() => handleScore(inf.id)}
                  >
                    {scoringId === inf.id ? (
                      <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Scoring...</>
                    ) : (
                      'Score with AI'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
