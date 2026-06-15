'use client'

import { useActionState, useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { updateBrand, type BrandSettingsData } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TagInput, CulturalSlider, SectionCard, CATEGORIES, CULTURAL_SLIDERS } from '@/components/onboarding/brand-profile-fields'

type CulturalKey = 'community_corporate' | 'traditional_modern' | 'religious_secular' | 'mass_premium' | 'local_global'

export function BrandSettingsForm({ initial }: { initial: BrandSettingsData }) {
  const [data, setData] = useState<BrandSettingsData>(initial)
  const [state, , pending] = useActionState(updateBrand, null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (state?.success) toast.success('Brand profile saved.')
    if (state?.error)   toast.error(state.error)
  }, [state])

  function patch<K extends keyof BrandSettingsData>(key: K, value: BrandSettingsData[K]) {
    setData(d => ({ ...d, [key]: value }))
  }
  function patchVoice<K extends keyof BrandSettingsData['brandVoice']>(key: K, value: BrandSettingsData['brandVoice'][K]) {
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

  function handleSave() {
    const form = new FormData()
    form.set('payload', JSON.stringify(data))
    startTransition(() => updateBrand(null, form).then(result => {
      if (result?.success) toast.success('Brand profile saved.')
      if (result?.error)   toast.error(result.error)
    }))
  }

  return (
    <div className="space-y-6">

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
            <Label>Category</Label>
            <Select value={data.category} onValueChange={v => patch('category', v ?? '')}>
              <SelectTrigger className="max-w-sm"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
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
        <TagInput label="Voice adjectives" placeholder="e.g. Bold, Warm" values={data.brandVoice.adjectives} onChange={v => patchVoice('adjectives', v)} />
        <div className="space-y-2">
          <Label>Tone description</Label>
          <Textarea
            value={data.brandVoice.tone}
            onChange={e => patchVoice('tone', e.target.value)}
            placeholder="Describe your brand's tone in a sentence..."
            rows={2}
            className="resize-none text-sm"
          />
        </div>
        <TagInput label="Dos" placeholder="e.g. use simple language" values={data.brandVoice.dos} onChange={v => patchVoice('dos', v)} />
        <TagInput label="Don'ts" placeholder="e.g. avoid jargon" values={data.brandVoice.donts} onChange={v => patchVoice('donts', v)} />
        <TagInput label="Signature phrases" placeholder="e.g. Built for you" values={data.brandVoice.signaturePhrases} onChange={v => patchVoice('signaturePhrases', v)} />
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

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={pending}>
          {pending ? 'Saving…' : 'Save brand profile'}
        </Button>
      </div>
    </div>
  )
}
