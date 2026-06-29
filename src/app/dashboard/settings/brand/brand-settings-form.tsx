'use client'

import { useState, useTransition, useRef } from 'react'
import { toast } from 'sonner'
import { updateBrand, type BrandSettingsData } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TagInput, CulturalSlider, SectionCard, CATEGORIES, CULTURAL_SLIDERS } from '@/components/onboarding/brand-profile-fields'
import { FieldTip } from '@/components/ui/field-tip'
import { Upload, X, Loader2, ImageIcon, Sparkles, ArrowRight } from 'lucide-react'
import Link from 'next/link'

type CulturalKey = 'community_corporate' | 'traditional_modern' | 'religious_secular' | 'mass_premium' | 'local_global'

const BRAND_TYPES: { value: BrandSettingsData['brandType']; label: string; description: string }[] = [
  { value: 'fmcg',              label: 'FMCG / Consumer Goods', description: 'Physical products sold through retail or direct' },
  { value: 'fintech',           label: 'Fintech / Digital Finance', description: 'Payment platforms, digital banks, savings/investment apps' },
  { value: 'venue',             label: 'Venue / Hospitality', description: 'Restaurants, clubs, hotels, experience venues' },
  { value: 'b2b_saas',          label: 'B2B SaaS', description: 'Software tools, API platforms, developer products' },
  { value: 'marketplace',       label: 'Creator Marketplace', description: 'Platforms for creators to sell or build on' },
  { value: 'beverage_alcohol',  label: 'Alcohol / Beverage', description: 'Regulated consumer beverages' },
  { value: 'b2b_distribution',  label: 'B2B Distribution', description: 'Trade and supply chain platforms' },
]

interface BrandSettingsFormProps {
  initial:     BrandSettingsData
  logoUrl:     string | null
  brandColors: string[]
}

export function BrandSettingsForm({ initial, logoUrl: initialLogoUrl, brandColors: initialColors }: BrandSettingsFormProps) {
  const [data, setData] = useState<BrandSettingsData>(initial)
  const [isPending, startTransition] = useTransition()

  // Visual identity state
  const [logoUrl, setLogoUrl]         = useState<string | null>(initialLogoUrl)
  const [logoLoading, setLogoLoading] = useState(false)
  const [colors, setColors]           = useState<string[]>(initialColors)
  const [colorInput, setColorInput]   = useState('')
  const logoInputRef = useRef<HTMLInputElement>(null)

  function patch<K extends keyof BrandSettingsData>(key: K, value: BrandSettingsData[K]) {
    setData(d => ({ ...d, [key]: value }))
  }
  function patchCulture(key: CulturalKey, value: number) {
    setData(d => ({ ...d, culturalProfile: { ...d.culturalProfile, [key]: value } }))
  }
  function patchSegment(i: number, field: string, value: string) {
    const updated = [...data.targetSegments]
    updated[i] = { ...updated[i], [field]: value }
    patch('targetSegments', updated)
  }

  function handleSave() {
    const form = new FormData()
    form.set('payload', JSON.stringify(data))
    // Save brand colors via parallel fetch (not part of the server action payload)
    void fetch('/api/brand/colors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colors }),
    })
    startTransition(() => updateBrand(null, form).then(result => {
      if (result?.success) toast.success('Brand profile saved.')
      if (result?.error)   toast.error(result.error)
    }))
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoLoading(true)
    try {
      const form = new FormData()
      form.set('file', file)
      const res  = await fetch('/api/brand/logo', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Upload failed'); return }
      setLogoUrl(data.url)
      toast.success('Logo updated')
    } catch {
      toast.error('Upload failed')
    } finally {
      setLogoLoading(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  async function handleLogoRemove() {
    setLogoLoading(true)
    try {
      const res = await fetch('/api/brand/logo', { method: 'DELETE' })
      if (!res.ok) { toast.error('Failed to remove logo'); return }
      setLogoUrl(null)
      toast.success('Logo removed')
    } finally {
      setLogoLoading(false)
    }
  }

  function addColor() {
    const hex = colorInput.trim()
    if (!hex) return
    const normalized = hex.startsWith('#') ? hex : `#${hex}`
    if (!/^#[0-9A-Fa-f]{3,6}$/.test(normalized)) { toast.error('Enter a valid hex color (e.g. #FF6B35)'); return }
    if (colors.includes(normalized)) return
    setColors(prev => [...prev, normalized])
    setColorInput('')
  }

  return (
    <div className="space-y-6">

      {/* Visual Identity */}
      <SectionCard title="Visual Identity">
        <div className="space-y-5">
          {/* Logo */}
          <div className="space-y-2">
            <Label>Brand logo</Label>
            <p className="text-xs text-muted-foreground">
              Used by the E6 visual brand detector to identify your brand in event photos. PNG or SVG with transparent background works best.
            </p>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <div className="relative h-20 w-20 rounded-xl border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="Brand logo" className="max-h-full max-w-full object-contain p-2" />
                  <button
                    type="button"
                    onClick={handleLogoRemove}
                    disabled={logoLoading}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-background/80 hover:bg-background border flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="h-20 w-20 rounded-xl border border-dashed bg-muted/30 flex flex-col items-center justify-center gap-1 shrink-0">
                  <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                  <p className="text-[10px] text-muted-foreground/50">No logo</p>
                </div>
              )}
              <div className="space-y-2">
                <input
                  ref={logoInputRef}
                  id="logo-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  className="sr-only"
                  onChange={handleLogoUpload}
                />
                <label
                  htmlFor="logo-upload"
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-medium cursor-pointer transition-colors
                    ${logoLoading ? 'pointer-events-none opacity-50' : 'hover:bg-accent'}`}
                >
                  {logoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {logoUrl ? 'Replace logo' : 'Upload logo'}
                </label>
                <p className="text-[11px] text-muted-foreground">JPEG, PNG, WebP, SVG · max 5 MB</p>
              </div>
            </div>
          </div>

          {/* Brand colors */}
          <div className="space-y-2">
            <Label>Brand colors</Label>
            <p className="text-xs text-muted-foreground">
              Primary brand colors as hex codes. Helps E6 spot branded merchandise and signage even when the logo isn&apos;t visible.
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              {colors.map(color => (
                <div key={color} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="font-mono">{color}</span>
                  <button
                    type="button"
                    onClick={() => setColors(prev => prev.filter(c => c !== color))}
                    className="text-muted-foreground hover:text-foreground ml-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 max-w-xs">
              <Input
                value={colorInput}
                onChange={e => setColorInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addColor())}
                placeholder="#FF6B35"
                className="font-mono text-xs h-8"
              />
              <Button type="button" size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={addColor}>
                Add
              </Button>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Identity">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brandName">Brand name</Label>
            <Input id="brandName" value={data.brandName} onChange={e => patch('brandName', e.target.value)} className="max-w-sm" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="websiteUrl">Website URL</Label>
            <Input id="websiteUrl" value={data.websiteUrl ?? ''} onChange={e => patch('websiteUrl', e.target.value)} placeholder="https://yourbrand.com" className="max-w-sm" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="googlePlaceId">Google Place ID</Label>
            <p className="text-xs text-muted-foreground">
              Find this in your Google Maps listing URL (starts with ChIJ...). Required for venue reputation tracking.
            </p>
            <Input
              id="googlePlaceId"
              value={data.googlePlaceId ?? ''}
              onChange={e => patch('googlePlaceId', e.target.value)}
              placeholder="ChIJ..."
              className="max-w-sm font-mono text-xs"
            />
          </div>
          {(data.brandType === 'b2b_saas' || data.brandType === 'marketplace') && (
            <div className="space-y-4 pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Review Platforms</p>
              <div className="space-y-2">
                <Label htmlFor="g2Slug">G2 Product Slug</Label>
                <p className="text-xs text-muted-foreground">
                  From g2.com/products/[slug]/reviews
                </p>
                <Input
                  id="g2Slug"
                  value={data.g2Slug ?? ''}
                  onChange={e => patch('g2Slug', e.target.value)}
                  placeholder="your-product-name"
                  className="max-w-sm font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capterraSlug">Capterra Slug</Label>
                <p className="text-xs text-muted-foreground">
                  From capterra.com/p/[slug]/
                </p>
                <Input
                  id="capterraSlug"
                  value={data.capterraSlug ?? ''}
                  onChange={e => patch('capterraSlug', e.target.value)}
                  placeholder="your-product-slug"
                  className="max-w-sm font-mono text-xs"
                />
              </div>
            </div>
          )}

          {(['fintech', 'b2b_saas', 'marketplace'] as const).includes(data.brandType as 'fintech') && (
            <div className="space-y-4 pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Developer Ecosystem</p>
              <div className="space-y-2">
                <Label htmlFor="githubRepo">GitHub Repository</Label>
                <p className="text-xs text-muted-foreground">owner/repo format, e.g. paystack/paystack-php</p>
                <Input id="githubRepo" value={data.githubRepo ?? ''} onChange={e => patch('githubRepo', e.target.value)} placeholder="org/repo" className="max-w-sm font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npmPackageName">npm Package</Label>
                <Input id="npmPackageName" value={data.npmPackageName ?? ''} onChange={e => patch('npmPackageName', e.target.value)} placeholder="@scope/package or package-name" className="max-w-sm font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stackoverflowTag">Stack Overflow Tag</Label>
                <Input id="stackoverflowTag" value={data.stackoverflowTag ?? ''} onChange={e => patch('stackoverflowTag', e.target.value)} placeholder="paystack" className="max-w-sm font-mono text-xs" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={data.category} onValueChange={v => patch('category', v ?? '')}>
              <SelectTrigger className="max-w-sm"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Industry type</Label>
            <p className="text-xs text-muted-foreground">
              Sets which signals drive your brand funnel and health scores. Pick the one that fits your business best.
            </p>
            <div className="grid sm:grid-cols-2 gap-2 max-w-2xl">
              {BRAND_TYPES.map(t => {
                const selected = data.brandType === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => patch('brandType', t.value)}
                    className={`text-left rounded-lg border p-3 transition-colors ${
                      selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent'
                    }`}
                  >
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="marketSharePct">Estimated market share (%)</Label>
            <p className="text-xs text-muted-foreground">
              Used in ESOV calculations on Brand Equity and Competitive pages. Enter your best estimate.
            </p>
            <Input
              id="marketSharePct"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={data.marketSharePct ?? ''}
              onChange={e => patch('marketSharePct', e.target.value === '' ? null : Number(e.target.value))}
              placeholder="e.g. 12.5"
              className="max-w-[160px]"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Brand Values">
        <TagInput
          label="Values"
          placeholder="e.g. Trust, Innovation"
          values={data.brandValues}
          onChange={v => patch('brandValues', v)}
          hint="Core principles that guide your brand decisions."
        />
      </SectionCard>

      <SectionCard title="Brand Voice">
        {data.brandVoice.adjectives.length > 0 || data.brandVoice.tone ? (
          <div className="space-y-4">
            {data.brandVoice.tone && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Tone</p>
                <p className="text-sm">{data.brandVoice.tone}</p>
              </div>
            )}
            {data.brandVoice.adjectives.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Voice adjectives</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.brandVoice.adjectives.map(a => (
                    <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-muted border border-border font-medium">{a}</span>
                  ))}
                </div>
              </div>
            )}
            {data.brandVoice.signaturePhrases.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Signature phrases</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.brandVoice.signaturePhrases.map(p => (
                    <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium italic">{p}</span>
                  ))}
                </div>
              </div>
            )}
            <Link
              href="/dashboard/voice-builder"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Edit in Voice Builder
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3 py-2">
            <p className="text-sm text-muted-foreground">
              No brand voice set yet. Use the AI-powered Voice Builder to generate tone guidelines, dos and don&apos;ts, and your Kapferer Prism profile.
            </p>
            <Link
              href="/dashboard/voice-builder"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Open Voice Builder
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Cultural Positioning">
        <div className="space-y-5">
          {CULTURAL_SLIDERS.map(s => (
            <CulturalSlider
              key={s.key}
              left={s.left} right={s.right} hint={s.hint}
              value={data.culturalProfile[s.key]}
              onChange={v => patchCulture(s.key, v)}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Target Audience">
        <div className="space-y-3">
          {data.targetSegments.map((seg, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <Input placeholder="Segment name" value={seg.name} onChange={e => patchSegment(i, 'name', e.target.value)} className="text-sm" />
              <Input placeholder="Demographics" value={seg.demographics ?? ''} onChange={e => patchSegment(i, 'demographics', e.target.value)} className="text-sm" />
              <Input placeholder="Geography" value={seg.geography ?? ''} onChange={e => patchSegment(i, 'geography', e.target.value)} className="text-sm" />
            </div>
          ))}
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => patch('targetSegments', [...data.targetSegments, { name: '', demographics: '', geography: '' }])}
          >
            Add segment
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Monitored Hashtags">
        <TagInput
          label="Extra hashtags to track"
          placeholder="e.g. jarafoods"
          values={data.monitoredHashtags}
          onChange={v => patch('monitoredHashtags', v)}
          hint="In addition to your brand name, the crawl will search for these hashtags on X and Instagram. Enter without the # symbol."
        />
      </SectionCard>

      <SectionCard title="Alternative Search Terms">
        <TagInput
          label="Aliases and misspellings (max 10)"
          placeholder="e.g. Jara Foods"
          values={data.brandAliases}
          onChange={v => patch('brandAliases', v.slice(0, 10))}
          hint="Common alternate spellings, short names, or product lines that refer to your brand. These are added to crawl search queries alongside your primary brand name."
        />
      </SectionCard>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save brand profile'}
        </Button>
      </div>
    </div>
  )
}
