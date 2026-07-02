'use client'

import { useActionState, useState, useTransition, useEffect, useCallback } from 'react'
import { completeOnboarding, type OnboardingData } from './actions'
import type { BrandInferResult } from '@/app/api/ai/brand-infer/route'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Check, Sparkles, Globe, ArrowRight, ArrowLeft, Loader2, AlertCircle, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TagInput, CulturalSlider, SectionCard, CATEGORIES, CULTURAL_SLIDERS } from '@/components/onboarding/brand-profile-fields'
import { INDUSTRY_META, INDUSTRY_IDS, type IndustryId, getIndustryFromCategory } from '@/lib/industry-config'

const LOADING_MESSAGES = [
  'Reading your brand name...',
  'Analysing brand signals...',
  'Identifying your voice and tone...',
  'Mapping cultural positioning...',
  'Building your audience profile...',
  'Almost there...',
]

const SOURCE_LABELS: Record<string, string> = {
  brand_name:       'Brand name',
  website:          'Website',
  twitter_bio:      'X bio',
  twitter_posts:    'X posts',
  instagram_bio:    'Instagram bio',
  instagram_posts:  'Instagram posts',
}

const CONFIDENCE_META: Record<string, { label: string; class: string }> = {
  High:   { label: 'High confidence', class: 'bg-green-50 text-green-700 border-green-200' },
  Medium: { label: 'Medium confidence', class: 'bg-amber-50 text-amber-700 border-amber-200' },
  Low:    { label: 'Low confidence — review carefully', class: 'bg-muted text-muted-foreground border-border' },
}

type CulturalKey = 'community_corporate' | 'traditional_modern' | 'religious_secular' | 'mass_premium' | 'local_global'
type Screen = 'industry' | 'identify' | 'analysing' | 'review'

const defaultData: OnboardingData = {
  websiteUrl: '',
  brandName: '',
  industry: '',
  category: '',
  brandValues: [],
  brandVoice: { adjectives: [], tone: '', dos: [], donts: [], signaturePhrases: [] },
  culturalProfile: { community_corporate: 50, traditional_modern: 50, religious_secular: 50, mass_premium: 50, local_global: 50 },
  targetSegments: [],
}

// ── Sub-components ────────────────────────────────────────────────────────────

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [screen, setScreen]   = useState<Screen>('industry')
  const [brandName, setBrandName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [data, setData]       = useState<OnboardingData>(defaultData)
  const [confidence, setConfidence] = useState<'High' | 'Medium' | 'Low'>('Medium')
  const [sources, setSources] = useState<string[]>([])
  const [inferError, setInferError] = useState(false)
  const [msgIdx, setMsgIdx]   = useState(0)
  const [state, action]       = useActionState(completeOnboarding, null)
  const [isPending, startTransition] = useTransition()

  // Cycle loading messages while analysing
  useEffect(() => {
    if (screen !== 'analysing') return
    const id = setInterval(() => setMsgIdx(i => Math.min(i + 1, LOADING_MESSAGES.length - 1)), 1800)
    return () => clearInterval(id)
  }, [screen])

  if (state?.error) toast.error(state.error)

  // ── Helpers ──
  function patch<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) {
    setData(d => ({ ...d, [key]: value }))
  }
  function patchVoice<K extends keyof OnboardingData['brandVoice']>(key: K, value: OnboardingData['brandVoice'][K]) {
    setData(d => ({ ...d, brandVoice: { ...d.brandVoice, [key]: value } }))
  }
  function patchCulture(key: CulturalKey, value: number) {
    setData(d => ({ ...d, culturalProfile: { ...d.culturalProfile, [key]: value } }))
  }
  function patchSegment(i: number, field: string, value: string) {
    const updated = [...data.targetSegments]
    updated[i] = { ...updated[i], [field]: value }
    patch('targetSegments', updated)
  }

  const runInference = useCallback(async () => {
    setScreen('analysing')
    setMsgIdx(0)
    setInferError(false)

    try {
      const res = await fetch('/api/ai/brand-infer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName, websiteUrl: websiteUrl || undefined }),
      })

      if (!res.ok) throw new Error('inference_failed')
      const result = await res.json() as BrandInferResult

      setData({
        websiteUrl,
        brandName,
        industry:        data.industry,
        category:        result.category || 'Other',
        brandValues:     result.brandValues ?? [],
        brandVoice:      {
          adjectives:       result.brandVoice?.adjectives ?? [],
          tone:             result.brandVoice?.tone ?? '',
          dos:              result.brandVoice?.dos ?? [],
          donts:            result.brandVoice?.donts ?? [],
          signaturePhrases: result.brandVoice?.signaturePhrases ?? [],
        },
        culturalProfile: {
          community_corporate: result.culturalProfile?.community_corporate ?? 50,
          traditional_modern:  result.culturalProfile?.traditional_modern  ?? 50,
          religious_secular:   result.culturalProfile?.religious_secular   ?? 50,
          mass_premium:        result.culturalProfile?.mass_premium        ?? 50,
          local_global:        result.culturalProfile?.local_global        ?? 50,
        },
        targetSegments: (result.targetSegments ?? []).map(s => ({
          name:         s.name ?? '',
          demographics: s.demographics ?? '',
          geography:    s.geography ?? '',
        })),
      })
      setConfidence(result.confidence ?? 'Medium')
      setSources(result.inferenceSources ?? ['brand_name'])
    } catch {
      // Inference failed — proceed to review with empty pre-fills
      setData({ ...defaultData, industry: data.industry, brandName, websiteUrl })
      setConfidence('Low')
      setSources(['brand_name'])
      setInferError(true)
    }

    setScreen('review')
  }, [brandName, websiteUrl])

  function submit() {
    startTransition(() => {
      const fd = new FormData()
      fd.set('payload', JSON.stringify(data))
      action(fd)
    })
  }

  // ── Screen 0: Industry picker ─────────────────────────────────────────────
  if (screen === 'industry') {
    return (
      <div className="min-h-screen bg-muted/40 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex h-10 w-10 rounded-full bg-foreground items-center justify-center mb-2">
              <Sparkles className="h-5 w-5 text-background" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">What kind of brand are you?</h1>
            <p className="text-sm text-muted-foreground">
              This shapes which modules, metrics and connectors we show you. You can change it any time.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {INDUSTRY_IDS.map(id => {
              const meta = INDUSTRY_META[id]
              const selected = data.industry === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => patch('industry', id)}
                  className={cn(
                    'relative text-left rounded-xl border p-4 transition-all duration-150 bg-card hover:border-foreground/40 hover:shadow-sm',
                    selected && 'border-foreground ring-2 ring-foreground/10 bg-card shadow-sm',
                    !selected && 'border-border',
                  )}
                >
                  {selected && (
                    <span className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground">
                      <Check className="h-2.5 w-2.5 text-background" />
                    </span>
                  )}
                  <span className="text-2xl leading-none block mb-2">{meta.icon}</span>
                  <span className="text-[13px] font-semibold leading-snug block">{meta.label}</span>
                  <span className="text-[11px] text-muted-foreground leading-snug mt-0.5 block line-clamp-2">
                    {meta.tagline}
                  </span>
                  {meta.examples && (
                    <span className="text-[10px] text-muted-foreground/60 mt-1.5 block truncate">
                      e.g. {meta.examples}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={!data.industry}
            onClick={() => {
              // Pre-fill category from industry selection
              const industryMeta = INDUSTRY_META[data.industry as IndustryId]
              if (industryMeta && !data.category) {
                patch('category', industryMeta.label)
              }
              setScreen('identify')
            }}
          >
            Continue
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    )
  }

  // ── Screen 1: Identify ────────────────────────────────────────────────────
  if (screen === 'identify') {
    return (
      <div className="min-h-screen bg-muted/40 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex h-10 w-10 rounded-full bg-foreground items-center justify-center mb-2">
              <Sparkles className="h-5 w-5 text-background" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Set up your brand</h1>
            <p className="text-sm text-muted-foreground">
              Give us a starting point — we will do the research and pre-fill the rest.
            </p>
          </div>

          <div className="bg-card border rounded-xl p-6 space-y-5 shadow-sm">
            <div className="space-y-2">
              <Label htmlFor="brandName">Brand name <span className="text-destructive">*</span></Label>
              <Input
                id="brandName"
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                placeholder="e.g. Sweetness Studios, Paystack, Flutterwave"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="websiteUrl" className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                Website URL
                <span className="text-muted-foreground font-normal">(optional — improves accuracy)</span>
              </Label>
              <Input
                id="websiteUrl"
                value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                placeholder="https://yourbrand.com"
                type="url"
              />
            </div>

            <Button
              className="w-full"
              onClick={runInference}
              disabled={!brandName.trim()}
            >
              Analyse my brand
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <button
              type="button"
              onClick={() => setScreen('industry')}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
            >
              <ArrowLeft className="h-3 w-3 inline mr-1" />
              Change industry
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            We will read your website and any connected social accounts to pre-fill your brand profile.
            You confirm everything before anything is saved.
          </p>
          <p className="text-center text-xs text-muted-foreground/50">
            Wrong account?{' '}
            <a href="/api/auth/signout" className="underline hover:text-muted-foreground">Sign out</a>
          </p>
        </div>
      </div>
    )
  }

  // ── Screen 2: Analysing ───────────────────────────────────────────────────
  if (screen === 'analysing') {
    return (
      <div className="min-h-screen bg-muted/40 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="inline-flex h-12 w-12 rounded-full bg-foreground items-center justify-center">
            <Loader2 className="h-6 w-6 text-background animate-spin" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Analysing {brandName}</h2>
            <p className="text-sm text-muted-foreground transition-all duration-500 min-h-[20px]">
              {LOADING_MESSAGES[msgIdx]}
            </p>
          </div>
          {websiteUrl && (
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <Globe className="h-3 w-3" /> Reading {websiteUrl}
            </p>
          )}
          <button
            type="button"
            onClick={() => setScreen('identify')}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Cancel and go back
          </button>
        </div>
      </div>
    )
  }

  // ── Screen 3: Review ──────────────────────────────────────────────────────
  const confidenceMeta = CONFIDENCE_META[confidence] ?? CONFIDENCE_META.Medium
  const sourceLabels = sources.map(s => SOURCE_LABELS[s] ?? s).join(' · ')

  return (
    <div className="min-h-screen bg-muted/40 py-10 px-4">
      <div className="w-full max-w-xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {inferError ? 'Set up your brand' : "Here's your brand profile"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {inferError
              ? "We couldn't analyse your brand automatically — fill in the details below."
              : 'Review what we found. Edit anything that looks off. Everything can be updated in settings later.'}
          </p>
        </div>

        {/* Inference banner */}
        {!inferError ? (
          <div className={cn('rounded-xl border px-4 py-3 flex flex-wrap items-center gap-2 text-sm', confidenceMeta.class)}>
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium">{confidenceMeta.label}</span>
            <span className="text-xs opacity-70">Based on: {sourceLabels}</span>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-2 text-sm text-amber-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>AI analysis unavailable — fields are empty. Fill them in below or add a website URL and try again.</span>
          </div>
        )}

        {/* ── Category & Values ── */}
        <SectionCard title="Category & Values">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Category</Label>
            <Select value={data.category} onValueChange={v => patch('category', v ?? '')}>
              <SelectTrigger><SelectValue placeholder="Select your industry" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <TagInput
            label="Brand values"
            placeholder="e.g. transparency, community, boldness"
            values={data.brandValues}
            onChange={v => patch('brandValues', v)}
          />
        </SectionCard>

        {/* ── Brand Voice ── */}
        <SectionCard title="Brand Voice">
          <TagInput
            label="Voice adjectives"
            placeholder="e.g. bold, warm, direct"
            values={data.brandVoice.adjectives}
            onChange={v => patchVoice('adjectives', v)}
          />
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tone description</Label>
            <Textarea
              value={data.brandVoice.tone}
              onChange={e => patchVoice('tone', e.target.value)}
              placeholder="e.g. Friendly and direct. We speak like a smart older sibling, not a bank."
              rows={2}
              className="text-sm resize-none"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TagInput label="Dos" placeholder="e.g. use simple language" values={data.brandVoice.dos} onChange={v => patchVoice('dos', v)} />
            <TagInput label="Don'ts" placeholder="e.g. avoid jargon" values={data.brandVoice.donts} onChange={v => patchVoice('donts', v)} />
          </div>
          <TagInput
            label="Signature phrases"
            placeholder="e.g. 'Your money, your freedom'"
            values={data.brandVoice.signaturePhrases}
            onChange={v => patchVoice('signaturePhrases', v)}
            hint="Only add phrases that actually appear in your content."
          />
        </SectionCard>

        {/* ── Cultural Profile ── */}
        <SectionCard title="Cultural Positioning">
          <p className="text-xs text-muted-foreground -mt-2">
            Where does your brand sit on each cultural axis? This shapes how the AI reads sentiment and cultural fit.
          </p>
          <div className="space-y-5">
            {CULTURAL_SLIDERS.map(s => (
              <CulturalSlider
                key={s.key} left={s.left} right={s.right} hint={s.hint}
                value={data.culturalProfile[s.key]}
                onChange={v => patchCulture(s.key, v)}
              />
            ))}
          </div>
        </SectionCard>

        {/* ── Target Audience ── */}
        <SectionCard title="Target Audience">
          <div className="space-y-3">
            {data.targetSegments.map((seg, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-2.5 bg-background">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-muted-foreground">Segment {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => patch('targetSegments', data.targetSegments.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Input placeholder="Segment name (e.g. Young urban professionals)" value={seg.name}
                  onChange={e => patchSegment(i, 'name', e.target.value)} className="text-sm" />
                <Input placeholder="Demographics (e.g. 22-35, Lagos, smartphone users)" value={seg.demographics ?? ''}
                  onChange={e => patchSegment(i, 'demographics', e.target.value)} className="text-sm" />
                <Input placeholder="Geography (e.g. Lagos, Abuja, Port Harcourt)" value={seg.geography ?? ''}
                  onChange={e => patchSegment(i, 'geography', e.target.value)} className="text-sm" />
              </div>
            ))}
            <Button type="button" variant="outline" className="w-full text-sm" size="sm"
              onClick={() => patch('targetSegments', [...data.targetSegments, { name: '', demographics: '', geography: '' }])}>
              <Plus className="h-3.5 w-3.5 mr-2" /> Add segment
            </Button>
            {data.targetSegments.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-1">
                You can add segments now or from the dashboard later.
              </p>
            )}
          </div>
        </SectionCard>

        {/* ── Actions ── */}
        <div className="space-y-3 pb-8">
          <Button
            className="w-full"
            size="lg"
            onClick={submit}
            disabled={!data.brandName.trim() || !data.category || isPending}
          >
            {isPending
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              : <><Check className="h-4 w-4 mr-2" /> Looks good — take me in</>
            }
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground hover:text-foreground"
            onClick={() => setScreen('identify')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Change brand name or website
          </Button>
          <p className="text-center text-xs text-muted-foreground/50 pt-1">
            Wrong account?{' '}
            <a href="/api/auth/signout" className="underline hover:text-muted-foreground">Sign out</a>
          </p>
        </div>
      </div>
    </div>
  )
}
