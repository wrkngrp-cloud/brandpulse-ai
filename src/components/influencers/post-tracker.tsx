'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Loader2, Plus, X, ExternalLink, ChevronDown, ChevronUp,
  BarChart2, TrendingUp, Users, Shield, CheckCircle, XCircle,
  AlertCircle, Lightbulb, RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── types ─────────────────────────────────────────────────────────────────────

interface CampaignAlignment {
  objective: string
  met: boolean
  confidence: 'high' | 'medium' | 'low'
  notes: string
}

interface SentimentAnalysis {
  overall: 'positive' | 'neutral' | 'negative'
  positive_pct: number
  neutral_pct: number
  negative_pct: number
  brand_mention_sentiment: string
  key_themes: string[]
  conversion_signals: string[]
  concern_signals: string[]
}

interface BrandAssociation {
  score: number
  community_receptivity: string
  naturalness: string
  audience_intent_signals: string[]
}

interface FitVerdict {
  overall: string
  score: number
  recommendation: 'renew' | 'consider' | 'discontinue'
  rationale: string
  strengths: string[]
  weaknesses: string[]
  risks: string[]
}

interface PostAnalysis {
  performance_score: number
  brand_integration_score: number
  community_fit_score: number
  content_authenticity_score: number
  campaign_alignment: CampaignAlignment
  sentiment_analysis: SentimentAnalysis
  brand_association: BrandAssociation
  fit_verdict: FitVerdict
  executive_summary: string
  action_items: string[]
}

interface InfluencerPost {
  id: string
  influencer_id: string
  campaign_id: string | null
  post_url: string
  platform: string
  post_type: string | null
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  reach: number | null
  comment_samples: string | null
  analysis: PostAnalysis | null
  overall_score: number | null
  analyzed_at: string | null
  created_at: string
}

interface PostTrackerProps {
  influencerId: string
  campaignId?: string | null
  influencerHandle: string
  influencerPlatform: string
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function platformLabel(p: string): string {
  const m: Record<string, string> = {
    instagram: 'Instagram', tiktok: 'TikTok', twitter: 'X (Twitter)',
    youtube: 'YouTube', facebook: 'Facebook',
  }
  return m[p] ?? p
}

function postTypeLabel(t: string): string {
  const m: Record<string, string> = {
    reel: 'Reel', feed: 'Feed Post', story: 'Story', video: 'Video',
    short: 'Short', tweet: 'Tweet', post: 'Post',
  }
  return m[t] ?? t
}

function verdictConfig(v: string): { label: string; cls: string } {
  const m: Record<string, { label: string; cls: string }> = {
    strong_fit:   { label: 'Strong Fit',   cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
    good_fit:     { label: 'Good Fit',     cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    moderate_fit: { label: 'Moderate Fit', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
    poor_fit:     { label: 'Poor Fit',     cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  }
  return m[v] ?? { label: v, cls: 'bg-muted text-muted-foreground' }
}

function recommendConfig(r: string): { label: string; cls: string } {
  const m: Record<string, { label: string; cls: string }> = {
    renew:       { label: 'Renew',       cls: 'bg-emerald-500 text-white' },
    consider:    { label: 'Consider',    cls: 'bg-amber-500 text-white' },
    discontinue: { label: 'Discontinue', cls: 'bg-red-500 text-white' },
  }
  return m[r] ?? { label: r, cls: 'bg-muted text-foreground' }
}

function scoreColor(s: number): string {
  if (s >= 75) return 'text-emerald-600 dark:text-emerald-400'
  if (s >= 55) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}

function sentimentColor(s: string): string {
  if (s === 'positive') return 'text-emerald-600 dark:text-emerald-400'
  if (s === 'negative') return 'text-rose-600 dark:text-rose-400'
  return 'text-muted-foreground'
}

// ── sub-components ────────────────────────────────────────────────────────────

function ScoreTile({ label, score, icon: Icon }: { label: string; score: number; icon: React.ElementType }) {
  return (
    <div className="bg-muted/40 rounded-xl p-3 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <p className={cn('text-xl font-bold tabular-nums', scoreColor(score))}>{score}</p>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', score >= 75 ? 'bg-emerald-500' : score >= 55 ? 'bg-amber-400' : 'bg-rose-500')}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

function SentimentBar({ pct, color, label }: { pct: number; color: string; label: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

// ── PostAnalysisView ──────────────────────────────────────────────────────────

function PostAnalysisView({ analysis }: { analysis: PostAnalysis }) {
  const [showDetail, setShowDetail] = useState(false)
  const verdict  = verdictConfig(analysis.fit_verdict.overall)
  const rec      = recommendConfig(analysis.fit_verdict.recommendation)

  return (
    <div className="space-y-4">

      {/* Overall score + recommendation */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-baseline gap-1">
          <span className={cn('text-4xl font-bold tabular-nums', scoreColor(analysis.fit_verdict.score))}>
            {analysis.fit_verdict.score}
          </span>
          <span className="text-base text-muted-foreground font-medium">/100</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-xs px-2.5 py-1 rounded-full font-semibold', verdict.cls)}>{verdict.label}</span>
          <span className={cn('text-xs px-2.5 py-1 rounded-full font-semibold', rec.cls)}>{rec.label}</span>
        </div>
      </div>

      {/* 4 sub-scores */}
      <div className="grid grid-cols-2 gap-2">
        <ScoreTile label="Performance"    score={analysis.performance_score}         icon={BarChart2}  />
        <ScoreTile label="Brand Integration" score={analysis.brand_integration_score} icon={TrendingUp} />
        <ScoreTile label="Community Fit"  score={analysis.community_fit_score}        icon={Users}      />
        <ScoreTile label="Authenticity"   score={analysis.content_authenticity_score} icon={Shield}     />
      </div>

      {/* Campaign alignment */}
      <div className="border rounded-xl p-3 space-y-1">
        <div className="flex items-center gap-2">
          {analysis.campaign_alignment.met
            ? <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
            : <XCircle    className="h-4 w-4 text-rose-500 shrink-0" />
          }
          <span className="text-xs font-semibold capitalize">
            {analysis.campaign_alignment.objective} objective {analysis.campaign_alignment.met ? 'met' : 'not met'}
          </span>
          <span className={cn(
            'text-[10px] px-1.5 py-0.5 rounded font-medium ml-auto',
            analysis.campaign_alignment.confidence === 'high'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : analysis.campaign_alignment.confidence === 'medium'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              : 'bg-muted text-muted-foreground'
          )}>
            {analysis.campaign_alignment.confidence} confidence
          </span>
        </div>
        <p className="text-xs text-muted-foreground pl-6">{analysis.campaign_alignment.notes}</p>
      </div>

      {/* Sentiment */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">Audience Sentiment</span>
          <span className={cn('text-xs font-semibold capitalize', sentimentColor(analysis.sentiment_analysis.overall))}>
            {analysis.sentiment_analysis.brand_mention_sentiment} on brand mentions
          </span>
        </div>
        <SentimentBar pct={analysis.sentiment_analysis.positive_pct} color="#10b981" label="Positive" />
        <SentimentBar pct={analysis.sentiment_analysis.neutral_pct}  color="#94a3b8" label="Neutral"  />
        <SentimentBar pct={analysis.sentiment_analysis.negative_pct} color="#f43f5e" label="Negative" />
        {analysis.sentiment_analysis.key_themes.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {analysis.sentiment_analysis.key_themes.map(t => (
              <span key={t} className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        )}
        {analysis.sentiment_analysis.conversion_signals.length > 0 && (
          <div className="space-y-1 pt-1">
            <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Conversion signals</p>
            {analysis.sentiment_analysis.conversion_signals.map(s => (
              <p key={s} className="text-xs text-muted-foreground flex gap-1.5"><CheckCircle className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />{s}</p>
            ))}
          </div>
        )}
        {analysis.sentiment_analysis.concern_signals.length > 0 && (
          <div className="space-y-1 pt-1">
            <p className="text-[10px] font-semibold text-rose-500 uppercase tracking-wide">Concerns</p>
            {analysis.sentiment_analysis.concern_signals.map(s => (
              <p key={s} className="text-xs text-muted-foreground flex gap-1.5"><AlertCircle className="h-3 w-3 text-rose-500 mt-0.5 shrink-0" />{s}</p>
            ))}
          </div>
        )}
      </div>

      {/* Brand association */}
      <div className="border rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">Brand Association</span>
          <span className={cn('text-sm font-bold tabular-nums', scoreColor(analysis.brand_association.score))}>
            {analysis.brand_association.score}/100
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full capitalize">
            {analysis.brand_association.community_receptivity} receptivity
          </span>
          <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full capitalize">
            {analysis.brand_association.naturalness} integration
          </span>
        </div>
        {analysis.brand_association.audience_intent_signals.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {analysis.brand_association.audience_intent_signals.map(s => (
              <span key={s} className="text-[10px] text-muted-foreground">• {s}</span>
            ))}
          </div>
        )}
      </div>

      {/* Executive summary */}
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
        <p className="text-xs leading-relaxed">{analysis.executive_summary}</p>
      </div>

      {/* Action items */}
      {analysis.action_items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-semibold">Action Items</span>
          </div>
          <ol className="space-y-1.5">
            {analysis.action_items.map((a, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <span className="text-[10px] font-bold text-muted-foreground tabular-nums mt-0.5 w-3.5 shrink-0">{i + 1}.</span>
                <span className="text-muted-foreground">{a}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Strengths / Weaknesses / Risks — collapsible */}
      <button
        onClick={() => setShowDetail(v => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {showDetail ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {showDetail ? 'Hide' : 'Show'} strengths, weaknesses & risks
      </button>

      {showDetail && (
        <div className="space-y-3 pt-1">
          {analysis.fit_verdict.strengths.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Strengths</p>
              {analysis.fit_verdict.strengths.map(s => (
                <p key={s} className="text-xs text-muted-foreground flex gap-1.5">
                  <CheckCircle className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />{s}
                </p>
              ))}
            </div>
          )}
          {analysis.fit_verdict.weaknesses.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide">Weaknesses</p>
              {analysis.fit_verdict.weaknesses.map(w => (
                <p key={w} className="text-xs text-muted-foreground flex gap-1.5">
                  <AlertCircle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />{w}
                </p>
              ))}
            </div>
          )}
          {analysis.fit_verdict.risks.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-rose-500 uppercase tracking-wide">Risks</p>
              {analysis.fit_verdict.risks.map(r => (
                <p key={r} className="text-xs text-muted-foreground flex gap-1.5">
                  <XCircle className="h-3 w-3 text-rose-500 mt-0.5 shrink-0" />{r}
                </p>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground italic leading-relaxed border-t pt-3">
            {analysis.fit_verdict.rationale}
          </p>
        </div>
      )}
    </div>
  )
}

// ── PostCard ──────────────────────────────────────────────────────────────────

function PostCard({ post }: { post: InfluencerPost }) {
  const [expanded, setExpanded] = useState(false)
  const verdict = post.analysis ? verdictConfig(post.analysis.fit_verdict.overall) : null

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-start justify-between gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium bg-muted px-1.5 py-0.5 rounded capitalize">
              {platformLabel(post.platform)} {post.post_type ? postTypeLabel(post.post_type) : ''}
            </span>
            {verdict && (
              <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', verdict.cls)}>{verdict.label}</span>
            )}
            {!post.analysis && (
              <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">Analysis pending</span>
            )}
          </div>
          <a
            href={post.post_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors truncate max-w-[240px]"
          >
            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
            {post.post_url.replace(/^https?:\/\//, '')}
          </a>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {post.overall_score != null && (
            <span className={cn('text-sm font-bold tabular-nums', scoreColor(post.overall_score))}>
              {post.overall_score}
            </span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Engagement metrics row */}
      {(post.views || post.likes || post.comments || post.shares || post.saves || post.reach) && (
        <div className="px-3 pb-2 flex flex-wrap gap-3">
          {post.views    && <MetricChip label="Views"    value={fmtNum(post.views)}    />}
          {post.likes    && <MetricChip label="Likes"    value={fmtNum(post.likes)}    />}
          {post.comments && <MetricChip label="Comments" value={fmtNum(post.comments)} />}
          {post.shares   && <MetricChip label="Shares"   value={fmtNum(post.shares)}   />}
          {post.saves    && <MetricChip label="Saves"    value={fmtNum(post.saves)}    />}
          {post.reach    && <MetricChip label="Reach"    value={fmtNum(post.reach)}    />}
        </div>
      )}

      {expanded && post.analysis && (
        <div className="border-t p-3">
          <PostAnalysisView analysis={post.analysis} />
        </div>
      )}
    </div>
  )
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-[10px] text-muted-foreground">
      <span className="font-semibold text-foreground">{value}</span> {label}
    </div>
  )
}

// ── PostForm ──────────────────────────────────────────────────────────────────

const METRIC_FIELDS = [
  { key: 'views',    label: 'Views',    placeholder: '48,200' },
  { key: 'likes',    label: 'Likes',    placeholder: '3,400'  },
  { key: 'comments', label: 'Comments', placeholder: '182'    },
  { key: 'shares',   label: 'Shares',   placeholder: '94'     },
  { key: 'saves',    label: 'Saves',    placeholder: '621'    },
  { key: 'reach',    label: 'Reach',    placeholder: '42,000' },
] as const

interface FormState {
  postUrl:        string
  views:          string
  likes:          string
  comments:       string
  shares:         string
  saves:          string
  reach:          string
  commentSamples: string
}

const EMPTY_FORM: FormState = {
  postUrl: '', views: '', likes: '', comments: '', shares: '', saves: '', reach: '', commentSamples: '',
}

interface PostFormProps {
  influencerId:      string
  campaignId?:       string | null
  onSuccess:         (post: InfluencerPost) => void
  onCancel:          () => void
}

function PostForm({ influencerId, campaignId, onSuccess, onCancel }: PostFormProps) {
  const [form, setForm]         = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  function setField(key: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    if (!form.postUrl.trim()) {
      toast.error('Post URL is required.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/influencers/${influencerId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_url:        form.postUrl.trim(),
          campaign_id:     campaignId ?? undefined,
          views:           form.views    ? Number(form.views.replace(/,/g, ''))    : undefined,
          likes:           form.likes    ? Number(form.likes.replace(/,/g, ''))    : undefined,
          comments:        form.comments ? Number(form.comments.replace(/,/g, '')) : undefined,
          shares:          form.shares   ? Number(form.shares.replace(/,/g, ''))   : undefined,
          saves:           form.saves    ? Number(form.saves.replace(/,/g, ''))    : undefined,
          reach:           form.reach    ? Number(form.reach.replace(/,/g, ''))    : undefined,
          comment_samples: form.commentSamples.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Submission failed.')
      }
      const { post } = await res.json()
      onSuccess(post)
      toast.success('Post analysed.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">

      {/* Post URL */}
      <div className="space-y-1.5">
        <Label className="text-xs">Post URL <span className="text-rose-500">*</span></Label>
        <Input
          placeholder="https://instagram.com/reel/abc123"
          value={form.postUrl}
          onChange={e => setField('postUrl', e.target.value)}
          className="text-sm h-8"
        />
        <p className="text-[10px] text-muted-foreground">Instagram, TikTok, X, YouTube, or Facebook</p>
      </div>

      {/* Engagement metrics */}
      <div className="space-y-2">
        <div className="space-y-0.5">
          <Label className="text-xs">Engagement Metrics</Label>
          <p className="text-[10px] text-muted-foreground">Enter from the creator&apos;s insights dashboard or your ad account. All fields optional.</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {METRIC_FIELDS.map(f => (
            <div key={f.key} className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">{f.label}</Label>
              <Input
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={e => setField(f.key as keyof FormState, e.target.value)}
                className="text-xs h-7 px-2"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Comment samples */}
      <div className="space-y-1.5">
        <div className="space-y-0.5">
          <Label className="text-xs">Comment Samples <span className="text-muted-foreground font-normal">(optional but improves accuracy)</span></Label>
          <p className="text-[10px] text-muted-foreground">Paste 5–10 representative comments for deeper sentiment analysis</p>
        </div>
        <Textarea
          placeholder={'"This is exactly what I needed!"\n"Where can I get this? 😍"\n"Looks amazing, trying this week"'}
          value={form.commentSamples}
          onChange={e => setField('commentSamples', e.target.value)}
          rows={4}
          className="text-xs resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="text-xs h-7">
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={handleSubmit} disabled={submitting} className="text-xs h-7">
          {submitting ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Analysing&hellip;</>
          ) : (
            'Analyse Post'
          )}
        </Button>
      </div>
    </div>
  )
}

// ── PostTracker (main export) ─────────────────────────────────────────────────

export function PostTracker({ influencerId, campaignId, influencerHandle, influencerPlatform }: PostTrackerProps) {
  const [posts, setPosts]         = useState<InfluencerPost[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/influencers/${influencerId}/posts`)
      if (res.ok) {
        const data = await res.json()
        setPosts(data.posts ?? [])
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setLoading(false)
    }
  }, [influencerId])

  useEffect(() => { void fetchPosts() }, [fetchPosts])

  function handleSuccess(post: InfluencerPost) {
    setPosts(prev => [post, ...prev])
    setShowForm(false)
  }

  const _ = { influencerHandle, influencerPlatform } // available for future display use

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Post Performance
          </span>
          {posts.length > 0 && (
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-medium">
              {posts.length} post{posts.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => void fetchPosts()}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
            title="Refresh"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          {!showForm && (
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)} className="text-xs h-6 px-2 gap-1">
              <Plus className="h-3 w-3" /> Track Post
            </Button>
          )}
          {showForm && (
            <button
              onClick={() => setShowForm(false)}
              className="text-muted-foreground hover:text-foreground p-1 rounded"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="border rounded-xl p-4 bg-muted/20 space-y-4">
          <PostForm
            influencerId={influencerId}
            campaignId={campaignId}
            onSuccess={handleSuccess}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Posts list */}
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 && !showForm ? (
        <div className="border border-dashed rounded-xl p-5 text-center space-y-2">
          <BarChart2 className="h-6 w-6 text-muted-foreground mx-auto" />
          <div>
            <p className="text-xs font-medium">No posts tracked yet</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Add a post URL to analyse how this influencer&apos;s content is performing for your brand.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)} className="text-xs h-7">
            <Plus className="h-3 w-3 mr-1" /> Track first post
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map(post => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
