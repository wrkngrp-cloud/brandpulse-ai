'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft, ArrowRight, Check, Loader2, Megaphone, Upload, X,
  ImageIcon, Plus, AlertCircle, Globe, Users, BarChart2, ShoppingCart,
  MousePointer, Smartphone,
} from 'lucide-react'

// ── types ─────────────────────────────────────────────────────────────────────

type Platform = 'meta' | 'google' | 'tiktok' | 'linkedin' | 'twitter'
type Objective = 'awareness' | 'traffic' | 'engagement' | 'leads' | 'app' | 'sales'
type AdFormat =
  | 'single_image' | 'video' | 'carousel'
  | 'responsive_search' | 'responsive_display'
  | 'tiktok_video' | 'linkedin_image' | 'linkedin_carousel' | 'text_ad'
type DeviceTarget = 'all' | 'mobile' | 'desktop'
type BidStrategy = 'lowest_cost' | 'bid_cap' | 'target_cost' | 'target_roas'
type BudgetType = 'daily' | 'lifetime'

interface CarouselCard {
  image_url: string
  headline:  string
  description: string
  url:       string
  cta?:      string
}

interface CreativeConfig {
  format?:           AdFormat
  cards?:            CarouselCard[]
  rsa_headlines?:    string[]
  rsa_descriptions?: string[]
  video_url?:        string
  logo_url?:         string
  thumbnail_url?:    string
}

interface TargetAudience {
  locations:              string[]
  age_min:                number
  age_max:                number
  gender:                 'all' | 'male' | 'female'
  interests:              string[]
  keywords:               string[]
  negative_keywords:      string[]
  custom_audience_notes:  string
  device:                 DeviceTarget
}

interface WizardState {
  // Step 1 — Campaign
  platform:               Platform
  campaign_name:          string
  objective:              Objective
  special_ad_category:    string

  // Step 2 — Format
  ad_format:              AdFormat | ''
  ad_set_name:            string

  // Step 3 — Creative + Copy
  media_urls:             string[]
  creative_config:        CreativeConfig
  headline:               string
  body:                   string
  cta:                    string
  destination_url:        string

  // Step 4 — Audience
  target_audience:        TargetAudience

  // Step 5 — Budget & Schedule & Placement
  budget_type:            BudgetType
  budget_daily:           string
  budget_total:           string
  start_date:             string
  end_date:               string
  placements_auto:        boolean
  placement:              string[]
  optimization_goal:      string
  bid_strategy:           BidStrategy
  bid_amount:             string
}

// ── constants ─────────────────────────────────────────────────────────────────

const PLATFORMS: { value: Platform; label: string; sub: string }[] = [
  { value: 'meta',     label: 'Meta',     sub: 'Facebook & Instagram'    },
  { value: 'google',   label: 'Google',   sub: 'Search, Display & YouTube' },
  { value: 'tiktok',   label: 'TikTok',   sub: 'Short-form video'         },
  { value: 'linkedin', label: 'LinkedIn', sub: 'B2B audiences'             },
  { value: 'twitter',  label: 'X (Twitter)', sub: 'Real-time reach'        },
]

const OBJECTIVES: { value: Objective; label: string; desc: string; icon: React.ElementType; platforms: Platform[] }[] = [
  { value: 'awareness',   label: 'Awareness',    desc: 'Show your ad to as many people as possible',        icon: Globe,         platforms: ['meta','google','tiktok','linkedin','twitter'] },
  { value: 'traffic',     label: 'Traffic',      desc: 'Send people to your website or app',                icon: MousePointer,  platforms: ['meta','google','tiktok','linkedin','twitter'] },
  { value: 'engagement',  label: 'Engagement',   desc: 'Get more interactions, page likes, or event RSVPs', icon: BarChart2,     platforms: ['meta','tiktok','twitter'] },
  { value: 'leads',       label: 'Leads',        desc: 'Collect contact info from people interested in your brand', icon: Users, platforms: ['meta','google','linkedin','twitter'] },
  { value: 'app',         label: 'App Promotion', desc: 'Get more installs or activity on your app',        icon: Smartphone,    platforms: ['meta','google','tiktok'] },
  { value: 'sales',       label: 'Sales',        desc: 'Drive purchases or conversions on your website',    icon: ShoppingCart,  platforms: ['meta','google','linkedin'] },
]

const FORMATS_BY_PLATFORM: Record<Platform, { value: AdFormat; label: string; desc: string; soon?: boolean }[]> = {
  meta: [
    { value: 'single_image', label: 'Single Image',  desc: 'One image with caption and link' },
    { value: 'carousel',     label: 'Carousel',      desc: '2–10 cards, each with its own image and link' },
    { value: 'video',        label: 'Video',          desc: 'A single video asset — MP4, MOV, or WebM up to 500 MB' },
  ],
  google: [
    { value: 'responsive_search',  label: 'Responsive Search',  desc: 'Up to 15 headlines + 4 descriptions — Google assembles the best combination' },
    { value: 'responsive_display', label: 'Responsive Display', desc: 'Image + headlines — Google adapts to any placement size' },
  ],
  tiktok: [
    { value: 'tiktok_video', label: 'In-Feed Video', desc: 'Full-screen vertical video in the TikTok feed — MP4 or WebM' },
  ],
  linkedin: [
    { value: 'linkedin_image',     label: 'Single Image',  desc: 'Sponsored content with one image' },
    { value: 'linkedin_carousel',  label: 'Carousel',      desc: 'Swipeable cards in the LinkedIn feed' },
    { value: 'text_ad',            label: 'Text Ad',        desc: 'Small ad in the sidebar (desktop only)' },
  ],
  twitter: [
    { value: 'single_image', label: 'Image',    desc: 'Promoted image tweet' },
    { value: 'carousel',     label: 'Carousel', desc: 'Up to 6 image cards' },
  ],
}

const META_PLACEMENTS = [
  { id: 'facebook_feed',        label: 'Facebook Feed' },
  { id: 'facebook_stories',     label: 'Facebook Stories' },
  { id: 'facebook_reels',       label: 'Facebook Reels' },
  { id: 'facebook_right_col',   label: 'Facebook Right Column' },
  { id: 'facebook_marketplace',  label: 'Facebook Marketplace' },
  { id: 'instagram_feed',       label: 'Instagram Feed' },
  { id: 'instagram_stories',    label: 'Instagram Stories' },
  { id: 'instagram_reels',      label: 'Instagram Reels' },
  { id: 'instagram_explore',    label: 'Instagram Explore' },
  { id: 'audience_network',     label: 'Audience Network' },
]

const GOOGLE_PLACEMENTS = [
  { id: 'search',     label: 'Google Search' },
  { id: 'display',    label: 'Google Display Network' },
  { id: 'youtube',    label: 'YouTube' },
  { id: 'gmail',      label: 'Gmail' },
  { id: 'discovery',  label: 'Discover' },
]

const LINKEDIN_PLACEMENTS = [
  { id: 'linkedin_feed',   label: 'LinkedIn Feed' },
  { id: 'linkedin_right',  label: 'Right Rail (Desktop)' },
  { id: 'linkedin_message', label: 'Message Ads (InMail)' },
]

const TWITTER_PLACEMENTS = [
  { id: 'twitter_timeline', label: 'Timeline' },
  { id: 'twitter_search',   label: 'Search Results' },
  { id: 'twitter_profile',  label: 'Profile' },
]

const PLACEMENTS_BY_PLATFORM: Record<Platform, { id: string; label: string }[]> = {
  meta:     META_PLACEMENTS,
  google:   GOOGLE_PLACEMENTS,
  tiktok:   [{ id: 'tiktok_feed', label: 'TikTok Feed' }, { id: 'pangle', label: 'Pangle' }],
  linkedin: LINKEDIN_PLACEMENTS,
  twitter:  TWITTER_PLACEMENTS,
}

const OPTIMIZATION_GOALS: Record<Objective, { value: string; label: string }[]> = {
  awareness:   [{ value: 'reach', label: 'Reach' }, { value: 'impressions', label: 'Impressions' }],
  traffic:     [{ value: 'link_clicks', label: 'Link Clicks' }, { value: 'landing_page_views', label: 'Landing Page Views' }],
  engagement:  [{ value: 'post_engagement', label: 'Post Engagement' }, { value: 'page_likes', label: 'Page Likes' }],
  leads:       [{ value: 'leads', label: 'Lead Generation' }, { value: 'link_clicks', label: 'Link Clicks' }],
  app:         [{ value: 'app_installs', label: 'App Installs' }, { value: 'app_events', label: 'App Events' }],
  sales:       [{ value: 'conversions', label: 'Conversions' }, { value: 'value', label: 'Conversion Value (ROAS)' }],
}

const CTAS = [
  'Shop Now', 'Learn More', 'Sign Up', 'Contact Us', 'Download',
  'Get Quote', 'Book Now', 'Subscribe', 'Watch More', 'Apply Now',
]

const NG_LOCATIONS = [
  'Nigeria', 'Lagos', 'Abuja (FCT)', 'Kano', 'Port Harcourt', 'Ibadan',
  'Onitsha', 'Enugu', 'Benin City', 'Kaduna', 'Aba', 'Maiduguri',
  'Zaria', 'Jos', 'Ilorin', 'Warri', 'Owerri', 'Calabar', 'Abeokuta',
  'Asaba', 'Akure', 'Uyo', 'Bauchi', 'Gombe', 'Yola', 'Sokoto',
  'Katsina', 'Makurdi', 'Lokoja', 'Minna',
]

const STEPS = [
  { id: 1, label: 'Campaign'  },
  { id: 2, label: 'Format'    },
  { id: 3, label: 'Creative'  },
  { id: 4, label: 'Audience'  },
  { id: 5, label: 'Budget'    },
  { id: 6, label: 'Review'    },
]

const DEFAULT_STATE: WizardState = {
  platform:              'meta',
  campaign_name:         '',
  objective:             'awareness',
  special_ad_category:   'none',
  ad_format:             '',
  media_urls:            [],
  creative_config:       {},
  headline:              '',
  body:                  '',
  cta:                   'Learn More',
  destination_url:       '',
  target_audience: {
    locations:             ['Nigeria'],
    age_min:               18,
    age_max:               65,
    gender:                'all',
    interests:             [],
    keywords:              [],
    negative_keywords:     [],
    custom_audience_notes: '',
    device:                'all',
  },
  ad_set_name:           '',
  budget_type:           'daily',
  budget_daily:          '',
  budget_total:          '',
  start_date:            '',
  end_date:              '',
  placements_auto:       true,
  placement:             [],
  optimization_goal:     '',
  bid_strategy:          'lowest_cost',
  bid_amount:            '',
}

// ── image upload zone ─────────────────────────────────────────────────────────

function ImageUploadZone({
  url, onUpload, onRemove, label, hint, className,
}: {
  url?: string
  onUpload: (url: string) => void
  onRemove?: () => void
  label?: string
  hint?: string
  className?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.set('file', file)
      const res = await fetch('/api/ads/creatives/upload', { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error((err as { error?: string }).error ?? 'Upload failed.')
        return
      }
      const data = await res.json() as { url: string }
      onUpload(data.url)
    } catch {
      toast.error('Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files?.length) return
    void uploadFile(files[0])
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  if (url) {
    return (
      <div className={cn('relative rounded-xl overflow-hidden border', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Creative" className="w-full object-cover max-h-48" />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-2 right-2 bg-black/60 rounded-full p-1 hover:bg-black/80 transition-colors"
          >
            <X className="h-3.5 w-3.5 text-white" />
          </button>
        )}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDrop={onDrop}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      className={cn(
        'border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 py-8 px-4 transition-colors cursor-pointer',
        dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30',
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={e => handleFiles(e.target.files)}
      />
      {uploading
        ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        : <Upload className="h-6 w-6 text-muted-foreground" />
      }
      <div className="text-center">
        <p className="text-sm font-medium">{uploading ? 'Uploading…' : (label ?? 'Click or drag image here')}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
    </button>
  )
}

// ── video upload zone ─────────────────────────────────────────────────────────

function VideoUploadZone({
  url, onUpload, onRemove,
}: {
  url?: string
  onUpload: (url: string) => void
  onRemove?: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress]   = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    setUploading(true)
    setProgress(0)
    try {
      const form = new FormData()
      form.set('file', file)
      const res = await fetch('/api/ads/creatives/upload', { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error((err as { error?: string }).error ?? 'Upload failed.')
        return
      }
      const data = await res.json() as { url: string }
      onUpload(data.url)
      setProgress(100)
    } catch {
      toast.error('Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  if (url) {
    return (
      <div className="border rounded-xl overflow-hidden relative">
        <video src={url} controls className="w-full max-h-56 bg-black" />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-2 right-2 bg-black/60 rounded-full p-1 hover:bg-black/80 transition-colors"
          >
            <X className="h-3.5 w-3.5 text-white" />
          </button>
        )}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 py-10 px-4 transition-colors cursor-pointer hover:border-primary/50 hover:bg-muted/30 w-full"
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
        className="sr-only"
        onChange={e => { if (e.target.files?.[0]) void uploadFile(e.target.files[0]) }}
      />
      {uploading
        ? <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        : <Upload className="h-7 w-7 text-muted-foreground" />
      }
      <div className="text-center">
        <p className="text-sm font-medium">{uploading ? `Uploading… ${progress > 0 ? `${progress}%` : ''}` : 'Click to upload video'}</p>
        <p className="text-xs text-muted-foreground mt-0.5">MP4, MOV, AVI, or WebM · Max 500 MB</p>
      </div>
    </button>
  )
}

// ── tag input ─────────────────────────────────────────────────────────────────

function TagInput({
  tags, onAdd, onRemove, placeholder, className,
}: {
  tags: string[]
  onAdd: (tag: string) => void
  onRemove: (tag: string) => void
  placeholder?: string
  className?: string
}) {
  const [input, setInput] = useState('')

  function commit() {
    const t = input.trim()
    if (t && !tags.includes(t)) { onAdd(t) }
    setInput('')
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder ?? 'Type and press Enter'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
          className="text-sm h-8 flex-1"
        />
        <Button type="button" size="sm" variant="outline" onClick={commit} className="h-8 px-2">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(t => (
            <span
              key={t}
              className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full"
            >
              {t}
              <button
                type="button"
                onClick={() => onRemove(t)}
                className="text-muted-foreground hover:text-foreground ml-0.5"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── step 1: campaign ──────────────────────────────────────────────────────────

function StepCampaign({ state, setState }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>> }) {
  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) => setState(prev => ({ ...prev, [k]: v }))
  const availableObjectives = OBJECTIVES.filter(o => o.platforms.includes(state.platform))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Campaign setup</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Choose where your ad runs and what you want to achieve.</p>
      </div>

      {/* Platform */}
      <div className="space-y-2">
        <Label className="text-sm">Platform</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PLATFORMS.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => set('platform', p.value)}
              className={cn(
                'border rounded-xl p-3 text-left transition-colors',
                state.platform === p.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40',
              )}
            >
              <p className="text-sm font-semibold">{p.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{p.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Campaign name */}
      <div className="space-y-1.5">
        <Label htmlFor="campaign_name">Campaign name</Label>
        <Input
          id="campaign_name"
          placeholder={`e.g. ${new Date().toLocaleDateString('en-NG', { month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' })} Brand Awareness`}
          value={state.campaign_name}
          onChange={e => set('campaign_name', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">This is the name that appears in {PLATFORMS.find(p => p.value === state.platform)?.label} Ads Manager.</p>
      </div>

      {/* Objective */}
      <div className="space-y-2">
        <Label>Campaign objective</Label>
        <div className="grid sm:grid-cols-2 gap-2">
          {availableObjectives.map(obj => {
            const Icon = obj.icon
            return (
              <button
                key={obj.value}
                type="button"
                onClick={() => set('objective', obj.value)}
                className={cn(
                  'border rounded-xl p-3 text-left flex items-start gap-3 transition-colors',
                  state.objective === obj.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40',
                )}
              >
                <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', state.objective === obj.value ? 'text-primary' : 'text-muted-foreground')} />
                <div>
                  <p className="text-sm font-semibold">{obj.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{obj.desc}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Special ad category (Meta only) */}
      {state.platform === 'meta' && (
        <div className="space-y-1.5">
          <Label>Special ad category</Label>
          <Select value={state.special_ad_category} onValueChange={v => set('special_ad_category', v ?? 'none')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="housing">Housing</SelectItem>
              <SelectItem value="employment">Employment</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
              <SelectItem value="social_issues">Social Issues, Elections, Politics</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Meta requires this for ads about housing, jobs, credit, or political/social topics. Most ads select None.
          </p>
        </div>
      )}
    </div>
  )
}

// ── step 2: format ────────────────────────────────────────────────────────────

function StepFormat({ state, setState }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>> }) {
  const formats = FORMATS_BY_PLATFORM[state.platform] ?? []
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Ad format</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Choose how your ad will appear in the feed.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {formats.map(f => (
          <button
            key={f.value}
            type="button"
            disabled={!!f.soon}
            onClick={() => !f.soon && setState(prev => ({ ...prev, ad_format: f.value }))}
            className={cn(
              'border rounded-xl p-4 text-left transition-colors relative',
              state.ad_format === f.value
                ? 'border-primary bg-primary/5'
                : f.soon
                ? 'border-border bg-muted/40 cursor-not-allowed opacity-60'
                : 'border-border hover:border-primary/40',
            )}
          >
            <p className="text-sm font-semibold">{f.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
            {f.soon && (
              <span className="absolute top-3 right-3 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">
                Coming soon
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── step 3: creative + copy ───────────────────────────────────────────────────

function StepCreative({ state, setState }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>> }) {
  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) => setState(prev => ({ ...prev, [k]: v }))

  function updateCreativeConfig(patch: Partial<CreativeConfig>) {
    setState(prev => ({ ...prev, creative_config: { ...prev.creative_config, ...patch } }))
  }

  function updateCard(idx: number, patch: Partial<CarouselCard>) {
    const cards = [...(state.creative_config.cards ?? [])]
    cards[idx] = { ...cards[idx], ...patch }
    updateCreativeConfig({ cards })
  }

  function addCard() {
    const cards = [...(state.creative_config.cards ?? [])]
    if (cards.length >= 10) return
    cards.push({ image_url: '', headline: '', description: '', url: state.destination_url || '', cta: state.cta || 'Learn More' })
    updateCreativeConfig({ cards })
  }

  function removeCard(idx: number) {
    const cards = [...(state.creative_config.cards ?? [])].filter((_, i) => i !== idx)
    updateCreativeConfig({ cards })
  }

  function updateRsaHeadline(idx: number, val: string) {
    const arr = [...(state.creative_config.rsa_headlines ?? [])]
    arr[idx] = val
    updateCreativeConfig({ rsa_headlines: arr })
  }

  function updateRsaDescription(idx: number, val: string) {
    const arr = [...(state.creative_config.rsa_descriptions ?? [])]
    arr[idx] = val
    updateCreativeConfig({ rsa_descriptions: arr })
  }

  const addRsaHeadline = () => updateCreativeConfig({ rsa_headlines: [...(state.creative_config.rsa_headlines ?? []), ''] })
  const addRsaDesc = () => updateCreativeConfig({ rsa_descriptions: [...(state.creative_config.rsa_descriptions ?? []), ''] })

  // ── meta / linkedin / twitter single image ────────────────────────────────
  if (state.ad_format === 'single_image' || state.ad_format === 'linkedin_image') {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-base font-semibold">Creative &amp; copy</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Upload your image and write the ad copy.</p>
        </div>

        {/* Image upload */}
        <div className="space-y-1.5">
          <Label>Image <span className="text-rose-500">*</span></Label>
          <ImageUploadZone
            url={state.media_urls[0]}
            onUpload={url => set('media_urls', [url])}
            onRemove={() => set('media_urls', [])}
            hint={
              state.platform === 'meta' ? 'Recommended: 1200 × 628 px (Feed) or 1080 × 1920 px (Stories)'
              : state.platform === 'linkedin' ? 'Recommended: 1200 × 627 px'
              : 'Recommended: 1200 × 675 px'
            }
          />
        </div>

        {/* Ad copy */}
        <AdCopyFields state={state} set={set} />
      </div>
    )
  }

  // ── carousel ──────────────────────────────────────────────────────────────
  if (state.ad_format === 'carousel' || state.ad_format === 'linkedin_carousel') {
    const cards = state.creative_config.cards ?? []
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-base font-semibold">Carousel cards</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Add 2–10 cards. Each card has its own image, headline, and link.</p>
        </div>

        {/* Primary text (shown above the carousel) */}
        <div className="space-y-1.5">
          <Label htmlFor="body">Primary text</Label>
          <Textarea
            id="body"
            placeholder="Text shown above the carousel…"
            rows={3}
            value={state.body}
            onChange={e => set('body', e.target.value)}
            className="text-sm resize-none"
          />
        </div>

        {/* Cards */}
        <div className="space-y-4">
          {cards.map((card, idx) => (
            <div key={idx} className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Card {idx + 1}</span>
                {cards.length > 2 && (
                  <button type="button" onClick={() => removeCard(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <ImageUploadZone
                url={card.image_url}
                onUpload={url => updateCard(idx, { image_url: url })}
                onRemove={() => updateCard(idx, { image_url: '' })}
                hint="Square 1080 × 1080 px recommended"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Headline</Label>
                  <Input
                    placeholder="Card headline"
                    value={card.headline}
                    onChange={e => updateCard(idx, { headline: e.target.value })}
                    maxLength={40}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Destination URL</Label>
                  <Input
                    placeholder="https://…"
                    value={card.url}
                    onChange={e => updateCard(idx, { url: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description (optional)</Label>
                <Input
                  placeholder="Short description"
                  value={card.description}
                  onChange={e => updateCard(idx, { description: e.target.value })}
                  maxLength={30}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          ))}

          {cards.length < 10 && (
            <Button type="button" variant="outline" size="sm" onClick={addCard} className="w-full gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add card ({cards.length}/10)
            </Button>
          )}
          {cards.length < 2 && (
            <p className="text-xs text-amber-600 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              At least 2 cards are required for a carousel.
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── google responsive search ad ───────────────────────────────────────────
  if (state.ad_format === 'responsive_search') {
    const headlines     = state.creative_config.rsa_headlines ?? ['', '', '']
    const descriptions  = state.creative_config.rsa_descriptions ?? ['', '']

    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-base font-semibold">Responsive Search Ad</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Google mixes and matches your headlines and descriptions to find the best-performing combinations. Add 3–15 headlines and 2–4 descriptions.
          </p>
        </div>

        {/* Headlines */}
        <div className="space-y-2">
          <Label>Headlines (up to 30 characters each)</Label>
          <div className="space-y-2">
            {headlines.map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4 text-right shrink-0">{i + 1}</span>
                <Input
                  placeholder={`Headline ${i + 1}${i < 3 ? ' *' : ''}`}
                  value={h}
                  onChange={e => updateRsaHeadline(i, e.target.value)}
                  maxLength={30}
                  className="h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground w-6 tabular-nums shrink-0">{h.length}/30</span>
              </div>
            ))}
          </div>
          {headlines.length < 15 && (
            <Button type="button" variant="ghost" size="sm" onClick={addRsaHeadline} className="text-xs gap-1">
              <Plus className="h-3 w-3" /> Add headline
            </Button>
          )}
        </div>

        {/* Descriptions */}
        <div className="space-y-2">
          <Label>Descriptions (up to 90 characters each)</Label>
          <div className="space-y-2">
            {descriptions.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4 text-right shrink-0">{i + 1}</span>
                <Input
                  placeholder={`Description ${i + 1}${i < 2 ? ' *' : ''}`}
                  value={d}
                  onChange={e => updateRsaDescription(i, e.target.value)}
                  maxLength={90}
                  className="h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground w-6 tabular-nums shrink-0">{d.length}/90</span>
              </div>
            ))}
          </div>
          {descriptions.length < 4 && (
            <Button type="button" variant="ghost" size="sm" onClick={addRsaDesc} className="text-xs gap-1">
              <Plus className="h-3 w-3" /> Add description
            </Button>
          )}
        </div>

        {/* Final URL + Display URL */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Final URL <span className="text-rose-500">*</span></Label>
            <Input
              placeholder="https://yourbrand.com/page"
              value={state.destination_url}
              onChange={e => set('destination_url', e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Display URL path <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <div className="flex items-center">
              <span className="text-xs text-muted-foreground px-2 border border-r-0 rounded-l-md h-9 flex items-center bg-muted">yourbrand.com/</span>
              <Input
                placeholder="promo/launch"
                value={state.headline}
                onChange={e => set('headline', e.target.value)}
                maxLength={30}
                className="text-sm rounded-l-none"
              />
            </div>
            <p className="text-xs text-muted-foreground">Shown in the ad URL, up to 30 chars. No spaces.</p>
          </div>
        </div>
      </div>
    )
  }

  // ── google responsive display ─────────────────────────────────────────────
  if (state.ad_format === 'responsive_display') {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-base font-semibold">Responsive Display Ad</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Upload your image and write ad copy. Google adapts your ad to fit any placement size.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Main image <span className="text-rose-500">*</span></Label>
            <ImageUploadZone
              url={state.media_urls[0]}
              onUpload={url => set('media_urls', [url])}
              onRemove={() => set('media_urls', [])}
              hint="1.91:1 ratio, min 600 × 314 px"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Logo <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <ImageUploadZone
              url={state.creative_config.logo_url}
              onUpload={url => updateCreativeConfig({ logo_url: url })}
              onRemove={() => updateCreativeConfig({ logo_url: undefined })}
              hint="Square, min 128 × 128 px"
            />
          </div>
        </div>

        <AdCopyFields state={state} set={set} headlineLabel="Short headline (up to 30 chars)" headlineMax={30} showLongHeadline />
      </div>
    )
  }

  // ── text_ad (LinkedIn) ────────────────────────────────────────────────────
  if (state.ad_format === 'text_ad') {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-base font-semibold">Text Ad (LinkedIn Sidebar)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">A small ad with headline, description, and optional small image shown in LinkedIn's right column (desktop only).</p>
        </div>
        <div className="space-y-1.5">
          <Label>Small image (optional)</Label>
          <ImageUploadZone
            url={state.media_urls[0]}
            onUpload={url => set('media_urls', [url])}
            onRemove={() => set('media_urls', [])}
            hint="50 × 50 px recommended"
            className="max-w-[140px]"
          />
        </div>
        <AdCopyFields state={state} set={set} headlineLabel="Headline (up to 25 chars)" headlineMax={25} bodyLabel="Description (up to 75 chars)" bodyMax={75} />
      </div>
    )
  }

  // ── video (Meta) and TikTok in-feed video ────────────────────────────────────
  if (state.ad_format === 'video' || state.ad_format === 'tiktok_video') {
    const isTikTok = state.ad_format === 'tiktok_video'
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-base font-semibold">{isTikTok ? 'TikTok In-Feed Video' : 'Video Ad'}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isTikTok
              ? 'Full-screen vertical video (9:16). MP4 or WebM, up to 500 MB.'
              : 'Single video with copy. MP4, MOV, or WebM, up to 500 MB. Recommended ratio: 4:5 (Feed) or 9:16 (Stories/Reels).'}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Video file <span className="text-rose-500">*</span></Label>
          <VideoUploadZone
            url={state.media_urls[0]}
            onUpload={url => set('media_urls', [url])}
            onRemove={() => set('media_urls', [])}
          />
        </div>

        {!isTikTok && (
          <>
            <div className="space-y-1.5">
              <Label>Thumbnail image (optional — auto-generated if omitted)</Label>
              <ImageUploadZone
                url={state.creative_config.thumbnail_url}
                onUpload={url => updateCreativeConfig({ thumbnail_url: url })}
                onRemove={() => updateCreativeConfig({ thumbnail_url: undefined })}
                hint="1200 × 628 px recommended"
              />
            </div>
            <AdCopyFields state={state} set={set} />
          </>
        )}

        {isTikTok && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Caption / Primary text</Label>
              <Textarea
                placeholder="What your video is about — shown as the caption…"
                value={state.body}
                onChange={e => set('body', e.target.value)}
                rows={3}
                maxLength={150}
                className="text-sm resize-none"
              />
              <p className="text-xs text-muted-foreground text-right tabular-nums">{state.body.length}/150</p>
            </div>
            <div className="space-y-1.5">
              <Label>Display name / Brand name</Label>
              <Input
                placeholder="Your brand name as shown on TikTok"
                value={state.headline}
                onChange={e => set('headline', e.target.value)}
                maxLength={40}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Destination URL</Label>
              <Input
                type="url"
                placeholder="https://example.com/landing-page"
                value={state.destination_url}
                onChange={e => set('destination_url', e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Call to action</Label>
              <Select value={state.cta} onValueChange={v => set('cta', v ?? 'Learn More')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Learn More', 'Shop Now', 'Sign Up', 'Download', 'Contact Us', 'Watch More'].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Fallback
  return (
    <div className="border rounded-xl p-8 text-center space-y-2">
      <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto" />
      <p className="text-sm text-muted-foreground">Select an ad format in the previous step.</p>
    </div>
  )
}

// ── shared ad copy fields ─────────────────────────────────────────────────────

function AdCopyFields({
  state, set,
  headlineLabel = 'Headline *',
  headlineMax = 150,
  bodyLabel = 'Primary text / Body',
  bodyMax = 500,
  showLongHeadline = false,
}: {
  state: WizardState
  set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void
  headlineLabel?: string
  headlineMax?: number
  bodyLabel?: string
  bodyMax?: number
  showLongHeadline?: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{headlineLabel}</Label>
        <Input
          placeholder="e.g. Discover the best deals in Lagos today"
          value={state.headline}
          onChange={e => set('headline', e.target.value)}
          maxLength={headlineMax}
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground text-right tabular-nums">{state.headline.length}/{headlineMax}</p>
      </div>

      {showLongHeadline && (
        <div className="space-y-1.5">
          <Label>Long headline (up to 90 chars)</Label>
          <Input
            placeholder="A longer headline shown in some placements"
            value={state.body}
            onChange={e => set('body', e.target.value)}
            maxLength={90}
            className="text-sm"
          />
        </div>
      )}

      {!showLongHeadline && (
        <div className="space-y-1.5">
          <Label>{bodyLabel}</Label>
          <Textarea
            placeholder="Tell people what you're offering and why it matters…"
            value={state.body}
            onChange={e => set('body', e.target.value)}
            rows={4}
            maxLength={bodyMax}
            className="text-sm resize-none"
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Call to action</Label>
          <Select value={state.cta} onValueChange={v => set('cta', v ?? 'Learn More')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CTAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Destination URL <span className="text-rose-500">*</span></Label>
          <Input
            type="url"
            placeholder="https://yourbrand.com/promo"
            value={state.destination_url}
            onChange={e => set('destination_url', e.target.value)}
            className="text-sm"
          />
        </div>
      </div>
    </div>
  )
}

// ── step 4: audience ──────────────────────────────────────────────────────────

function StepAudience({ state, setState }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>> }) {
  const aud = state.target_audience
  function setAud<K extends keyof TargetAudience>(k: K, v: TargetAudience[K]) {
    setState(prev => ({ ...prev, target_audience: { ...prev.target_audience, [k]: v } }))
  }

  function toggleLocation(loc: string) {
    setAud('locations', aud.locations.includes(loc)
      ? aud.locations.filter(l => l !== loc)
      : [...aud.locations, loc]
    )
  }

  const isGoogle = state.platform === 'google'
  const isMeta   = state.platform === 'meta'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Audience targeting</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Define who sees your ad. Narrower audiences are more efficient; broader audiences build awareness.</p>
      </div>

      {/* Locations */}
      <div className="space-y-2">
        <Label>Locations</Label>
        <div className="flex flex-wrap gap-1.5">
          {NG_LOCATIONS.map(loc => (
            <button
              key={loc}
              type="button"
              onClick={() => toggleLocation(loc)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border transition-colors',
                aud.locations.includes(loc)
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border text-muted-foreground hover:border-primary/40',
              )}
            >
              {loc}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{aud.locations.length} location{aud.locations.length !== 1 ? 's' : ''} selected</p>
      </div>

      {/* Age + gender */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Min age</Label>
          <Select
            value={String(aud.age_min)}
            onValueChange={v => setAud('age_min', Number(v))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[18,21,25,30,35,40,45,50,55,60,65].map(a => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Max age</Label>
          <Select
            value={String(aud.age_max)}
            onValueChange={v => setAud('age_max', Number(v))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[25,30,35,40,45,50,55,60,65].map(a => (
                <SelectItem key={a} value={String(a)}>{a === 65 ? '65+' : String(a)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Gender</Label>
          <Select value={aud.gender} onValueChange={v => setAud('gender', v as 'all' | 'male' | 'female')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All genders</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Device */}
      <div className="space-y-1.5">
        <Label>Device</Label>
        <div className="flex gap-2">
          {(['all','mobile','desktop'] as DeviceTarget[]).map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setAud('device', d)}
              className={cn(
                'flex-1 border rounded-lg py-2 text-xs font-medium capitalize transition-colors',
                aud.device === d
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40',
              )}
            >
              {d === 'all' ? 'All devices' : d}
            </button>
          ))}
        </div>
      </div>

      {/* Interests (Meta, LinkedIn, Twitter) */}
      {(isMeta || state.platform === 'linkedin' || state.platform === 'twitter') && (
        <div className="space-y-1.5">
          <Label>Interests &amp; behaviors <span className="text-muted-foreground text-xs">(detailed targeting)</span></Label>
          <p className="text-xs text-muted-foreground">
            Type interests and press Enter — e.g. "Nigerian food", "fashion", "personal finance"
          </p>
          <TagInput
            tags={aud.interests}
            onAdd={t => setAud('interests', [...aud.interests, t])}
            onRemove={t => setAud('interests', aud.interests.filter(i => i !== t))}
            placeholder="Add an interest…"
          />
        </div>
      )}

      {/* Keywords (Google) */}
      {isGoogle && state.ad_format === 'responsive_search' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Keywords <span className="text-rose-500">*</span></Label>
            <p className="text-xs text-muted-foreground">
              Words or phrases your customers search for. Use broad, phrase, or exact match (wrap in quotes or brackets).
            </p>
            <TagInput
              tags={aud.keywords}
              onAdd={t => setAud('keywords', [...aud.keywords, t])}
              onRemove={t => setAud('keywords', aud.keywords.filter(k => k !== t))}
              placeholder='Add keyword e.g. "buy running shoes Lagos"'
            />
          </div>
          <div className="space-y-1.5">
            <Label>Negative keywords <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <p className="text-xs text-muted-foreground">Keywords that should NOT trigger your ad.</p>
            <TagInput
              tags={aud.negative_keywords}
              onAdd={t => setAud('negative_keywords', [...aud.negative_keywords, t])}
              onRemove={t => setAud('negative_keywords', aud.negative_keywords.filter(k => k !== t))}
              placeholder="Add negative keyword…"
            />
          </div>
        </div>
      )}

      {/* Custom audience notes */}
      <div className="space-y-1.5">
        <Label>Custom audience <span className="text-muted-foreground text-xs">(notes)</span></Label>
        <Textarea
          placeholder="e.g. Retarget website visitors from last 30 days, or Lookalike of top 5% customers…"
          value={aud.custom_audience_notes}
          onChange={e => setAud('custom_audience_notes', e.target.value)}
          rows={3}
          className="text-sm resize-none"
        />
        <p className="text-xs text-muted-foreground">Notes for the person setting up the ad on the platform (custom/lookalike audiences must be pre-built in Ads Manager).</p>
      </div>
    </div>
  )
}

// ── step 5: budget, schedule, placement ───────────────────────────────────────

function StepBudget({ state, setState }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>> }) {
  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) => setState(prev => ({ ...prev, [k]: v }))
  const platformPlacements = PLACEMENTS_BY_PLATFORM[state.platform] ?? []
  const optimizationOptions = OPTIMIZATION_GOALS[state.objective] ?? []

  function togglePlacement(id: string) {
    set('placement', state.placement.includes(id)
      ? state.placement.filter(p => p !== id)
      : [...state.placement, id]
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Budget, schedule &amp; delivery</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Set how much to spend, when to run, and where to show the ad.</p>
      </div>

      {/* Ad set name */}
      <div className="space-y-1.5">
        <Label>Ad set name <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Input
          placeholder={`${PLATFORMS.find(p => p.value === state.platform)?.label ?? 'Ad'} Set 1`}
          value={state.ad_set_name}
          onChange={e => set('ad_set_name', e.target.value)}
          className="text-sm"
        />
      </div>

      {/* Budget type */}
      <div className="space-y-2">
        <Label>Budget type</Label>
        <div className="flex gap-2">
          {(['daily', 'lifetime'] as BudgetType[]).map(bt => (
            <button
              key={bt}
              type="button"
              onClick={() => set('budget_type', bt)}
              className={cn(
                'flex-1 border rounded-lg py-2 text-sm font-medium capitalize transition-colors',
                state.budget_type === bt
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40',
              )}
            >
              {bt}
            </button>
          ))}
        </div>
      </div>

      {/* Budget amount */}
      {state.budget_type === 'daily' ? (
        <div className="space-y-1.5">
          <Label>Daily budget (₦)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₦</span>
            <Input
              type="number"
              min={500}
              step={100}
              placeholder="5,000"
              value={state.budget_daily}
              onChange={e => set('budget_daily', e.target.value)}
              className="pl-7 text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">Minimum ₦500/day</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label>Lifetime budget (₦)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₦</span>
            <Input
              type="number"
              min={1000}
              step={1000}
              placeholder="50,000"
              value={state.budget_total}
              onChange={e => set('budget_total', e.target.value)}
              className="pl-7 text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">Total spend across the campaign flight. End date required.</p>
        </div>
      )}

      {/* Schedule */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Start date</Label>
          <Input
            type="date"
            value={state.start_date}
            onChange={e => set('start_date', e.target.value)}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">Leave blank to start when approved.</p>
        </div>
        <div className="space-y-1.5">
          <Label>End date {state.budget_type === 'lifetime' && <span className="text-rose-500">*</span>}</Label>
          <Input
            type="date"
            value={state.end_date}
            onChange={e => set('end_date', e.target.value)}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">Leave blank for ongoing (daily budget only).</p>
        </div>
      </div>

      {/* Optimization goal */}
      {optimizationOptions.length > 0 && (
        <div className="space-y-1.5">
          <Label>Optimization goal</Label>
          <Select
            value={state.optimization_goal}
            onValueChange={v => set('optimization_goal', v ?? '')}
          >
            <SelectTrigger><SelectValue placeholder="Select goal" /></SelectTrigger>
            <SelectContent>
              {optimizationOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">The platform optimizes delivery to get the most of this metric.</p>
        </div>
      )}

      {/* Bid strategy */}
      <div className="space-y-2">
        <Label>Bid strategy</Label>
        <div className="grid sm:grid-cols-2 gap-2">
          {[
            { value: 'lowest_cost', label: 'Lowest cost', desc: 'Spend budget to get most results at lowest cost (recommended)' },
            { value: 'bid_cap',     label: 'Bid cap',     desc: 'Control max amount spent per result' },
            { value: 'target_cost', label: 'Target cost', desc: 'Aim for a specific average cost per result' },
            { value: 'target_roas', label: 'Target ROAS', desc: 'Aim for a specific return on ad spend (sales campaigns)' },
          ].filter(bs => bs.value !== 'target_roas' || state.objective === 'sales').map(bs => (
            <button
              key={bs.value}
              type="button"
              onClick={() => set('bid_strategy', bs.value as BidStrategy)}
              className={cn(
                'border rounded-xl p-3 text-left transition-colors',
                state.bid_strategy === bs.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40',
              )}
            >
              <p className="text-xs font-semibold">{bs.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{bs.desc}</p>
            </button>
          ))}
        </div>
        {state.bid_strategy !== 'lowest_cost' && (
          <div className="relative mt-2">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₦</span>
            <Input
              type="number"
              min={1}
              placeholder={state.bid_strategy === 'target_roas' ? 'e.g. 3.5 (3.5× ROAS)' : 'Max bid amount'}
              value={state.bid_amount}
              onChange={e => set('bid_amount', e.target.value)}
              className="pl-7 text-sm"
            />
          </div>
        )}
      </div>

      {/* Placement */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label>Placements</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => set('placements_auto', true)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-lg border transition-colors font-medium',
                state.placements_auto
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40',
              )}
            >
              Automatic
            </button>
            <button
              type="button"
              onClick={() => set('placements_auto', false)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-lg border transition-colors font-medium',
                !state.placements_auto
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40',
              )}
            >
              Manual
            </button>
          </div>
        </div>
        {state.placements_auto ? (
          <p className="text-xs text-muted-foreground">
            The platform automatically chooses the best placements to maximize your results (recommended).
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {platformPlacements.map(p => (
              <label
                key={p.id}
                className="flex items-center gap-2 cursor-pointer border rounded-lg p-2.5 hover:bg-muted/30 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={state.placement.includes(p.id)}
                  onChange={() => togglePlacement(p.id)}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm">{p.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── step 6: review ────────────────────────────────────────────────────────────

function StepReview({ state }: { state: WizardState }) {
  const platform = PLATFORMS.find(p => p.value === state.platform)
  const objective = OBJECTIVES.find(o => o.value === state.objective)
  const format = FORMATS_BY_PLATFORM[state.platform]?.find(f => f.value === state.ad_format)
  const aud = state.target_audience
  const budget = state.budget_type === 'daily'
    ? (state.budget_daily ? `₦${Number(state.budget_daily).toLocaleString('en-NG')}/day` : '—')
    : (state.budget_total ? `₦${Number(state.budget_total).toLocaleString('en-NG')} lifetime` : '—')

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Review your draft</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Your ad will be saved as a draft. It goes live only after you review and push it from the Ads Drafts section.</p>
      </div>

      <div className="space-y-3 text-sm">
        {/* Campaign */}
        <Section title="Campaign">
          <Row label="Platform"   value={platform?.label ?? state.platform} />
          <Row label="Name"       value={state.campaign_name || <em className="text-muted-foreground">Untitled</em>} />
          <Row label="Objective"  value={objective?.label ?? state.objective} />
          <Row label="Format"     value={format?.label ?? state.ad_format} />
        </Section>

        {/* Creative */}
        {(state.media_urls.length > 0 || state.headline) && (
          <Section title="Creative">
            {state.media_urls.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {state.media_urls.map(url => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt="Creative" className="h-16 w-16 rounded object-cover border" />
                ))}
              </div>
            )}
            {state.ad_format === 'carousel' && (
              <Row label="Cards" value={`${state.creative_config.cards?.length ?? 0} cards`} />
            )}
            {state.ad_format === 'responsive_search' && (
              <>
                <Row label="Headlines"    value={`${state.creative_config.rsa_headlines?.filter(Boolean).length ?? 0}`} />
                <Row label="Descriptions" value={`${state.creative_config.rsa_descriptions?.filter(Boolean).length ?? 0}`} />
              </>
            )}
            {state.headline && <Row label="Headline" value={state.headline} />}
            {state.body     && <Row label="Body"     value={state.body.slice(0, 80) + (state.body.length > 80 ? '…' : '')} />}
            {state.cta      && <Row label="CTA"      value={state.cta} />}
            {state.destination_url && <Row label="URL" value={state.destination_url} />}
          </Section>
        )}

        {/* Audience */}
        <Section title="Audience">
          <Row label="Locations" value={aud.locations.join(', ') || '—'} />
          <Row label="Age"       value={`${aud.age_min} – ${aud.age_max === 65 ? '65+' : aud.age_max}`} />
          <Row label="Gender"    value={aud.gender === 'all' ? 'All genders' : aud.gender} />
          {aud.interests.length > 0 && <Row label="Interests" value={aud.interests.join(', ')} />}
          {aud.keywords.length > 0  && <Row label="Keywords"  value={aud.keywords.join(', ')} />}
          <Row label="Device"    value={aud.device === 'all' ? 'All devices' : aud.device} />
        </Section>

        {/* Budget */}
        <Section title="Budget &amp; Schedule">
          <Row label="Budget"    value={budget} />
          <Row label="Start"     value={state.start_date || 'On approval'} />
          <Row label="End"       value={state.end_date || 'Ongoing'} />
          <Row label="Placements" value={state.placements_auto ? 'Automatic' : state.placement.join(', ') || '—'} />
          <Row label="Bid"       value={state.bid_strategy.replace(/_/g, ' ')} />
        </Section>
      </div>

      <div className="border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/30 rounded-xl px-4 py-3">
        <p className="text-xs text-amber-800 dark:text-amber-300">
          This draft will be saved with status <strong>Draft</strong>. It will not go live until reviewed and pushed from the Ads Drafts panel.
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="bg-muted/40 px-4 py-2 border-b">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      </div>
      <div className="px-4 py-3 space-y-1.5">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground pt-0.5">{label}</span>
      <span className="text-sm flex-1 break-all">{value}</span>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function CreateAdPage() {
  const router  = useRouter()
  const [step, setStep]     = useState(1)
  const [saving, setSaving] = useState(false)
  const [state, setState]   = useState<WizardState>(DEFAULT_STATE)

  function nextStep() { setStep(s => Math.min(s + 1, STEPS.length)) }
  function prevStep() { setStep(s => Math.max(s - 1, 1)) }

  function validateStep(): string | null {
    if (step === 1) {
      if (!state.campaign_name.trim()) return 'Enter a campaign name.'
    }
    if (step === 2) {
      if (!state.ad_format) return 'Select an ad format.'
    }
    if (step === 3) {
      if (state.ad_format === 'single_image' || state.ad_format === 'linkedin_image') {
        if (!state.media_urls[0]) return 'Upload an image for your ad.'
        if (!state.headline.trim()) return 'Headline is required.'
        if (!state.destination_url.trim()) return 'Destination URL is required.'
      }
      if (state.ad_format === 'carousel' || state.ad_format === 'linkedin_carousel') {
        const cards = state.creative_config.cards ?? []
        if (cards.length < 2) return 'Add at least 2 carousel cards.'
        if (cards.some(c => !c.image_url)) return 'Every carousel card needs an image.'
        if (cards.some(c => !c.headline.trim())) return 'Every carousel card needs a headline.'
        if (cards.some(c => !c.url.trim())) return 'Every carousel card needs a destination URL.'
      }
      if (state.ad_format === 'responsive_search') {
        const hs = (state.creative_config.rsa_headlines ?? []).filter(Boolean)
        const ds = (state.creative_config.rsa_descriptions ?? []).filter(Boolean)
        if (hs.length < 3) return 'Add at least 3 headlines for a Responsive Search Ad.'
        if (ds.length < 2) return 'Add at least 2 descriptions for a Responsive Search Ad.'
        if (!state.destination_url.trim()) return 'Final URL is required.'
      }
      if (state.ad_format === 'responsive_display') {
        if (!state.media_urls[0]) return 'Upload an image for your Display Ad.'
        if (!state.headline.trim()) return 'Headline is required.'
        if (!state.destination_url.trim()) return 'Final URL is required.'
      }
    }
    if (step === 4) {
      if (state.target_audience.locations.length === 0) return 'Select at least one location.'
      if (state.platform === 'google' && state.ad_format === 'responsive_search' && state.target_audience.keywords.length === 0) {
        return 'Add at least one keyword for a Google Search Ad.'
      }
    }
    if (step === 5) {
      if (state.budget_type === 'daily' && !state.budget_daily) return 'Enter a daily budget.'
      if (state.budget_type === 'lifetime' && !state.budget_total) return 'Enter a lifetime budget.'
      if (state.budget_type === 'lifetime' && !state.end_date) return 'A lifetime budget requires an end date.'
    }
    return null
  }

  function handleNext() {
    const err = validateStep()
    if (err) { toast.error(err); return }
    // On step 2 format selection, init carousel cards if needed
    if (step === 2 && (state.ad_format === 'carousel' || state.ad_format === 'linkedin_carousel')) {
      if (!state.creative_config.cards?.length) {
        setState(prev => ({
          ...prev,
          creative_config: {
            ...prev.creative_config,
            cards: [
              { image_url: '', headline: '', description: '', url: '', cta: 'Learn More' },
              { image_url: '', headline: '', description: '', url: '', cta: 'Learn More' },
            ],
          },
        }))
      }
    }
    // Init RSA arrays
    if (step === 2 && state.ad_format === 'responsive_search') {
      if (!state.creative_config.rsa_headlines?.length) {
        setState(prev => ({
          ...prev,
          creative_config: {
            ...prev.creative_config,
            rsa_headlines: ['', '', ''],
            rsa_descriptions: ['', ''],
          },
        }))
      }
    }
    nextStep()
  }

  const handleSubmit = useCallback(async () => {
    setSaving(true)
    try {
      const payload = {
        platform:            state.platform,
        campaign_name:       state.campaign_name.trim() || null,
        ad_set_name:         state.ad_set_name.trim() || null,
        objective:           state.objective,
        special_ad_category: state.special_ad_category,
        ad_format:           state.ad_format,
        headline:            state.headline,
        body:                state.body    || null,
        cta:                 state.cta     || null,
        destination_url:     state.destination_url,
        media_urls:          state.media_urls,
        creative_config:     state.creative_config,
        target_audience:     state.target_audience,
        placements_auto:     state.placements_auto,
        placement:           state.placements_auto ? [] : state.placement,
        budget_daily:        state.budget_type === 'daily'     ? Number(state.budget_daily) || null : null,
        budget_total:        state.budget_type === 'lifetime'  ? Number(state.budget_total) || null : null,
        start_date:          state.start_date || null,
        end_date:            state.end_date   || null,
        optimization_goal:   state.optimization_goal || null,
        bid_strategy:        state.bid_strategy,
        bid_amount:          state.bid_amount ? Number(state.bid_amount) : null,
      }

      const res = await fetch('/api/ads/drafts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Failed to save draft')
      }

      toast.success('Ad draft saved. View it in Ad Drafts.')
      router.push('/dashboard/digital/drafts')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }, [state, router])

  return (
    <div className="max-w-2xl space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.push('/dashboard/digital')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
            <Megaphone className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Create Ad</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Draft saved first — you review before going live.</p>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1 shrink-0">
            <div className={cn(
              'h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
              step > s.id  ? 'bg-emerald-500 text-white'
              : step === s.id ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
            )}>
              {step > s.id ? <Check className="h-3.5 w-3.5" /> : s.id}
            </div>
            <span className={cn(
              'text-xs font-medium hidden sm:block',
              step === s.id ? 'text-foreground' : 'text-muted-foreground'
            )}>{s.label}</span>
            {i < STEPS.length - 1 && (
              <div className={cn('h-px w-5 mx-1 transition-colors', step > s.id ? 'bg-emerald-500' : 'bg-border')} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="border rounded-2xl p-5 bg-card">
        {step === 1 && <StepCampaign state={state} setState={setState} />}
        {step === 2 && <StepFormat   state={state} setState={setState} />}
        {step === 3 && <StepCreative state={state} setState={setState} />}
        {step === 4 && <StepAudience state={state} setState={setState} />}
        {step === 5 && <StepBudget   state={state} setState={setState} />}
        {step === 6 && <StepReview   state={state} />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={step === 1 ? () => router.push('/dashboard/digital') : prevStep}
          disabled={saving}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {step === 1 ? 'Cancel' : 'Back'}
        </Button>

        {step < STEPS.length ? (
          <Button onClick={handleNext}>
            Next
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</>
            ) : (
              <><Check className="mr-1.5 h-4 w-4" />Save draft</>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
