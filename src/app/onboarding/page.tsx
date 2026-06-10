'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { completeOnboarding, type OnboardingData } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { X, Plus, ChevronRight, ChevronLeft, Check } from 'lucide-react'

const CATEGORIES = [
  'Fintech', 'FMCG', 'Telco', 'Fashion & Apparel', 'Healthcare',
  'Education', 'Entertainment & Media', 'Retail', 'Real Estate',
  'Logistics', 'Food & Beverage', 'Automotive', 'Other',
]

const STEPS = ['Brand', 'Voice', 'Culture', 'Audience', 'Review']

const CULTURAL_SLIDERS = [
  { key: 'community_corporate' as const, left: 'Community', right: 'Corporate',
    hint: 'Do you lead with people and community, or with brand authority?' },
  { key: 'traditional_modern' as const, left: 'Traditional', right: 'Modern',
    hint: 'Deep roots in Nigerian/African heritage, or forward-looking?' },
  { key: 'religious_secular' as const, left: 'Religious', right: 'Secular',
    hint: 'Spiritual language and cues, or neutral on religion?' },
  { key: 'mass_premium' as const, left: 'Mass market', right: 'Premium',
    hint: 'Everyday affordability, or aspirational positioning?' },
  { key: 'local_global' as const, left: 'Local', right: 'Global',
    hint: 'Proudly Nigerian/African, or international appeal?' },
]

type CulturalKey = 'community_corporate' | 'traditional_modern' | 'religious_secular' | 'mass_premium' | 'local_global'

const defaultData: OnboardingData = {
  brandName: '',
  category: '',
  brandValues: [],
  brandVoice: { adjectives: [], tone: '', dos: [], donts: [], signaturePhrases: [] },
  culturalProfile: {
    community_corporate: 50,
    traditional_modern: 50,
    religious_secular: 50,
    mass_premium: 50,
    local_global: 50,
  },
  targetSegments: [],
}

// ── Tag input helper ─────────────────────────────────────────────────────────
function TagInput({
  label, placeholder, values, onChange,
}: {
  label: string; placeholder: string; values: string[]; onChange: (v: string[]) => void
}) {
  const [input, setInput] = useState('')

  function add() {
    const trimmed = input.trim()
    if (trimmed && !values.includes(trimmed)) onChange([...values, trimmed])
    setInput('')
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        />
        <Button type="button" variant="outline" size="icon" onClick={add}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map(v => (
            <Badge key={v} variant="secondary" className="gap-1 pr-1">
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter(x => x !== v))}
                className="hover:text-destructive ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Cultural slider ──────────────────────────────────────────────────────────
function CulturalSlider({
  left, right, hint, value, onChange,
}: {
  left: string; right: string; hint: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm font-medium">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<OnboardingData>(defaultData)
  const [state, action] = useActionState(completeOnboarding, null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function patch<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) {
    setData(d => ({ ...d, [key]: value }))
  }

  function patchVoice<K extends keyof OnboardingData['brandVoice']>(
    key: K, value: OnboardingData['brandVoice'][K]
  ) {
    setData(d => ({ ...d, brandVoice: { ...d.brandVoice, [key]: value } }))
  }

  function patchCulture(key: CulturalKey, value: number) {
    setData(d => ({ ...d, culturalProfile: { ...d.culturalProfile, [key]: value } }))
  }

  function canAdvance() {
    if (step === 0) return data.brandName.trim().length > 0 && data.category.length > 0
    return true
  }

  function submit() {
    startTransition(() => {
      const fd = new FormData()
      fd.set('payload', JSON.stringify(data))
      action(fd)
    })
  }

  // Show toast on error from server action
  if (state?.error) toast.error(state.error)

  return (
    <div className="min-h-screen bg-muted/40 flex flex-col items-center justify-start py-12 px-4">
      {/* Header */}
      <div className="w-full max-w-xl mb-8 text-center space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Set up your brand</h1>
        <p className="text-sm text-muted-foreground">
          Step {step + 1} of {STEPS.length} — {STEPS[step]}
        </p>
        <Progress value={((step + 1) / STEPS.length) * 100} className="mt-3 h-1.5" />
      </div>

      {/* Step breadcrumbs */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
              i < step ? 'bg-primary text-primary-foreground' :
              i === step ? 'bg-primary text-primary-foreground' :
              'bg-muted text-muted-foreground'
            }`}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-6 ${i < step ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="w-full max-w-xl bg-card border rounded-xl p-6 shadow-sm space-y-6">

        {/* ── Step 0: Brand Identity ── */}
        {step === 0 && (
          <>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Brand identity</h2>
              <p className="text-sm text-muted-foreground">What is your brand called and what does it do?</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brandName">Brand name <span className="text-destructive">*</span></Label>
                <Input
                  id="brandName"
                  value={data.brandName}
                  onChange={e => patch('brandName', e.target.value)}
                  placeholder="e.g. Kuda, Dangote, Flutterwave"
                />
              </div>
              <div className="space-y-2">
                <Label>Category <span className="text-destructive">*</span></Label>
                <Select value={data.category} onValueChange={v => patch('category', v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <TagInput
                label="Brand values (optional)"
                placeholder="e.g. transparency, innovation"
                values={data.brandValues}
                onChange={v => patch('brandValues', v)}
              />
            </div>
          </>
        )}

        {/* ── Step 1: Brand Voice ── */}
        {step === 1 && (
          <>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Brand voice</h2>
              <p className="text-sm text-muted-foreground">How does your brand speak? This trains the AI to write like you.</p>
            </div>
            <div className="space-y-4">
              <TagInput
                label="Voice adjectives"
                placeholder="e.g. bold, warm, trustworthy"
                values={data.brandVoice.adjectives}
                onChange={v => patchVoice('adjectives', v)}
              />
              <div className="space-y-2">
                <Label htmlFor="tone">Tone description</Label>
                <Textarea
                  id="tone"
                  value={data.brandVoice.tone}
                  onChange={e => patchVoice('tone', e.target.value)}
                  placeholder="e.g. Friendly and direct. We speak like a smart older sibling, not a bank."
                  rows={3}
                />
              </div>
              <TagInput
                label="Dos — things the brand always does"
                placeholder="e.g. use simple language"
                values={data.brandVoice.dos}
                onChange={v => patchVoice('dos', v)}
              />
              <TagInput
                label="Don'ts — things to avoid"
                placeholder="e.g. avoid jargon, never say 'leverage'"
                values={data.brandVoice.donts}
                onChange={v => patchVoice('donts', v)}
              />
              <TagInput
                label="Signature phrases"
                placeholder="e.g. 'Your money, your freedom'"
                values={data.brandVoice.signaturePhrases}
                onChange={v => patchVoice('signaturePhrases', v)}
              />
            </div>
          </>
        )}

        {/* ── Step 2: Cultural Profile ── */}
        {step === 2 && (
          <>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Cultural profile</h2>
              <p className="text-sm text-muted-foreground">
                Set where your brand sits on each cultural axis. This shapes how the AI reads
                sentiment and assesses cultural fit.
              </p>
            </div>
            <div className="space-y-6">
              {CULTURAL_SLIDERS.map(s => (
                <CulturalSlider
                  key={s.key}
                  left={s.left}
                  right={s.right}
                  hint={s.hint}
                  value={data.culturalProfile[s.key]}
                  onChange={v => patchCulture(s.key, v)}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Step 3: Target Segments ── */}
        {step === 3 && (
          <>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Target audience</h2>
              <p className="text-sm text-muted-foreground">Who are you trying to reach? Add your key segments.</p>
            </div>
            <div className="space-y-4">
              {data.targetSegments.map((seg, i) => (
                <div key={i} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium">{seg.name || `Segment ${i + 1}`}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => patch('targetSegments', data.targetSegments.filter((_, j) => j !== i))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Segment name (e.g. Young urban professionals)"
                    value={seg.name}
                    onChange={e => {
                      const updated = [...data.targetSegments]
                      updated[i] = { ...updated[i], name: e.target.value }
                      patch('targetSegments', updated)
                    }}
                  />
                  <Input
                    placeholder="Demographics (e.g. 22-35, Lagos, smartphone users)"
                    value={seg.demographics ?? ''}
                    onChange={e => {
                      const updated = [...data.targetSegments]
                      updated[i] = { ...updated[i], demographics: e.target.value }
                      patch('targetSegments', updated)
                    }}
                  />
                  <Input
                    placeholder="Geography (e.g. Lagos, Abuja, Port Harcourt)"
                    value={seg.geography ?? ''}
                    onChange={e => {
                      const updated = [...data.targetSegments]
                      updated[i] = { ...updated[i], geography: e.target.value }
                      patch('targetSegments', updated)
                    }}
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => patch('targetSegments', [...data.targetSegments, { name: '', demographics: '', geography: '' }])}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add segment
              </Button>
              {data.targetSegments.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  You can add segments now or fill them in from the dashboard later.
                </p>
              )}
            </div>
          </>
        )}

        {/* ── Step 4: Review ── */}
        {step === 4 && (
          <>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Review and finish</h2>
              <p className="text-sm text-muted-foreground">Everything looks right? You can change any of this in settings.</p>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Brand</span>
                <span className="font-medium">{data.brandName}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Category</span>
                <span>{data.category}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Voice adjectives</span>
                <span>{data.brandVoice.adjectives.join(', ') || '—'}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Brand values</span>
                <span>{data.brandValues.join(', ') || '—'}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Target segments</span>
                <span>{data.targetSegments.length > 0 ? data.targetSegments.map(s => s.name).join(', ') : '—'}</span>
              </div>
              <div className="py-2">
                <p className="text-muted-foreground mb-2">Cultural positioning</p>
                <div className="space-y-1">
                  {CULTURAL_SLIDERS.map(s => (
                    <div key={s.key} className="flex justify-between text-xs">
                      <span>{s.left} ↔ {s.right}</span>
                      <span className="text-primary font-medium">{data.culturalProfile[s.key]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={() => setStep(s => s + 1)}
              disabled={!canAdvance()}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={isPending}>
              {isPending ? 'Saving…' : 'Go to dashboard'}
              {!isPending && <Check className="h-4 w-4 ml-1" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
