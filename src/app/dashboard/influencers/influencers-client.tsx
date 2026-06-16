'use client'

import { useState } from 'react'
import {
  Users, Star, AlertCircle, TrendingUp, Loader2,
  Plus, X, Globe, ChevronDown, Eye,
  Megaphone, Filter,
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
  profile_url?: string | null
  social_urls?: SocialUrl[]
  profile_data?: ProfileData
  brand_fit?: BrandFit
}

interface SocialUrl {
  platform: string
  handle: string
  url?: string
}

interface AudienceDemographics {
  age_range: string
  primary_location: string
  interests: string[]
}

interface OnlineReputation {
  positive_signals: string[]
  negative_signals: string[]
  controversy_flags: string[]
  summary: string
}

interface EstimatedFollowers {
  instagram: number
  tiktok: number
  twitter: number
  youtube: number
  total: number
}

interface ProfileData {
  bio?: string
  content_types?: string[]
  posting_frequency?: string
  audience_demographics?: AudienceDemographics
  engagement_rate_estimate?: number
  online_reputation?: OnlineReputation
  estimated_followers?: EstimatedFollowers
}

interface BrandFit {
  score: number
  audience_overlap: number
  value_alignment: string
  risk_factors: string[]
  positive_indicators: string[]
  recommendation: 'strong_fit' | 'potential_fit' | 'poor_fit'
  recommendation_notes: string
}

interface AnalysisResult {
  name: string | null
  category: string
  estimated_followers: EstimatedFollowers
  profile_data: ProfileData
  brand_fit: BrandFit
}

interface CampaignOption {
  id: string
  name: string
  status: string
}

interface Props {
  brandId: string
  brandName: string
  initialInfluencers: Influencer[]
  campaigns?: CampaignOption[]
}

const PLATFORMS = ['instagram', 'tiktok', 'twitter', 'youtube', 'facebook'] as const
type Platform = typeof PLATFORMS[number]

function toTitleCase(s: string): string {
  if (s === 'tiktok') return 'TikTok'
  if (s === 'youtube') return 'YouTube'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function detectPlatform(input: string): Platform | '' {
  const lower = input.toLowerCase()
  if (lower.includes('instagram.com')) return 'instagram'
  if (lower.includes('tiktok.com')) return 'tiktok'
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'twitter'
  if (lower.includes('youtube.com')) return 'youtube'
  if (lower.includes('facebook.com')) return 'facebook'
  return ''
}

function parseHandle(input: string): string {
  try {
    const url = new URL(input.startsWith('http') ? input : `https://${input}`)
    const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/')
    return parts[parts.length - 1] || input
  } catch {
    return input.replace(/^@/, '').trim()
  }
}

function formatFollowers(n: number | null | undefined): string {
  if (n == null) return '—'
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

function RecommendationBadge({ recommendation }: { recommendation: string | undefined }) {
  if (!recommendation) return null
  const map: Record<string, { label: string; className: string }> = {
    strong_fit:    { label: 'Strong fit',    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    potential_fit: { label: 'Potential fit', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
    poor_fit:      { label: 'Poor fit',      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  }
  const config = map[recommendation]
  if (!config) return null
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', config.className)}>
      {config.label}
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

function BrandFitScore({ score }: { score: number }) {
  const color = score >= 70
    ? 'text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
    : score >= 40
    ? 'text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400'
    : 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400'
  return (
    <span className={cn('text-sm font-bold px-2.5 py-1 rounded-lg', color)}>
      {score}/100
    </span>
  )
}

interface SocialEntry {
  input: string
  platform: Platform | ''
}

// ── Campaign tab types ────────────────────────────────────────────────────────

interface LinkedInfluencer {
  id: string
  name: string
  handle: string
  platform: string
  category: string | null
  followers: number | null
  cultural_iq: number | null
  campaign_id: string
  campaignName: string
}

function formatNGN(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`
  return `₦${n.toLocaleString()}`
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}


export function InfluencersClient({ brandId, brandName, initialInfluencers, campaigns = [] }: Props) {
  const [activeTab, setActiveTab] = useState<'intelligence' | 'campaigns'>('intelligence')
  const [influencers, setInfluencers] = useState<Influencer[]>(initialInfluencers)
  const [showForm, setShowForm] = useState(false)
  const [scoringId, setScoringId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)

  // Campaign filter
  const [campaignFilter, setCampaignFilter] = useState<string>('all')

  // Form state
  const [name, setName] = useState('')
  const [entries, setEntries] = useState<SocialEntry[]>([{ input: '', platform: '' }])

  // Derived stats
  const total = influencers.length
  const activeCount = influencers.filter(i => i.status === 'active').length
  const scored = influencers.filter(i => i.cultural_iq !== null)
  const avgCulturalIQ = scored.length
    ? Math.round(scored.reduce((sum, i) => sum + i.cultural_iq!, 0) / scored.length)
    : null
  const highRiskCount = influencers.filter(i => i.risk_score !== null && i.risk_score > 60).length

  function updateEntry(index: number, field: keyof SocialEntry, value: string) {
    setEntries(prev => {
      const next = [...prev]
      if (field === 'input') {
        const detected = detectPlatform(value)
        next[index] = { input: value, platform: detected || next[index].platform }
      } else {
        next[index] = { ...next[index], platform: value as Platform | '' }
      }
      return next
    })
  }

  function addEntry() {
    setEntries(prev => [...prev, { input: '', platform: '' }])
  }

  function removeEntry(index: number) {
    setEntries(prev => prev.filter((_, i) => i !== index))
  }

  function resetForm() {
    setName('')
    setEntries([{ input: '', platform: '' }])
    setAnalysis(null)
  }

  function buildHandles() {
    return entries
      .filter(e => e.input.trim())
      .map(e => ({
        platform: e.platform || 'instagram',
        handle:   parseHandle(e.input),
        url:      e.input.startsWith('http') || e.input.includes('.com') ? e.input : undefined,
      }))
  }

  async function handleAnalyse() {
    const handles = buildHandles()
    if (!handles.length) {
      toast.error('Enter at least one handle or URL.')
      return
    }
    const missingPlatform = entries.some(e => e.input.trim() && !e.platform)
    if (missingPlatform) {
      toast.error('Please select a platform for each handle.')
      return
    }
    setAnalysing(true)
    setAnalysis(null)
    try {
      const res = await fetch('/api/influencers/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handles }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Analysis failed.')
      }
      const data: AnalysisResult = await res.json()
      setAnalysis(data)
      if (data.name && !name.trim()) setName(data.name)
      toast.success('Profile analysed.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed.')
    } finally {
      setAnalysing(false)
    }
  }

  async function handleSave() {
    const handles = buildHandles()
    if (!name.trim()) {
      toast.error('Name is required.')
      return
    }
    if (!handles.length) {
      toast.error('Add at least one handle.')
      return
    }
    const primary = handles[0]
    setSubmitting(true)
    try {
      const totalFollowers = analysis?.estimated_followers?.total ?? null
      const res = await fetch('/api/influencers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:         name.trim(),
          handle:       primary.handle,
          platform:     primary.platform,
          category:     analysis?.category ?? undefined,
          followers:    totalFollowers ?? undefined,
          social_urls:  handles,
          profile_data: analysis?.profile_data ?? undefined,
          brand_fit:    analysis?.brand_fit ?? undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to add influencer.')
      }
      const { influencer } = await res.json()
      setInfluencers(prev => [influencer, ...prev])
      resetForm()
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

  const _ = brandId // used by parent for RLS context
  void brandName

  // Derive linked influencers from real DB data only
  const campaignMap = new Map((campaigns ?? []).map(c => [c.id, c.name]))
  const linkedInfluencers: LinkedInfluencer[] = influencers
    .filter(i => i.campaign_id !== null)
    .map(i => ({
      id:           i.id,
      name:         i.name,
      handle:       i.handle,
      platform:     i.platform,
      category:     i.category,
      followers:    i.followers,
      cultural_iq:  i.cultural_iq,
      campaign_id:  i.campaign_id!,
      campaignName: campaignMap.get(i.campaign_id!) ?? 'Campaign',
    }))

  const uniqueCampaigns = Array.from(new Set(linkedInfluencers.map(i => i.campaignName)))

  const filteredLinked = linkedInfluencers.filter(i => {
    return campaignFilter === 'all' || i.campaignName === campaignFilter
  })

  // Combined potential reach from linked influencers' follower counts
  const totalPotentialReach = linkedInfluencers.reduce((s, i) => s + (i.followers ?? 0), 0)

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
        {activeTab === 'intelligence' && (
          <Button
            size="sm"
            onClick={() => { setShowForm(v => !v); if (showForm) resetForm() }}
            variant={showForm ? 'outline' : 'default'}
            className="shrink-0"
          >
            {showForm ? (
              <><X className="h-4 w-4 mr-1.5" /> Cancel</>
            ) : (
              <><Plus className="h-4 w-4 mr-1.5" /> Add influencer</>
            )}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab('intelligence')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'intelligence'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Intelligence</span>
        </button>
        <button
          onClick={() => setActiveTab('campaigns')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'campaigns'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <span className="flex items-center gap-1.5"><Megaphone className="h-3.5 w-3.5" />Campaigns</span>
        </button>
      </div>

      {/* ── Intelligence Tab ── */}
      {activeTab === 'intelligence' && (
        <>
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
            <div className="border rounded-xl p-5 bg-card space-y-5">
              <h2 className="text-sm font-semibold">Add influencer</h2>

              {/* Social profile inputs */}
              <div className="space-y-3">
                <Label>Social profiles</Label>
                {entries.map((entry, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      placeholder="instagram.com/handle or @handle"
                      value={entry.input}
                      onChange={e => updateEntry(i, 'input', e.target.value)}
                      className="flex-1"
                    />
                    <Select
                      value={entry.platform}
                      onValueChange={v => updateEntry(i, 'platform', v ?? '')}
                    >
                      <SelectTrigger className="w-[130px] shrink-0">
                        <SelectValue placeholder="Platform">
                          {entry.platform ? toTitleCase(entry.platform) : <span className="text-muted-foreground flex items-center gap-1">Platform <ChevronDown className="h-3 w-3" /></span>}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {PLATFORMS.map(p => (
                          <SelectItem key={p} value={p}>{toTitleCase(p)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {entries.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeEntry(i)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="ghost" size="sm" onClick={addEntry} className="text-xs h-7 px-2">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add another platform
                </Button>
              </div>

              {/* Analyse button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAnalyse}
                disabled={analysing}
                className="w-full"
              >
                {analysing && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                {analysing ? 'Analysing...' : 'Analyse Profile'}
              </Button>

              {/* Analysis preview */}
              {analysis && <AnalysisPreview analysis={analysis} />}

              {/* Name input */}
              <div className="space-y-1.5">
                <Label htmlFor="inf-name">Name</Label>
                <Input
                  id="inf-name"
                  placeholder="Creator name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              {/* Save button */}
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={submitting}
                  onClick={handleSave}
                >
                  {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  {submitting ? 'Saving...' : 'Save Influencer'}
                </Button>
              </div>
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
                <InfluencerCard
                  key={inf.id}
                  inf={inf}
                  scoringId={scoringId}
                  onScore={handleScore}
                  availableCampaigns={campaigns}
                  onLinked={(influencerId, campaignId) => {
                    setInfluencers(prev => prev.map(i =>
                      i.id === influencerId ? { ...i, campaign_id: campaignId } : i
                    ))
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Campaigns Tab ── */}
      {activeTab === 'campaigns' && (
        <CampaignsTab
          linked={filteredLinked}
          uniqueCampaigns={uniqueCampaigns}
          campaignFilter={campaignFilter}
          onCampaignFilter={(v) => setCampaignFilter(v ?? 'all')}
          totalPotentialReach={totalPotentialReach}
          totalLinked={linkedInfluencers.length}
        />
      )}
    </div>
  )
}

// ── Campaigns Tab Component ────────────────────────────────────────────────

function CampaignsTab({
  linked,
  uniqueCampaigns,
  campaignFilter,
  onCampaignFilter,
  totalPotentialReach,
  totalLinked,
}: {
  linked: LinkedInfluencer[]
  uniqueCampaigns: string[]
  campaignFilter: string
  onCampaignFilter: (v: string) => void
  totalPotentialReach: number
  totalLinked: number
}) {
  if (totalLinked === 0) {
    return (
      <div className="border rounded-xl p-12 text-center space-y-3">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto">
          <Megaphone className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium text-sm">No influencers linked to campaigns yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Go to the Intelligence tab, open an influencer profile, and link them to a campaign.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border rounded-xl p-4 bg-card space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">Linked Influencers</span>
          </div>
          <p className="text-xl font-bold">{totalLinked}</p>
        </div>
        <div className="border rounded-xl p-4 bg-card space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Eye className="h-4 w-4" />
            <span className="text-xs font-medium">Combined Potential Reach</span>
          </div>
          <p className="text-xl font-bold">{totalPotentialReach > 0 ? formatCount(totalPotentialReach) : '—'}</p>
        </div>
      </div>

      {/* Influencer list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold">Linked to Campaigns</h2>
          {uniqueCampaigns.length > 1 && (
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={campaignFilter} onValueChange={v => v && onCampaignFilter(v)}>
                <SelectTrigger className="h-8 text-xs w-[180px]">
                  <SelectValue placeholder="All Campaigns" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campaigns</SelectItem>
                  {uniqueCampaigns.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {linked.length === 0 ? (
          <div className="border rounded-xl p-8 text-center">
            <p className="text-sm text-muted-foreground">No influencers match this filter.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {linked.map(inf => (
              <div key={inf.id} className="border rounded-xl p-4 bg-card space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{inf.name}</span>
                      <span className="text-xs text-muted-foreground">{inf.handle.startsWith('@') ? inf.handle : `@${inf.handle}`}</span>
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium">{toTitleCase(inf.platform)}</span>
                      {inf.category && (
                        <span className="text-xs text-muted-foreground">{inf.category}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Campaign: <span className="font-medium text-foreground">{inf.campaignName}</span>
                    </p>
                  </div>
                  {inf.cultural_iq !== null && (
                    <CulturalIQBadge score={inf.cultural_iq} />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1 border-t">
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Followers</p>
                    <p className="text-sm font-semibold">{inf.followers !== null ? formatCount(inf.followers) : '—'}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Cultural IQ</p>
                    <p className="text-sm font-semibold">{inf.cultural_iq !== null ? `${inf.cultural_iq}/100` : '—'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AnalysisPreview({ analysis }: { analysis: AnalysisResult }) {
  const pd = analysis.profile_data
  const bf = analysis.brand_fit
  const ef = analysis.estimated_followers

  return (
    <div className="border rounded-xl p-4 bg-muted/30 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Profile Analysis</h3>
        {analysis.category && (
          <Badge variant="secondary" className="text-xs">{analysis.category}</Badge>
        )}
      </div>

      {/* Followers */}
      {ef && ef.total > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Estimated Followers</p>
          <div className="flex flex-wrap gap-2">
            {ef.instagram > 0 && <FollowerChip platform="Instagram" count={ef.instagram} />}
            {ef.tiktok > 0 && <FollowerChip platform="TikTok" count={ef.tiktok} />}
            {ef.twitter > 0 && <FollowerChip platform="Twitter" count={ef.twitter} />}
            {ef.youtube > 0 && <FollowerChip platform="YouTube" count={ef.youtube} />}
            <span className="text-xs font-semibold text-foreground self-center">
              Total: {formatFollowers(ef.total)}
            </span>
          </div>
        </div>
      )}

      {/* Content types */}
      {pd?.content_types && pd.content_types.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Content Types</p>
          <div className="flex flex-wrap gap-1.5">
            {pd.content_types.map(ct => (
              <Badge key={ct} variant="outline" className="text-xs">{ct}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Demographics */}
      {pd?.audience_demographics && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Audience Demographics</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span>Age: <span className="text-foreground font-medium">{pd.audience_demographics.age_range}</span></span>
            <span>Location: <span className="text-foreground font-medium">{pd.audience_demographics.primary_location}</span></span>
          </div>
          {pd.audience_demographics.interests?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {pd.audience_demographics.interests.map(i => (
                <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded">{i}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Engagement */}
      {pd?.engagement_rate_estimate != null && (
        <div className="text-xs">
          <span className="text-muted-foreground">Engagement rate: </span>
          <span className="font-semibold">{(pd.engagement_rate_estimate * 100).toFixed(1)}%</span>
        </div>
      )}

      {/* Online reputation */}
      {pd?.online_reputation && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Online Reputation</p>
          {pd.online_reputation.positive_signals?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {pd.online_reputation.positive_signals.map(s => (
                <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">{s}</span>
              ))}
            </div>
          )}
          {pd.online_reputation.negative_signals?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {pd.online_reputation.negative_signals.map(s => (
                <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">{s}</span>
              ))}
            </div>
          )}
          {pd.online_reputation.controversy_flags?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {pd.online_reputation.controversy_flags.map(s => (
                <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">{s}</span>
              ))}
            </div>
          )}
          {pd.online_reputation.summary && (
            <p className="text-xs text-muted-foreground italic">{pd.online_reputation.summary}</p>
          )}
        </div>
      )}

      {/* Brand Fit */}
      {bf && (
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Brand Fit</p>
            <BrandFitScore score={bf.score} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <span className="text-muted-foreground">Audience overlap: <span className="text-foreground font-medium">{bf.audience_overlap}%</span></span>
            <span className="text-muted-foreground col-span-2">Alignment: <span className="text-foreground">{bf.value_alignment}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Recommendation:</span>
            <RecommendationBadge recommendation={bf.recommendation} />
          </div>
          {bf.recommendation_notes && (
            <p className="text-xs text-muted-foreground">{bf.recommendation_notes}</p>
          )}
          {bf.positive_indicators?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {bf.positive_indicators.map(p => (
                <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">{p}</span>
              ))}
            </div>
          )}
          {bf.risk_factors?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {bf.risk_factors.map(r => (
                <span key={r} className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">{r}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FollowerChip({ platform, count }: { platform: string; count: number }) {
  return (
    <span className="text-xs bg-muted px-2 py-0.5 rounded font-medium">
      {platform}: {formatFollowers(count)}
    </span>
  )
}

function InfluencerCard({
  inf,
  scoringId,
  onScore,
  availableCampaigns = [],
  onLinked,
}: {
  inf: Influencer
  scoringId: string | null
  onScore: (id: string) => void
  availableCampaigns?: CampaignOption[]
  onLinked?: (influencerId: string, campaignId: string | null) => void
}) {
  const [linking, setLinking] = useState(false)
  const platforms = inf.social_urls?.length
    ? inf.social_urls.map(s => s.platform)
    : [inf.platform]

  const totalFollowers = (inf.profile_data as ProfileData)?.estimated_followers?.total ?? inf.followers
  const contentTypes = (inf.profile_data as ProfileData)?.content_types ?? []
  const engagementRate = (inf.profile_data as ProfileData)?.engagement_rate_estimate
  const brandFit = inf.brand_fit as BrandFit | undefined
  const riskFactors = brandFit?.risk_factors ?? []

  return (
    <div className="border rounded-xl p-4 bg-card hover:bg-muted/20 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        {/* Left: name + handle + meta */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{inf.name}</span>
            <StatusBadge status={inf.status} />
            {brandFit?.recommendation && (
              <RecommendationBadge recommendation={brandFit.recommendation} />
            )}
            {inf.campaign_id && availableCampaigns.length === 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400">
                In campaign
              </span>
            )}
            {inf.campaign_id && availableCampaigns.length > 0 && (() => {
              const linkedCampaign = availableCampaigns.find(c => c.id === inf.campaign_id)
              return linkedCampaign ? (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400 truncate max-w-[180px]">
                  {linkedCampaign.name}
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400">
                  In campaign
                </span>
              )
            })()}
          </div>

          {/* Platform chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {platforms.map(p => (
              <span key={p} className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                <PlatformIcon platform={p} />
                {toTitleCase(p)}
              </span>
            ))}
            <span className="text-xs text-muted-foreground">@{inf.handle.replace(/^@/, '')}</span>
            {inf.category && (
              <><span className="text-muted-foreground/40 text-xs">·</span><span className="text-xs text-muted-foreground">{inf.category}</span></>
            )}
          </div>

          {/* Content type tags */}
          {contentTypes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {contentTypes.slice(0, 4).map(ct => (
                <Badge key={ct} variant="outline" className="text-xs py-0 h-5">{ct}</Badge>
              ))}
            </div>
          )}

          {/* ai_notes */}
          {inf.ai_notes && (
            <p className="text-xs text-muted-foreground leading-snug line-clamp-3 pt-0.5">
              {inf.ai_notes}
            </p>
          )}

          {/* Risk factors warning */}
          {riskFactors.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {riskFactors.slice(0, 2).map(r => (
                <span key={r} className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">{r}</span>
              ))}
            </div>
          )}
        </div>

        {/* Right: scores + followers + action */}
        <div className="flex flex-row sm:flex-col items-start sm:items-end gap-3 sm:gap-2 shrink-0 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {totalFollowers != null && (
              <span className="text-xs text-muted-foreground font-medium">
                {formatFollowers(totalFollowers)} followers
              </span>
            )}
            {engagementRate != null && (
              <span className="text-xs text-muted-foreground">
                {(engagementRate * 100).toFixed(1)}% eng.
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
            onClick={() => onScore(inf.id)}
          >
            {scoringId === inf.id ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Scoring...</>
            ) : (
              'Score with AI'
            )}
          </Button>
          {availableCampaigns.length > 0 && (
            <Select
              value={inf.campaign_id ?? 'none'}
              disabled={linking}
              onValueChange={async (val) => {
                const newCampaignId = val === 'none' ? null : val
                setLinking(true)
                try {
                  const res = await fetch(`/api/influencers/${inf.id}/link-campaign`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ campaign_id: newCampaignId }),
                  })
                  if (!res.ok) throw new Error('Failed to link')
                  onLinked?.(inf.id, newCampaignId)
                  toast.success(newCampaignId ? 'Linked to campaign.' : 'Removed from campaign.')
                } catch {
                  toast.error('Could not update campaign link.')
                } finally {
                  setLinking(false)
                }
              }}
            >
              <SelectTrigger className="h-7 text-xs w-[160px]">
                <SelectValue placeholder="Link to campaign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No campaign</SelectItem>
                {availableCampaigns.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    </div>
  )
}
