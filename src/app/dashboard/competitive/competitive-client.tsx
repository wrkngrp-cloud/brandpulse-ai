'use client'

import { useState } from 'react'
import {
  Trophy, TrendingUp, TrendingDown, MapPin, Plus, Loader2, RefreshCw,
  ChevronDown, ChevronUp, AlertCircle, Lightbulb, Eye, CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NigeriaLocationSelect } from '@/components/nigeria-location-select'
import { FieldTip } from '@/components/ui/field-tip'

function TriggerCompetitiveCrawlButton() {
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle')

  async function trigger() {
    setPhase('running')
    try {
      const res = await fetch('/api/inngest/trigger-competitive', { method: 'POST' })
      setPhase(res.ok ? 'done' : 'error')
    } catch {
      setPhase('error')
    }
  }

  if (phase === 'running') {
    return (
      <Button size="sm" variant="outline" disabled>
        <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Starting…
      </Button>
    )
  }
  if (phase === 'done') {
    return (
      <span className="text-xs text-emerald-600 flex items-center gap-1">
        <CheckCircle2 className="h-3.5 w-3.5" /> Crawl started — data appears in a few minutes.
      </span>
    )
  }
  if (phase === 'error') {
    return (
      <span className="text-xs text-rose-500 flex items-center gap-1">
        <AlertCircle className="h-3.5 w-3.5" /> Failed to start crawl.
        <button onClick={trigger} className="underline">Retry</button>
      </span>
    )
  }
  return (
    <Button size="sm" variant="outline" onClick={trigger}>
      <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Run crawl now
    </Button>
  )
}

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface Recommendation {
  action: string
  rationale: string
  priority: 'High' | 'Medium' | 'Low'
}

interface PorterForces {
  competitive_rivalry: string
  threat_of_new_entrants: string
  bargaining_power_buyers: string
  threat_of_substitutes: string
  overall_intensity: 'High' | 'Medium' | 'Low'
}

interface BriefingResult {
  title: string
  executive_summary: string
  sov_analysis: string
  sentiment_vs_market: string
  porter_forces?: PorterForces
  brand_strengths: string[]
  brand_vulnerabilities: string[]
  competitor_threats: string[]
  opportunities: string[]
  recommendations: Recommendation[]
  data_gaps: string[]
  confidence: 'High' | 'Medium' | 'Low'
}

interface Sighting {
  id: string
  competitor_name: string
  sighting_type: string
  city: string | null
  state: string | null
  description: string | null
  spotted_at: string
  lat?: number | null
  lng?: number | null
}

interface Props {
  brandName: string
  brandSov: number | null
  marketShare: number | null
  competitorNames: string[]
  esovLeague: { name: string; sov: number | null; isOurBrand: boolean }[]
  sightings: Sighting[]
  avgSentiment: number | null
  lastBriefing: { content: Record<string, unknown>; created_at: string } | null
}

// ─── Style maps ─────────────────────────────────────────────────────────────

const PRIORITY_STYLE: Record<string, string> = {
  High:   'bg-red-100 text-red-800',
  Medium: 'bg-amber-100 text-amber-800',
  Low:    'bg-muted text-muted-foreground',
}

const CONFIDENCE_STYLE: Record<string, string> = {
  High:   'bg-green-100 text-green-800',
  Medium: 'bg-amber-100 text-amber-800',
  Low:    'bg-muted text-muted-foreground',
}

const SIGHTING_TYPE_STYLE: Record<string, string> = {
  billboard:  'bg-purple-100 text-purple-800',
  event:      'bg-blue-100 text-blue-800',
  digital:    'bg-sky-100 text-sky-800',
  print:      'bg-gray-100 text-gray-800',
  tv:         'bg-rose-100 text-rose-800',
  radio:      'bg-orange-100 text-orange-800',
  activation: 'bg-green-100 text-green-800',
  pr:         'bg-indigo-100 text-indigo-800',
}

const SIGHTING_TYPES = ['billboard', 'event', 'digital', 'print', 'tv', 'radio', 'activation', 'pr']

// ─── Sub-components ──────────────────────────────────────────────────────────

const TABS = ['Briefing', 'ESOV League', 'Sightings', 'Scorecard'] as const
type Tab = typeof TABS[number]

function TabBar({ active, onSelect }: { active: Tab; onSelect: (t: Tab) => void }) {
  return (
    <div className="flex gap-1 border-b overflow-x-auto">
      {TABS.map(tab => (
        <button
          key={tab}
          onClick={() => onSelect(tab)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
            active === tab
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        {open
          ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5 pt-1">{children}</div>}
    </div>
  )
}

function StringList({ items, icon: Icon, iconClass }: {
  items: string[]
  icon?: React.ElementType
  iconClass?: string
}) {
  if (!items?.length) return <p className="text-sm text-muted-foreground">No data.</p>
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
          {Icon
            ? <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', iconClass ?? 'text-muted-foreground')} />
            : <span className="shrink-0 h-5 w-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

// ─── Tab: Briefing ───────────────────────────────────────────────────────────

function BriefingTab({
  brandName,
  brandSov,
  competitorNames,
  lastBriefing,
}: {
  brandName: string
  brandSov: number | null
  competitorNames: string[]
  lastBriefing: { content: Record<string, unknown>; created_at: string } | null
}) {
  const stored = lastBriefing?.content as unknown as BriefingResult | null
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<BriefingResult | null>(stored)
  const [error, setError]       = useState<string | null>(null)
  const hasBriefing = result !== null

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/ai/competitive-briefing', { method: 'POST' })
      const data = await res.json() as BriefingResult & { error?: string }
      if (!res.ok) { setError(data.error ?? 'Generation failed'); return }
      setResult(data)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5 pt-5">
      {!hasBriefing && (
        <div className="border rounded-xl p-5 bg-card space-y-4">
          <div className="flex items-start gap-3">
            <Trophy className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">What this briefing covers</p>
              <p className="text-sm text-muted-foreground">
                An AI-generated competitive intelligence report using your live brand data — share of voice,
                sentiment trends, recent social signals, and your tracked competitors.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="border rounded-lg p-3 space-y-0.5">
              <p className="text-xs text-muted-foreground">Brand</p>
              <p className="font-medium">{brandName}</p>
            </div>
            <div className="border rounded-lg p-3 space-y-0.5">
              <p className="text-xs text-muted-foreground">Competitors tracked</p>
              <p className="font-medium">{competitorNames.length > 0 ? competitorNames.join(', ') : 'None yet'}</p>
            </div>
            <div className="border rounded-lg p-3 space-y-0.5">
              <p className="text-xs text-muted-foreground">SOV data</p>
              <p className={cn('font-medium', brandSov !== null ? 'text-green-600' : 'text-muted-foreground')}>
                {brandSov !== null ? `${brandSov}%` : 'Not yet — run a crawl first'}
              </p>
            </div>
          </div>

          {competitorNames.length === 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">
                Add competitors in Settings to get a richer briefing with named competitive comparisons.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={generate} disabled={loading} className="w-full">
            {loading
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating briefing...</>
              : <><Trophy className="h-4 w-4 mr-2" /> Generate this week&apos;s briefing</>}
          </Button>

          {loading && (
            <p className="text-center text-xs text-muted-foreground animate-pulse">
              Analysing share of voice, sentiment trends, and social signals...
            </p>
          )}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">{result.title}</h2>
              <span className={cn('inline-flex text-xs px-2 py-0.5 rounded-full font-medium', CONFIDENCE_STYLE[result.confidence])}>
                {result.confidence} confidence
              </span>
              {lastBriefing && !loading && (
                <p className="text-xs text-muted-foreground">
                  Last generated {new Date(lastBriefing.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
              {loading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <><RefreshCw className="h-3.5 w-3.5 mr-1" /> Regenerate</>}
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="border rounded-xl bg-muted/40 px-5 py-4">
            <p className="text-sm leading-relaxed">{result.executive_summary}</p>
          </div>

          <Section title="Share of voice & ESOV" icon={Trophy}>
            <p className="text-sm leading-relaxed">{result.sov_analysis}</p>
          </Section>

          <Section title="Sentiment vs market" icon={TrendingUp}>
            <p className="text-sm leading-relaxed">{result.sentiment_vs_market}</p>
          </Section>

          {result.porter_forces && (
            <Section title="Competitive Forces" icon={AlertCircle} defaultOpen>
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold border', {
                    'bg-red-50 text-red-700 border-red-200':    result.porter_forces.overall_intensity === 'High',
                    'bg-amber-50 text-amber-700 border-amber-200': result.porter_forces.overall_intensity === 'Medium',
                    'bg-green-50 text-green-700 border-green-200':  result.porter_forces.overall_intensity === 'Low',
                  })}>
                    Competitive intensity: {result.porter_forces.overall_intensity}
                  </span>
                </div>
                {([
                  { key: 'competitive_rivalry',      label: 'Competitive Rivalry' },
                  { key: 'threat_of_new_entrants',   label: 'Threat of New Entrants' },
                  { key: 'bargaining_power_buyers',  label: 'Buyer Bargaining Power' },
                  { key: 'threat_of_substitutes',    label: 'Threat of Substitutes' },
                ] as const).map(({ key, label }) => (
                  <div key={key} className="rounded-lg border bg-muted/20 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                    <p className="text-sm leading-relaxed">{result.porter_forces![key]}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Section title="Brand strengths" icon={TrendingUp} defaultOpen>
              <StringList items={result.brand_strengths} icon={TrendingUp} iconClass="text-green-500" />
            </Section>
            <Section title="Vulnerabilities" icon={TrendingDown} defaultOpen>
              <StringList items={result.brand_vulnerabilities} icon={TrendingDown} iconClass="text-red-400" />
            </Section>
          </div>

          <Section title="Competitor threats" icon={AlertCircle}>
            <StringList items={result.competitor_threats} />
          </Section>

          <Section title="Opportunities" icon={Lightbulb}>
            <StringList items={result.opportunities} />
          </Section>

          <Section title="Recommendations" icon={Trophy}>
            {result.recommendations?.length > 0 ? (
              <div className="space-y-3">
                {result.recommendations.map((rec, i) => (
                  <div key={i} className="border rounded-xl p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium leading-snug">{rec.action}</p>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', PRIORITY_STYLE[rec.priority])}>
                        {rec.priority}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{rec.rationale}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recommendations generated.</p>
            )}
          </Section>

          {result.data_gaps?.length > 0 && (
            <Section title="Data gaps" icon={AlertCircle} defaultOpen={false}>
              <p className="text-xs text-muted-foreground mb-3">Collect this data to make the next briefing more accurate.</p>
              <StringList items={result.data_gaps} />
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tab: ESOV League ────────────────────────────────────────────────────────

function EsovLeagueTab({
  esovLeague,
  marketShare,
  brandName,
}: {
  esovLeague: { name: string; sov: number | null; isOurBrand: boolean }[]
  marketShare: number | null
  brandName: string
}) {
  const hasSov = esovLeague.some(e => e.sov !== null)

  if (!hasSov) {
    return (
      <div className="pt-5">
        <div className="border rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3 bg-muted/20">
          <Trophy className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No SOV data yet</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Run a competitor crawl to populate share-of-voice data. Once that completes, this table will fill in automatically.
          </p>
          <TriggerCompetitiveCrawlButton />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 pt-5">
      <div>
        <h2 className="text-sm font-semibold">Share of Voice vs Market Share</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          ESOV = SOV% minus market share %. Positive means you are punching above your weight.
        </p>
      </div>

      <div className="border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Brand</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">SOV%</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Market Share%</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">ESOV</th>
            </tr>
          </thead>
          <tbody>
            {esovLeague.map((entry, i) => {
              const mktShare = entry.isOurBrand ? marketShare : null
              const esov = entry.sov !== null && mktShare !== null
                ? Number((entry.sov - mktShare).toFixed(1))
                : null
              const esovColor = esov === null
                ? 'text-muted-foreground'
                : esov > 0
                  ? 'text-green-700 font-semibold'
                  : esov === 0
                    ? 'text-amber-600 font-semibold'
                    : 'text-red-600 font-semibold'

              return (
                <tr
                  key={i}
                  className={cn(
                    'border-b last:border-0 transition-colors',
                    entry.isOurBrand ? 'bg-muted/40' : 'hover:bg-muted/20',
                  )}
                >
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      {entry.isOurBrand && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-foreground text-background rounded-full font-bold tracking-wide">
                          YOU
                        </span>
                      )}
                      {entry.name}
                    </div>
                  </td>
                  <td className="text-right px-4 py-3">
                    {entry.sov !== null ? `${entry.sov}%` : '—'}
                  </td>
                  <td className="text-right px-4 py-3 text-muted-foreground">
                    {mktShare !== null ? `${mktShare}%` : '—'}
                  </td>
                  <td className={cn('text-right px-4 py-3', esovColor)}>
                    {esov !== null
                      ? `${esov > 0 ? '+' : ''}${esov}%`
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Positive ESOV — growth mode</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Zero — at parity</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Negative — decline risk</span>
      </div>

      <p className="text-xs text-muted-foreground border-t pt-3">
        Note: Competitor market share estimates are indicative only. Edit in Settings &gt; Competitors.
      </p>
    </div>
  )
}

// ─── Tab: Sightings ──────────────────────────────────────────────────────────

function SightingsTab({
  competitorNames,
  initialSightings,
}: {
  competitorNames: string[]
  initialSightings: Sighting[]
}) {
  const [sightings, setSightings]       = useState<Sighting[]>(initialSightings)
  const [showForm, setShowForm]         = useState(false)
  const [saving, setSaving]             = useState(false)
  const [formError, setFormError]       = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    competitor_name: '',
    sighting_type: 'billboard',
    city: '',
    state: '',
    description: '',
    spotted_at: today,
  })

  function updateField(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.competitor_name.trim()) { setFormError('Competitor name is required.'); return }
    setSaving(true)
    setFormError(null)
    try {
      const res = await fetch('/api/competitive/sightings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error ?? 'Failed to save sighting.'); return }
      setSightings(prev => [data, ...prev])
      setShowForm(false)
      setForm({ competitor_name: '', sighting_type: 'billboard', city: '', state: '', description: '', spotted_at: today })
    } catch {
      setFormError('Network error. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Competitor Activity Feed</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Log what you spot in the field — billboards, events, campaigns.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm(s => !s)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Log a sighting
        </Button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="border rounded-xl p-5 bg-card space-y-4">
          <p className="text-sm font-medium">New sighting</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Competitor</label>
              {competitorNames.length > 0 ? (
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.competitor_name}
                  onChange={e => {
                    if (e.target.value === '__other__') updateField('competitor_name', '')
                    else updateField('competitor_name', e.target.value)
                  }}
                >
                  <option value="">Select or type below</option>
                  {competitorNames.map(n => <option key={n} value={n}>{n}</option>)}
                  <option value="__other__">Other (type below)</option>
                </select>
              ) : null}
              <input
                type="text"
                placeholder="Competitor name"
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.competitor_name}
                onChange={e => updateField('competitor_name', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1">Sighting type <FieldTip tip="What kind of marketing activity you spotted. Billboard, radio, sponsorship etc. Helps the AI identify which channels your competitors are investing in most." /></label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.sighting_type}
                onChange={e => updateField('sighting_type', e.target.value)}
              >
                {SIGHTING_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">City</label>
              <input
                type="text"
                placeholder="e.g. Lagos"
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.city}
                onChange={e => updateField('city', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">State</label>
              <NigeriaLocationSelect
                state={form.state}
                lga=""
                onStateChange={v => updateField('state', v)}
                onLgaChange={() => {}}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1">Description <FieldTip tip="Describe the messaging, creative angle, or scale of what you saw. The more detail you add, the better the AI can identify patterns across multiple sightings." /></label>
              <textarea
                rows={3}
                placeholder="Describe what you saw — location, messaging, scale, timing..."
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                value={form.description}
                onChange={e => updateField('description', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Date spotted</label>
              <input
                type="date"
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.spotted_at}
                onChange={e => updateField('spotted_at', e.target.value)}
              />
            </div>
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving...</> : 'Save sighting'}
            </Button>
          </div>
        </form>
      )}

      {sightings.length === 0 ? (
        <div className="border rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3 bg-muted/20">
          <Eye className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No competitor sightings logged yet</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            When you spot a competitor campaign in the wild, log it here. It feeds into your competitive briefing.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sightings.map(s => (
            <div key={s.id} className="border rounded-xl p-4 bg-card space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-foreground text-background">
                    {s.competitor_name}
                  </span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                    SIGHTING_TYPE_STYLE[s.sighting_type] ?? 'bg-muted text-muted-foreground')}>
                    {s.sighting_type}
                  </span>
                  {(s.city || s.state) && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {[s.city, s.state].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {s.lat != null && s.lng != null && (
                    <span className="text-xs text-muted-foreground italic">Location logged</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(s.spotted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              {s.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Scorecard ──────────────────────────────────────────────────────────

function ScorecardTab({
  brandName,
  brandSov,
  avgSentiment,
  esovLeague,
  marketShare,
}: {
  brandName: string
  brandSov: number | null
  avgSentiment: number | null
  esovLeague: { name: string; sov: number | null; isOurBrand: boolean }[]
  marketShare: number | null
}) {
  const competitors = esovLeague.filter(e => !e.isOurBrand)

  const brandEsov = brandSov !== null && marketShare !== null
    ? Number((brandSov - marketShare).toFixed(1))
    : null

  const marketPosition = (esov: number | null) => {
    if (esov === null) return '—'
    if (esov > 5)  return 'Strong'
    if (esov > 0)  return 'Growth'
    if (esov === 0) return 'Parity'
    return 'At risk'
  }

  return (
    <div className="space-y-5 pt-5">
      <div>
        <h2 className="text-sm font-semibold">Side-by-side comparison</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          How {brandName} measures up against your tracked competitors.
        </p>
      </div>

      <div className="border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground w-40">Metric</th>
              <th className="text-center px-4 py-3 text-xs font-medium">
                <span className="text-[10px] px-1.5 py-0.5 bg-foreground text-background rounded-full font-bold mr-1">YOU</span>
                {brandName}
              </th>
              {competitors.map(c => (
                <th key={c.name} className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b hover:bg-muted/20">
              <td className="px-4 py-3 text-muted-foreground font-medium text-xs">SOV%</td>
              <td className="text-center px-4 py-3 font-medium bg-muted/10">
                {brandSov !== null ? `${brandSov}%` : '—'}
              </td>
              {competitors.map(c => (
                <td key={c.name} className="text-center px-4 py-3 text-muted-foreground">
                  {c.sov !== null ? `${c.sov}%` : '—'}
                </td>
              ))}
            </tr>
            <tr className="border-b hover:bg-muted/20">
              <td className="px-4 py-3 text-muted-foreground font-medium text-xs">Sentiment score</td>
              <td className="text-center px-4 py-3 font-medium bg-muted/10">
                {avgSentiment !== null ? `${avgSentiment}/100` : '—'}
              </td>
              {competitors.map(c => (
                <td key={c.name} className="text-center px-4 py-3 text-muted-foreground">—</td>
              ))}
            </tr>
            <tr className="border-b hover:bg-muted/20">
              <td className="px-4 py-3 text-muted-foreground font-medium text-xs">Content volume</td>
              <td className="text-center px-4 py-3 font-medium bg-muted/10">Active</td>
              {competitors.map(c => (
                <td key={c.name} className="text-center px-4 py-3 text-muted-foreground">N/A</td>
              ))}
            </tr>
            <tr className="hover:bg-muted/20">
              <td className="px-4 py-3 text-muted-foreground font-medium text-xs">Your ESOV</td>
              <td className="text-center px-4 py-3 font-medium bg-muted/10">
                {marketPosition(brandEsov)}
                {brandEsov !== null && (
                  <span className="ml-1 text-[10px] text-muted-foreground">({brandEsov > 0 ? '+' : ''}{brandEsov}%)</span>
                )}
              </td>
              {competitors.map(c => (
                <td key={c.name} className="text-center px-4 py-3 text-muted-foreground text-[11px]">
                  ESOV needs market share data
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground border-t pt-3">
        Expand scorecard accuracy by connecting more data sources in Settings &gt; Integrations.
      </p>
    </div>
  )
}

// ─── Root client component ───────────────────────────────────────────────────

export function CompetitiveClient({
  brandName,
  brandSov,
  marketShare,
  competitorNames,
  esovLeague,
  sightings,
  avgSentiment,
  lastBriefing,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Briefing')

  return (
    <div className="space-y-0">
      <TabBar active={activeTab} onSelect={setActiveTab} />

      {activeTab === 'Briefing' && (
        <BriefingTab
          brandName={brandName}
          brandSov={brandSov}
          competitorNames={competitorNames}
          lastBriefing={lastBriefing}
        />
      )}

      {activeTab === 'ESOV League' && (
        <div data-tour="competitive-sov">
          <EsovLeagueTab
            esovLeague={esovLeague}
            marketShare={marketShare}
            brandName={brandName}
          />
        </div>
      )}

      {activeTab === 'Sightings' && (
        <div data-tour="competitive-mentions">
          <SightingsTab
            competitorNames={competitorNames}
            initialSightings={sightings}
          />
        </div>
      )}

      {activeTab === 'Scorecard' && (
        <div data-tour="competitive-sentiment">
          <ScorecardTab
            brandName={brandName}
            brandSov={brandSov}
            avgSentiment={avgSentiment}
            esovLeague={esovLeague}
            marketShare={marketShare}
          />
        </div>
      )}
    </div>
  )
}
