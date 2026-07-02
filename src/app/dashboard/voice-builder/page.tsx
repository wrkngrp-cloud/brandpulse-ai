'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Loader2, Sparkles, Plus, Trash2, CheckCircle2, Wand2,
  PenLine, Copy, RefreshCw, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { TourTrigger } from '@/components/tours/tour-trigger'

// ── Types ─────────────────────────────────────────────────────────────────────

interface KapfererPrism {
  physique: string; personality: string; culture: string
  relationship: string; reflection: string; self_image: string
}
interface VoiceResult {
  adjectives: string[]; tone: string; dos: string[]; donts: string[]
  signaturePhrases: string[]; confidenceNote: string
  kapferer_prism?: KapfererPrism; saved: boolean
}
interface RetuneResult {
  retuned: string; changes: string[]; voice_match_score: number
}
interface GenerateCaption {
  caption: string; angle: string; why: string
}

const PLATFORMS = [
  'Instagram', 'Facebook', 'TikTok', 'Twitter / X', 'LinkedIn',
  'WhatsApp Status', 'Email', 'Print / OOH', 'Radio Script',
]

// ── Tab bar ───────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'build',    label: 'Build Voice',      icon: Sparkles  },
  { id: 'retune',   label: 'Retune Caption',   icon: Wand2     },
  { id: 'generate', label: 'Generate Captions',icon: PenLine   },
] as const
type Tab = typeof TABS[number]['id']

// ── Main component ────────────────────────────────────────────────────────────

export default function VoiceBuilderPage() {
  const [tab, setTab]             = useState<Tab>('build')
  const [brandName, setBrandName] = useState('')
  const [hasVoice, setHasVoice]   = useState(false)

  // Build Voice state
  const [samples, setSamples]   = useState<string[]>([''])
  const [building, setBuilding] = useState(false)
  const [voiceResult, setVoiceResult] = useState<VoiceResult | null>(null)
  const [showPrism, setShowPrism]     = useState(false)

  // Retune state
  const [retunePlatform, setRetunePlatform] = useState('')
  const [retuneInput, setRetuneInput]       = useState('')
  const [retuning, setRetuning]             = useState(false)
  const [retuneResult, setRetuneResult]     = useState<RetuneResult | null>(null)

  // Generate state
  const [genPlatform, setGenPlatform] = useState('')
  const [genInput, setGenInput]       = useState('')
  const [genCount, setGenCount]       = useState(3)
  const [generating, setGenerating]   = useState(false)
  const [genResults, setGenResults]   = useState<GenerateCaption[]>([])

  useEffect(() => {
    fetch('/api/brands')
      .then(r => r.json())
      .then(d => {
        const b = d.brands?.[0]
        if (b?.name) setBrandName(b.name)
        const bv = b?.brand_voice
        if (bv?.tone) {
          setHasVoice(true)
          setVoiceResult({
            adjectives:      bv.adjectives      ?? [],
            tone:            bv.tone            ?? '',
            dos:             bv.dos             ?? [],
            donts:           bv.donts           ?? [],
            signaturePhrases:bv.signaturePhrases ?? [],
            kapferer_prism:  bv.kapferer_prism  ?? undefined,
            confidenceNote:  bv.confidenceNote  ?? 'Voice profile loaded from your saved brand settings.',
            saved:           true,
          })
        }
      })
      .catch(() => {})
  }, [])

  // ── Build Voice ─────────────────────────────────────────────────────────────

  function addSample()           { setSamples(s => [...s, '']) }
  function removeSample(i: number) { setSamples(s => s.filter((_, j) => j !== i)) }
  function updateSample(i: number, v: string) { setSamples(s => s.map((x, j) => j === i ? v : x)) }

  async function build() {
    const filled = samples.filter(s => s.trim().length >= 20)
    if (!filled.length) { toast.error('Add at least one content sample (min 20 characters)'); return }
    setBuilding(true)
    try {
      const res  = await fetch('/api/ai/brand-voice-builder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ samples: filled, brandName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setVoiceResult(data)
      setHasVoice(true)
      if (data.saved) toast.success('Brand voice saved — Retune and Generate tabs are now active')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBuilding(false)
    }
  }

  // ── Retune Caption ──────────────────────────────────────────────────────────

  async function retune() {
    if (!retuneInput.trim()) { toast.error('Paste a caption to retune'); return }
    setRetuning(true)
    setRetuneResult(null)
    try {
      const res  = await fetch('/api/ai/brand-voice/caption', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'retune', input: retuneInput, platform: retunePlatform || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setRetuneResult(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setRetuning(false)
    }
  }

  // ── Generate Captions ───────────────────────────────────────────────────────

  async function generate() {
    if (!genInput.trim()) { toast.error('Describe the idea or campaign concept'); return }
    setGenerating(true)
    setGenResults([])
    try {
      const res  = await fetch('/api/ai/brand-voice/caption', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'generate', input: genInput, platform: genPlatform || undefined, count: genCount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setGenResults(data.captions ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setGenerating(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">Creative Intelligence</p>
          <h1 className="h-display text-[26px] leading-none">Voice Builder</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground/70 max-w-xl">
            Extract your brand voice from existing content, then use it to retune captions or generate on-brand copy from any idea.
          </p>
        </div>
        <TourTrigger module="voice_builder" autoStart />
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border/60" data-tour="voice-main">
        {TABS.map(t => {
          const locked = (t.id === 'retune' || t.id === 'generate') && !hasVoice
          return (
            <button
              key={t.id}
              onClick={() => !locked && setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors',
                tab === t.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/60',
                locked && 'opacity-40 cursor-not-allowed',
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {locked && <span className="text-[10px] ml-1 text-muted-foreground/60">Build voice first</span>}
            </button>
          )
        })}
      </div>

      {/* ── BUILD VOICE TAB ── */}
      {tab === 'build' && (
        <div className="space-y-5">
          <p className="text-[13px] text-muted-foreground/80">
            Paste 3–10 samples of your brand&apos;s existing content — social posts, ads, press releases, email copy. The AI applies Kapferer&apos;s Brand Identity Prism to extract and save your voice pattern.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Content samples</p>
              <p className="text-[12px] text-muted-foreground">
                {samples.filter(s => s.trim().length >= 20).length} / {samples.length} ready
              </p>
            </div>
            {samples.map((s, i) => (
              <div key={i} className="relative group">
                <Textarea
                  value={s}
                  onChange={e => updateSample(i, e.target.value)}
                  placeholder={`Sample ${i + 1} — social post, ad copy, email paragraph, press release...`}
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
              <Button onClick={build} disabled={building} size="sm">
                {building
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Analysing...</>
                  : <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Build voice profile</>}
              </Button>
            </div>
          </div>

          {voiceResult && (
            <div className="rounded-2xl border bg-card divide-y divide-border/50">
              <div className="p-5 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[14px] font-semibold">Voice profile extracted</p>
                  <p className="text-[12.5px] text-muted-foreground mt-0.5">{voiceResult.confidenceNote}</p>
                </div>
              </div>
              <div className="p-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Voice adjectives</p>
                <div className="flex flex-wrap gap-2">
                  {voiceResult.adjectives.map(a => (
                    <Badge key={a} variant="secondary" className="text-[12px] px-2.5 py-1">{a}</Badge>
                  ))}
                </div>
              </div>
              <div className="p-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Tone</p>
                <p className="text-[13.5px] leading-relaxed">{voiceResult.tone}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/50">
                <div className="p-5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400 mb-3">Dos</p>
                  <ul className="space-y-1.5">
                    {voiceResult.dos.map((d, i) => (
                      <li key={i} className="text-[13px] flex gap-2"><span className="text-green-500 shrink-0">✓</span>{d}</li>
                    ))}
                  </ul>
                </div>
                <div className="p-5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-red-500 mb-3">Don&apos;ts</p>
                  <ul className="space-y-1.5">
                    {voiceResult.donts.map((d, i) => (
                      <li key={i} className="text-[13px] flex gap-2"><span className="text-red-400 shrink-0">✗</span>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {voiceResult.signaturePhrases?.length > 0 && (
                <div className="p-5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Signature phrases</p>
                  <div className="flex flex-wrap gap-2">
                    {voiceResult.signaturePhrases.map((p, i) => (
                      <span key={i} className="px-3 py-1.5 rounded-full bg-muted text-[12.5px] italic">&ldquo;{p}&rdquo;</span>
                    ))}
                  </div>
                </div>
              )}
              {voiceResult.kapferer_prism && (
                <div className="p-5">
                  <button
                    onClick={() => setShowPrism(p => !p)}
                    className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Kapferer Brand Identity Prism
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showPrism && 'rotate-180')} />
                  </button>
                  {showPrism && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {([
                        { key: 'physique',    label: 'Physique',    desc: 'Physical & visual cues' },
                        { key: 'personality', label: 'Personality', desc: 'Character traits projected' },
                        { key: 'culture',     label: 'Culture',     desc: 'Values & belief system' },
                        { key: 'relationship',label: 'Relationship',desc: 'How the brand engages' },
                        { key: 'reflection',  label: 'Reflection',  desc: 'Who the brand portrays' },
                        { key: 'self_image',  label: 'Self-Image',  desc: 'How users feel' },
                      ] as const).map(({ key, label, desc }) => (
                        <div key={key} className="rounded-xl border bg-muted/20 p-3.5 space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">{label}</p>
                          <p className="text-[10px] text-muted-foreground">{desc}</p>
                          <p className="text-[12.5px] leading-snug">{voiceResult.kapferer_prism![key]}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="p-4 bg-muted/30">
                <p className="text-[12px] text-muted-foreground">
                  {voiceResult.saved
                    ? '✓ Saved to your brand profile — Retune and Generate tabs now use this voice.'
                    : 'Select a brand to save the voice profile.'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── RETUNE CAPTION TAB ── */}
      {tab === 'retune' && (
        <div className="space-y-5">
          <p className="text-[13px] text-muted-foreground/80">
            Paste any caption — from an agency draft, a team member, or an AI tool. The AI rewrites it to sound exactly like {brandName || 'your brand'}, preserving the message and CTA.
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Platform (optional)</label>
                <Select value={retunePlatform} onValueChange={v => setRetunePlatform(v ?? '')}>
                  <SelectTrigger className="text-[13px]">
                    <SelectValue placeholder="Select platform…" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Original caption</label>
              <Textarea
                value={retuneInput}
                onChange={e => setRetuneInput(e.target.value)}
                placeholder="Paste the caption you want to retune…"
                className="min-h-[120px] text-[13px]"
              />
            </div>
            <Button onClick={retune} disabled={retuning}>
              {retuning
                ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Retuning...</>
                : <><Wand2 className="h-3.5 w-3.5 mr-1.5" />Retune caption</>}
            </Button>
          </div>

          {retuneResult && (
            <div className="rounded-2xl border bg-card divide-y divide-border/50">
              <div className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold">Retuned caption</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Voice match</span>
                    <span className={cn(
                      'text-[12px] font-bold tabular-nums',
                      retuneResult.voice_match_score >= 80 ? 'text-green-500' : 'text-amber-500',
                    )}>
                      {retuneResult.voice_match_score}%
                    </span>
                  </div>
                </div>
                <div className="rounded-xl bg-muted/40 border p-4 text-[13.5px] leading-relaxed">
                  {retuneResult.retuned}
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(retuneResult.retuned); toast.success('Copied') }}
                  className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Copy className="h-3 w-3" />Copy
                </button>
              </div>
              <div className="p-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">What changed</p>
                <ul className="space-y-1.5">
                  {retuneResult.changes.map((c, i) => (
                    <li key={i} className="text-[12.5px] flex gap-2 text-muted-foreground">
                      <span className="text-primary shrink-0">→</span>{c}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-4">
                <Button variant="outline" size="sm" onClick={retune} disabled={retuning}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Try again
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── GENERATE CAPTIONS TAB ── */}
      {tab === 'generate' && (
        <div className="space-y-5">
          <p className="text-[13px] text-muted-foreground/80">
            Describe a campaign idea, product moment, or message you want to land. The AI generates multiple caption variations — each in {brandName || 'your brand'}&apos;s voice, with different angles and hooks.
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Platform (optional)</label>
                <Select value={genPlatform} onValueChange={v => setGenPlatform(v ?? '')}>
                  <SelectTrigger className="text-[13px]">
                    <SelectValue placeholder="Select platform…" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Number of variations</label>
                <Select value={String(genCount)} onValueChange={v => setGenCount(Number(v))}>
                  <SelectTrigger className="text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n} variations</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Your idea or concept</label>
              <Textarea
                value={genInput}
                onChange={e => setGenInput(e.target.value)}
                placeholder="e.g. We're launching a 5kg Jara Rice promo for the Eid season. Target: market women, Lagos. Key message: premium quality at a price that makes sense for the family."
                className="min-h-[110px] text-[13px]"
              />
            </div>
            <Button onClick={generate} disabled={generating}>
              {generating
                ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Generating...</>
                : <><PenLine className="h-3.5 w-3.5 mr-1.5" />Generate captions</>}
            </Button>
          </div>

          {genResults.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold">{genResults.length} caption variations</p>
                <Button variant="outline" size="sm" onClick={generate} disabled={generating}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Regenerate
                </Button>
              </div>
              {genResults.map((c, i) => (
                <div key={i} className="rounded-2xl border bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="secondary" className="text-[11px]">{c.angle}</Badge>
                    <button
                      onClick={() => { navigator.clipboard.writeText(c.caption); toast.success('Copied') }}
                      className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Copy className="h-3 w-3" />Copy
                    </button>
                  </div>
                  <p className="text-[13.5px] leading-relaxed">{c.caption}</p>
                  <p className="text-[12px] text-muted-foreground border-t border-border/40 pt-3">{c.why}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
