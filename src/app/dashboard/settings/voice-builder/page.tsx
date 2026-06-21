'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Sparkles, Plus, Trash2, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface VoiceResult {
  adjectives:      string[]
  tone:            string
  dos:             string[]
  donts:           string[]
  signaturePhrases: string[]
  confidenceNote:  string
  saved:           boolean
}

export default function VoiceBuilderPage() {
  const [samples, setSamples] = useState<string[]>([''])
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<VoiceResult | null>(null)

  function addSample()    { setSamples(s => [...s, '']) }
  function removeSample(i: number) { setSamples(s => s.filter((_, j) => j !== i)) }
  function updateSample(i: number, v: string) { setSamples(s => s.map((x, j) => j === i ? v : x)) }

  async function build() {
    const filled = samples.filter(s => s.trim().length >= 20)
    if (!filled.length) { toast.error('Add at least one content sample (min 20 characters)'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/ai/brand-voice-builder', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ samples: filled, brandName: '' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setResult(data)
      if (data.saved) toast.success('Brand voice saved to your profile')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="eyebrow mb-1">Settings</p>
        <h1 className="h-display text-[26px] leading-none">Brand Voice Builder</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground/70 max-w-xl">
          Paste 3-10 samples of your brand's existing content — social posts, ads, press releases, email copy. Claude extracts your voice pattern and saves it to your brand profile, powering the Pre-Post Widget and AI content scoring.
        </p>
      </div>

      {/* Sample inputs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Content samples</p>
          <p className="text-[12px] text-muted-foreground">{samples.filter(s => s.trim().length >= 20).length} / {samples.length} ready</p>
        </div>
        {samples.map((s, i) => (
          <div key={i} className="relative group">
            <Textarea
              value={s}
              onChange={e => updateSample(i, e.target.value)}
              placeholder={`Sample ${i + 1} — paste a social post, ad copy, email subject, press release paragraph...`}
              className="min-h-[80px] resize-y pr-10 text-[13px]"
            />
            {samples.length > 1 && (
              <button
                type="button"
                onClick={() => removeSample(i)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        ))}

        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={addSample} disabled={samples.length >= 20}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />Add sample
          </Button>
          <Button onClick={build} disabled={loading} size="sm">
            {loading
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Analysing...</>
              : <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Build voice profile</>}
          </Button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="rounded-2xl border bg-card divide-y divide-border/50">

          {/* Header */}
          <div className="p-5 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[14px] font-semibold">Voice profile extracted</p>
              <p className="text-[12.5px] text-muted-foreground mt-0.5">{result.confidenceNote}</p>
            </div>
          </div>

          {/* Adjectives */}
          <div className="p-5">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Voice adjectives</p>
            <div className="flex flex-wrap gap-2">
              {result.adjectives.map(a => (
                <Badge key={a} variant="secondary" className="text-[12px] px-2.5 py-1">{a}</Badge>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div className="p-5">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tone</p>
            <p className="text-[13.5px] leading-relaxed">{result.tone}</p>
          </div>

          {/* Dos / Donts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/50">
            <div className="p-5">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-green-600 dark:text-green-400 mb-3">Dos</p>
              <ul className="space-y-1.5">
                {result.dos.map((d, i) => <li key={i} className="text-[13px] flex gap-2"><span className="text-green-500 shrink-0">✓</span>{d}</li>)}
              </ul>
            </div>
            <div className="p-5">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-red-500 mb-3">Don'ts</p>
              <ul className="space-y-1.5">
                {result.donts.map((d, i) => <li key={i} className="text-[13px] flex gap-2"><span className="text-red-400 shrink-0">✗</span>{d}</li>)}
              </ul>
            </div>
          </div>

          {/* Signature phrases */}
          {result.signaturePhrases?.length > 0 && (
            <div className="p-5">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Signature phrases</p>
              <div className="flex flex-wrap gap-2">
                {result.signaturePhrases.map((p, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-full bg-muted text-[12.5px] italic">"{p}"</span>
                ))}
              </div>
            </div>
          )}

          {/* Save status */}
          <div className="p-4 bg-muted/30">
            <p className="text-[12px] text-muted-foreground">
              {result.saved
                ? '✓ Saved to your brand profile — Pre-Post Widget and AI scoring now use this voice.'
                : 'Run brand voice builder again after selecting a brand to save the profile.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
