'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Zap, X, ChevronDown, Send, Loader2, AlertTriangle, Copy, Check, ImagePlus, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

interface ImageAttachment {
  base64: string
  mediaType: SupportedMediaType
  previewUrl: string
  fileName: string
  sizeKb: number
}

// ── Types ────────────────────────────────────────────────────────────────────

interface RiskFlag {
  title: string
  offending_text: string
  reason: string
  replacement: string
}

interface ScoreDim {
  score: number
  reasoning: string
}

interface AnalysisResult {
  engagement: ScoreDim
  cultural:   ScoreDim
  tone:       ScoreDim
  clarity:    ScoreDim
  risk:       { score: number; flags: RiskFlag[] }
  verdict: string
  improvements: string[]
  suggested_rewrite: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLATFORMS   = ['Instagram', 'X (Twitter)', 'LinkedIn', 'WhatsApp', 'TikTok', 'Facebook']
const FUNNEL_STAGES = ['Awareness', 'Consideration', 'Conversion', 'Loyalty', 'Re-engagement']

function scoreColor(score: number): string {
  if (score >= 75) return 'text-green-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-500'
}

function scoreBarColor(score: number): string {
  if (score >= 75) return 'bg-green-500'
  if (score >= 50) return 'bg-amber-400'
  return 'bg-red-400'
}

function riskBarColor(score: number): string {
  if (score <= 20) return 'bg-green-500'
  if (score <= 50) return 'bg-amber-400'
  return 'bg-red-400'
}

function ScoreCard({ label, dim, isRisk = false }: {
  label: string
  dim: ScoreDim | { score: number; flags?: RiskFlag[] }
  isRisk?: boolean
}) {
  const [open, setOpen] = useState(false)
  const score = dim.score
  const reasoning = 'reasoning' in dim ? dim.reasoning : null

  return (
    <div className="space-y-1">
      <button
        onClick={() => reasoning && setOpen(o => !o)}
        className={cn(
          'w-full text-left group',
          reasoning ? 'cursor-pointer' : 'cursor-default'
        )}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-foreground">{label}</span>
          <span className={cn('text-xs font-semibold tabular-nums', isRisk ? (score <= 20 ? 'text-green-600' : score <= 50 ? 'text-amber-600' : 'text-red-500') : scoreColor(score))}>
            {score}
            <span className="text-muted-foreground font-normal">/100</span>
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', isRisk ? riskBarColor(score) : scoreBarColor(score))}
            style={{ width: `${score}%` }}
          />
        </div>
      </button>
      {open && reasoning && (
        <p className="text-[11px] text-muted-foreground leading-relaxed pt-1 pl-0.5">{reasoning}</p>
      )}
    </div>
  )
}

// ── Widget ────────────────────────────────────────────────────────────────────

const ALLOWED_TYPES: SupportedMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE_BYTES = 4 * 1024 * 1024 // 4 MB

export function PrePostWidget() {
  const [open, setOpen]           = useState(false)
  const [minimised, setMinimised] = useState(false)
  const [content, setContent]     = useState('')
  const [platform, setPlatform]   = useState('')
  const [funnel, setFunnel]       = useState('')
  const [image, setImage]         = useState<ImageAttachment | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<AnalysisResult | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [copiedRewrite, setCopied] = useState(false)
  const fileInputRef              = useRef<HTMLInputElement>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type as SupportedMediaType)) {
      setImageError('Unsupported file type. Use JPEG, PNG, WEBP, or GIF.')
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      setImageError('Image too large. Max size is 4 MB.')
      return
    }
    setImageError(null)
    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string
      // dataUrl = 'data:image/jpeg;base64,<data>'
      const base64 = dataUrl.split(',')[1]
      setImage({
        base64,
        mediaType: file.type as SupportedMediaType,
        previewUrl: dataUrl,
        fileName: file.name,
        sizeKb: Math.round(file.size / 1024),
      })
    }
    reader.readAsDataURL(file)
    // Reset input so re-selecting the same file triggers onChange
    e.target.value = ''
  }

  // Keyboard shortcut: Cmd/Ctrl+Shift+P
  const handleKey = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'P') {
      e.preventDefault()
      setOpen(o => !o)
      setMinimised(false)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  async function analyse() {
    if ((!content.trim() && !image) || !platform || !funnel || loading) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/ai/pre-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          platform,
          funnelStage: funnel,
          ...(image ? { imageBase64: image.base64, imageMediaType: image.mediaType } : {}),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        setError(err.error ?? `Error ${res.status}`)
        return
      }
      const data = await res.json() as AnalysisResult
      setResult(data)
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setResult(null)
    setError(null)
    setContent('')
    setPlatform('')
    setFunnel('')
    setImage(null)
    setImageError(null)
  }

  function copyRewrite() {
    if (!result?.suggested_rewrite) return
    navigator.clipboard.writeText(result.suggested_rewrite)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Trigger button
  const trigger = (
    <button
      onClick={() => { setOpen(true); setMinimised(false) }}
      className="h-12 w-12 rounded-full bg-foreground text-background shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center"
      title="Pre-Post Analysis (⌘⇧P)"
    >
      <Zap className="h-5 w-5" />
    </button>
  )

  if (!open) return <div className="fixed bottom-20 right-6 z-50">{trigger}</div>

  // Panel
  return (
    <div className="fixed bottom-20 right-6 z-50 flex flex-col items-end gap-3">
      {/* Minimised pill */}
      {minimised ? (
        <button
          onClick={() => setMinimised(false)}
          className="flex items-center gap-2 bg-foreground text-background text-xs font-medium px-4 py-2 rounded-full shadow-lg hover:opacity-90 transition-opacity"
        >
          <Zap className="h-3.5 w-3.5" />
          Pre-Post
        </button>
      ) : (
        <div
          className={cn(
            'w-[92vw] sm:w-[480px] bg-background border rounded-2xl shadow-2xl flex flex-col',
            'max-h-[80vh] overflow-hidden'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-semibold">Pre-Post Analysis</span>
              <kbd className="hidden sm:inline-flex items-center text-[10px] text-muted-foreground border rounded px-1.5 py-0.5">⌘⇧P</kbd>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setMinimised(true)} className="p-1 hover:bg-muted rounded transition-colors" title="Minimise">
                <ChevronDown className="h-4 w-4" />
              </button>
              <button onClick={() => { setOpen(false); reset() }} className="p-1 hover:bg-muted rounded transition-colors" title="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {!result ? (
              /* Input form */
              <div className="p-4 space-y-3">
                {/* Image attachment */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {image ? (
                  <div className="relative rounded-xl overflow-hidden border bg-muted group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.previewUrl} alt="Visual to analyse" className="w-full max-h-48 object-cover" />
                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                      <span className="text-[10px] bg-background/80 backdrop-blur-sm text-foreground px-2 py-0.5 rounded-full border font-mono">
                        {image.mediaType.split('/')[1].toUpperCase()} · {image.sizeKb}KB
                      </span>
                      <button
                        onClick={() => { setImage(null); setImageError(null) }}
                        className="bg-background/80 backdrop-blur-sm rounded-full p-0.5 hover:bg-red-50 transition-colors"
                        title="Remove image"
                      >
                        <XCircle className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                    <div className="absolute bottom-2 left-2">
                      <span className="text-[10px] bg-foreground text-background px-2 py-0.5 rounded-full font-medium">Visual attached</span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 border border-dashed rounded-xl py-3 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  >
                    <ImagePlus className="h-4 w-4" />
                    Add image for visual analysis (optional)
                  </button>
                )}
                {imageError && <p className="text-xs text-red-500">{imageError}</p>}

                <Textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={image ? 'Caption or copy to go with this visual (optional)...' : 'Paste your caption, post copy, press release, or any content you\'re about to publish...'}
                  className="min-h-[100px] text-sm resize-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={platform} onValueChange={v => setPlatform(v ?? '')}>
                    <SelectTrigger className="text-sm h-9">
                      <SelectValue placeholder="Platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={funnel} onValueChange={v => setFunnel(v ?? '')}>
                    <SelectTrigger className="text-sm h-9">
                      <SelectValue placeholder="Funnel goal" />
                    </SelectTrigger>
                    <SelectContent>
                      {FUNNEL_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {error && (
                  <p className="text-xs text-red-500">{error}</p>
                )}
                <Button
                  className="w-full"
                  size="sm"
                  onClick={analyse}
                  disabled={(!content.trim() && !image) || !platform || !funnel || loading}
                >
                  {loading
                    ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Analysing...</>
                    : <><Send className="h-3.5 w-3.5 mr-2" /> {image ? 'Analyse visual + copy' : 'Analyse content'}</>
                  }
                </Button>
                {loading && (
                  <p className="text-center text-[11px] text-muted-foreground animate-pulse">
                    {image ? 'Reading image and cultural context, scoring your content...' : 'Reading cultural context and scoring your content...'}
                  </p>
                )}
              </div>
            ) : (
              /* Results */
              <div className="p-4 space-y-5">
                {/* Verdict */}
                <div className="bg-muted rounded-xl px-4 py-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Verdict</p>
                  <p className="text-sm leading-relaxed">{result.verdict}</p>
                </div>

                {/* Score cards */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Scores — tap any bar to see reasoning</p>
                  <ScoreCard label="Predicted Engagement" dim={result.engagement} />
                  <ScoreCard label="Cultural Resonance"   dim={result.cultural} />
                  <ScoreCard label="Tone Match"           dim={result.tone} />
                  <ScoreCard label="Message Clarity"      dim={result.clarity} />
                  <ScoreCard label="Risk Flag"            dim={result.risk} isRisk />
                </div>

                {/* Risk flags */}
                {result.risk.flags?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      Cultural Risk Flags
                    </p>
                    {result.risk.flags.map((f, i) => (
                      <div key={i} className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1.5 text-sm">
                        <p className="font-semibold text-amber-800 text-xs">{f.title}</p>
                        {f.offending_text && (
                          <p className="text-amber-700 text-xs">
                            <span className="font-medium">Flagged: </span>
                            <span className="italic">"{f.offending_text}"</span>
                          </p>
                        )}
                        <p className="text-amber-700 text-xs">{f.reason}</p>
                        {f.replacement && (
                          <p className="text-amber-700 text-xs">
                            <span className="font-medium">Suggestion: </span>{f.replacement}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Improvements */}
                {result.improvements?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Improvements</p>
                    <ul className="space-y-1.5">
                      {result.improvements.map((imp, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="shrink-0 h-5 w-5 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                          <span className="text-muted-foreground leading-relaxed">{imp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Suggested rewrite */}
                {result.suggested_rewrite && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Suggested Rewrite</p>
                      <button
                        onClick={copyRewrite}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copiedRewrite
                          ? <><Check className="h-3 w-3 text-green-600" /> Copied</>
                          : <><Copy className="h-3 w-3" /> Copy</>
                        }
                      </button>
                    </div>
                    <div className="text-sm leading-relaxed bg-muted rounded-xl p-3 text-foreground whitespace-pre-wrap">
                      {result.suggested_rewrite}
                    </div>
                  </div>
                )}

                {/* Analyse again */}
                <Button variant="outline" size="sm" className="w-full" onClick={reset}>
                  Analyse different content
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating trigger when minimised shows above; when closed shows below */}
      {minimised && (
        <button
          onClick={() => { setOpen(true); setMinimised(false) }}
          className="h-12 w-12 rounded-full bg-foreground text-background shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center"
          title="Pre-Post Analysis"
        >
          <Zap className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}
