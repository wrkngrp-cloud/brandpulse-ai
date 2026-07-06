'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Star, AlertCircle, Globe, TrendingUp, CheckCircle,
  XCircle, Loader2, ExternalLink, Users, BarChart2, Activity,
  Calendar, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { PostTracker } from '@/components/influencers/post-tracker'

// ── types ─────────────────────────────────────────────────────────────────────

interface SocialUrl {
  platform: string
  handle:   string
  url?:     string
}

interface AudienceDemographics {
  age_range:        string
  primary_location: string
  interests:        string[]
}

interface OnlineReputation {
  positive_signals:  string[]
  negative_signals:  string[]
  controversy_flags: string[]
  summary:           string
}

interface ProfileData {
  bio?:                      string
  content_types?:            string[]
  posting_frequency?:        string
  audience_demographics?:    AudienceDemographics
  engagement_rate_estimate?: number
  online_reputation?:        OnlineReputation
  estimated_followers?:      { total: number; instagram?: number; tiktok?: number; twitter?: number; youtube?: number }
}

interface BrandFit {
  score:               number
  audience_overlap:    number
  value_alignment:     string
  risk_factors:        string[]
  positive_indicators: string[]
  recommendation:      'strong_fit' | 'potential_fit' | 'poor_fit'
  recommendation_notes: string
}

export interface InfluencerDetail {
  id:           string
  brand_id:     string
  name:         string
  handle:       string
  platform:     string
  category:     string | null
  followers:    number | null
  cultural_iq:  number | null
  risk_score:   number | null
  ai_notes:     string | null
  status:       string
  campaign_id:  string | null
  profile_url?: string | null
  social_urls?: SocialUrl[]
  profile_data?: ProfileData
  brand_fit?:   BrandFit
  created_at:   string
  updated_at:   string
}

interface CampaignOption { id: string; name: string; status: string }

interface InfluencerPost {
  id:            string
  post_url:      string
  platform:      string
  post_type?:    string | null
  overall_score: number | null
  analyzed_at:   string | null
  created_at:    string
}

interface Props {
  influencer:    InfluencerDetail
  initialPosts:  InfluencerPost[]
  campaigns:     CampaignOption[]
  brandCategory: string | null
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtFollowers(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function platformLabel(p: string): string {
  if (p === 'tiktok')   return 'TikTok'
  if (p === 'youtube')  return 'YouTube'
  return p.charAt(0).toUpperCase() + p.slice(1)
}

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === 'tiktok') return <TrendingUp className="h-3.5 w-3.5" />
  return <Globe className="h-3.5 w-3.5" />
}

function IqScore({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground text-sm">Not scored</span>
  const color = score >= 70 ? 'text-emerald-600 dark:text-emerald-400'
    : score >= 50 ? 'text-amber-600 dark:text-amber-400'
    : 'text-rose-600 dark:text-rose-400'
  const barColor = score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-400' : 'bg-rose-500'
  return (
    <div className="space-y-1">
      <span className={cn('text-2xl font-bold tabular-nums', color)}>{score}</span>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden w-full">
        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

function RiskScore({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground text-sm">—</span>
  const color = score < 30 ? 'text-emerald-600 dark:text-emerald-400'
    : score <= 60 ? 'text-amber-600 dark:text-amber-400'
    : 'text-rose-600 dark:text-rose-400'
  const barColor = score < 30 ? 'bg-emerald-500' : score <= 60 ? 'bg-amber-400' : 'bg-rose-500'
  const label    = score < 30 ? 'Low risk' : score <= 60 ? 'Medium' : 'High risk'
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2">
        <span className={cn('text-2xl font-bold tabular-nums', color)}>{score}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden w-full">
        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    prospect: 'bg-muted text-muted-foreground',
    active:   'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    paused:   'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    rejected: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
  }
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', map[status] ?? 'bg-muted text-muted-foreground')}>
      {status}
    </span>
  )
}

function RecommendationBadge({ rec }: { rec: string }) {
  const map: Record<string, string> = {
    strong_fit:    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    potential_fit: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    poor_fit:      'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
  }
  const labels: Record<string, string> = {
    strong_fit: 'Strong fit', potential_fit: 'Potential fit', poor_fit: 'Poor fit',
  }
  return <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', map[rec] ?? 'bg-muted text-muted-foreground')}>{labels[rec] ?? rec}</span>
}

// ── main component ────────────────────────────────────────────────────────────

export function InfluencerDetailClient({ influencer, initialPosts, campaigns, brandCategory }: Props) {
  const router = useRouter()
  const [inf, setInf]       = useState(influencer)
  const [scoring, setScoring]       = useState(false)
  const [reanalysing, setReanalysing] = useState(false)
  const [linking, setLinking]       = useState(false)

  const pd    = inf.profile_data as ProfileData | undefined
  const bf    = inf.brand_fit   as BrandFit    | undefined
  const urls  = inf.social_urls as SocialUrl[] | undefined
  const platforms = urls?.length ? urls.map(s => s.platform) : [inf.platform]
  const engRate = pd?.engagement_rate_estimate
  const totalFollowers = pd?.estimated_followers?.total ?? inf.followers as number | undefined | null

  async function handleScore() {
    setScoring(true)
    try {
      const res = await fetch(`/api/influencers/${inf.id}/score`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Scoring failed.')
      }
      const { influencer: updated } = await res.json() as { influencer: InfluencerDetail }
      setInf(updated)
      toast.success('Scored with AI.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scoring failed.')
    } finally {
      setScoring(false)
    }
  }

  async function handleReanalyse() {
    setReanalysing(true)
    try {
      const res = await fetch(`/api/influencers/${inf.id}/reanalyse`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Re-analysis failed.')
      }
      const { influencer: updated } = await res.json() as { influencer: InfluencerDetail }
      setInf(updated)
      toast.success('Profile re-analysed.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Re-analysis failed.')
    } finally {
      setReanalysing(false)
    }
  }

  async function handleLinkCampaign(campaignId: string | null) {
    setLinking(true)
    try {
      const res = await fetch(`/api/influencers/${inf.id}/link-campaign`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ campaign_id: campaignId }),
      })
      if (!res.ok) throw new Error('Failed to update campaign link.')
      setInf(prev => ({ ...prev, campaign_id: campaignId }))
      toast.success(campaignId ? 'Linked to campaign.' : 'Removed from campaign.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update.')
    } finally {
      setLinking(false)
    }
  }

  const linkedCampaign = campaigns.find(c => c.id === inf.campaign_id)
  const _ = { initialPosts, brandCategory }  // consumed by PostTracker

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Back + header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-0.5" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">{inf.name}</h1>
            <StatusBadge status={inf.status} />
            {bf?.recommendation && <RecommendationBadge rec={bf.recommendation} />}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {platforms.map(p => (
              <span key={p} className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                <PlatformIcon platform={p} />
                {platformLabel(p)}
              </span>
            ))}
            <span className="text-sm text-muted-foreground">@{inf.handle.replace(/^@/, '')}</span>
            {inf.category && <span className="text-xs text-muted-foreground">· {inf.category}</span>}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleScore}
          disabled={scoring}
          className="shrink-0 gap-1.5"
        >
          {scoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {scoring ? 'Scoring…' : 'Score with AI'}
        </Button>
      </div>

      {/* Key stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={Users} label="Followers" value={fmtFollowers(totalFollowers ?? null)} />
        <StatTile icon={Activity} label="Engagement" value={engRate ? `${(engRate * 100).toFixed(1)}%` : '—'} />
        <StatTile icon={BarChart2} label="Posts tracked" value={String(initialPosts.length)} />
        <StatTile icon={Calendar} label="Added" value={new Date(inf.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' })} />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left: scores + AI notes + brand fit ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Cultural IQ + Risk */}
          <div className="border rounded-2xl p-5 bg-card space-y-4">
            <h2 className="text-sm font-semibold">AI Scoring</h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Star className="h-3.5 w-3.5" />
                  Cultural IQ
                </div>
                <IqScore score={inf.cultural_iq} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Risk Score
                </div>
                <RiskScore score={inf.risk_score} />
              </div>
            </div>
            {inf.ai_notes && (
              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">AI Assessment</p>
                <p className="text-sm leading-relaxed">{inf.ai_notes}</p>
              </div>
            )}
            {!inf.ai_notes && !inf.cultural_iq && (
              <div className="border-t pt-4 text-center">
                <p className="text-xs text-muted-foreground">No AI score yet. Click &ldquo;Score with AI&rdquo; above.</p>
              </div>
            )}
          </div>

          {/* Brand Fit */}
          {!bf && (
            <div className="border rounded-2xl p-5 bg-card space-y-3">
              <h2 className="text-sm font-semibold">Brand Fit Analysis</h2>
              <p className="text-xs text-muted-foreground">No brand fit analysis yet.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleReanalyse}
                disabled={reanalysing}
                className="gap-1.5"
              >
                {reanalysing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {reanalysing ? 'Analysing…' : 'Run brand fit analysis'}
              </Button>
            </div>
          )}
          {bf && (
            <div className="border rounded-2xl p-5 bg-card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Brand Fit Analysis</h2>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleReanalyse}
                    disabled={reanalysing}
                    className="h-7 px-2 gap-1 text-xs text-muted-foreground"
                  >
                    {reanalysing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    {reanalysing ? 'Re-analysing…' : 'Re-analyse'}
                  </Button>
                  <span className="text-xs text-muted-foreground">Score</span>
                  <span className={cn('text-lg font-bold tabular-nums',
                    bf.score >= 70 ? 'text-emerald-600 dark:text-emerald-400'
                    : bf.score >= 40 ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400'
                  )}>{bf.score}/100</span>
                </div>
              </div>

              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full', bf.score >= 70 ? 'bg-emerald-500' : bf.score >= 40 ? 'bg-amber-400' : 'bg-rose-500')}
                  style={{ width: `${bf.score}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">Audience overlap</p>
                  <p className="font-semibold">{bf.audience_overlap}%</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">Recommendation</p>
                  <RecommendationBadge rec={bf.recommendation} />
                </div>
              </div>

              {bf.value_alignment && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Value alignment</p>
                  <p className="text-sm">{bf.value_alignment}</p>
                </div>
              )}

              {bf.recommendation_notes && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Notes</p>
                  <p className="text-sm leading-relaxed">{bf.recommendation_notes}</p>
                </div>
              )}

              {bf.positive_indicators?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Positive indicators</p>
                  <div className="space-y-1">
                    {bf.positive_indicators.map(s => (
                      <p key={s} className="text-xs flex gap-1.5">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        {s}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {bf.risk_factors?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-rose-500 uppercase tracking-wide">Risk factors</p>
                  <div className="space-y-1">
                    {bf.risk_factors.map(r => (
                      <p key={r} className="text-xs flex gap-1.5">
                        <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                        {r}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Post Performance */}
          <div className="border rounded-2xl p-5 bg-card">
            <PostTracker
              influencerId={inf.id}
              campaignId={inf.campaign_id}
              influencerHandle={inf.handle}
              influencerPlatform={inf.platform}
            />
          </div>
        </div>

        {/* ── Right: profile + audience + reputation + links + campaign ── */}
        <div className="space-y-4">

          {/* Campaign link */}
          <div className="border rounded-2xl p-4 bg-card space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Campaign</h2>
            {campaigns.length > 0 ? (
              <Select
                value={inf.campaign_id ?? 'none'}
                disabled={linking}
                onValueChange={async (val) => {
                  const id = val === 'none' ? null : val
                  await handleLinkCampaign(id)
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <span className="flex flex-1 text-left text-xs truncate">
                    {inf.campaign_id
                      ? (campaigns.find(c => c.id === inf.campaign_id)?.name ?? 'Not linked')
                      : 'Not linked'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No campaign</SelectItem>
                  {campaigns.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">
                {linkedCampaign ? `Linked to: ${linkedCampaign.name}` : 'No campaigns available.'}
              </p>
            )}
          </div>

          {/* Profile info */}
          {pd && (
            <div className="border rounded-2xl p-4 bg-card space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profile</h2>

              {pd.bio && (
                <p className="text-xs leading-relaxed text-muted-foreground">{pd.bio}</p>
              )}

              {pd.content_types && pd.content_types.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium">Content types</p>
                  <div className="flex flex-wrap gap-1">
                    {pd.content_types.map(ct => (
                      <Badge key={ct} variant="outline" className="text-xs py-0 h-5">{ct}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {pd.posting_frequency && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Posting frequency</p>
                  <p className="text-sm font-medium">{pd.posting_frequency}</p>
                </div>
              )}
            </div>
          )}

          {/* Audience demographics */}
          {pd?.audience_demographics && (
            <div className="border rounded-2xl p-4 bg-card space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Audience</h2>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">Age range</p>
                  <p className="font-medium">{pd.audience_demographics.age_range}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">Location</p>
                  <p className="font-medium">{pd.audience_demographics.primary_location}</p>
                </div>
              </div>
              {pd.audience_demographics.interests?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Interests</p>
                  <div className="flex flex-wrap gap-1">
                    {pd.audience_demographics.interests.map(i => (
                      <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded">{i}</span>
                    ))}
                  </div>
                </div>
              )}
              {engRate != null && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Est. engagement rate</p>
                  <p className="text-sm font-semibold">{(engRate * 100).toFixed(1)}%</p>
                </div>
              )}
            </div>
          )}

          {/* Online reputation */}
          {pd?.online_reputation && (
            <div className="border rounded-2xl p-4 bg-card space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Online Reputation</h2>
              {pd.online_reputation.summary && (
                <p className="text-xs text-muted-foreground italic">{pd.online_reputation.summary}</p>
              )}
              {pd.online_reputation.positive_signals?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {pd.online_reputation.positive_signals.map(s => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">{s}</span>
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
                    <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400">{s}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Social profiles */}
          {urls && urls.length > 0 && (
            <div className="border rounded-2xl p-4 bg-card space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Social Profiles</h2>
              {urls.map(u => (
                <div key={u.platform} className="flex items-center gap-2">
                  <PlatformIcon platform={u.platform} />
                  <span className="text-xs text-muted-foreground capitalize">{platformLabel(u.platform)}</span>
                  <span className="text-xs">@{u.handle}</span>
                  {u.url && (
                    <a
                      href={u.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Meta */}
          <div className="border rounded-2xl p-4 bg-card space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Added</span>
              <span>{new Date(inf.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' })}</span>
            </div>
            <div className="flex justify-between">
              <span>Last updated</span>
              <span>{new Date(inf.updated_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatTile({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="border rounded-xl p-4 bg-card space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

