'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter }     from 'next/navigation'
import { Search, ArrowRight, LayoutDashboard, Plus, Settings2, X, ChevronRight } from 'lucide-react'
import { Button }        from '@/components/ui/button'
import { cn }            from '@/lib/utils'
import { WIDGET_CATALOG, WIDGET_BY_ID, DASHBOARD_TEMPLATES, DEFAULT_WIDGET_IDS, type WidgetDef } from '@/lib/widget-catalog'
import { TemplatePicker } from './template-picker'
import { MetricEntryDrawer } from './metric-entry-drawer'
import type { BHIResult } from '@/lib/bhi'
import type { IndustryId } from '@/lib/industry-config'
import { AI_PROMPTS_BY_INDUSTRY } from '@/lib/industry-config'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  brandName:    string
  industry:     string | null
  bhi:          BHIResult | null
  sovScore:     number | null
  sentimentScore: number | null
  activeCampaigns: number
  upcomingEvents:  number
  dataConnected:   boolean
}

// ── Summary sentence builder ───────────────────────────────────────────────────

function buildSummary(props: Props): string {
  const { brandName, bhi, sovScore, sentimentScore, activeCampaigns, upcomingEvents, dataConnected } = props

  if (!dataConnected) {
    return `Welcome to ${brandName}'s command centre. Connect your data sources to see your marketing performance summary here.`
  }

  const parts: string[] = []

  if (bhi?.score != null) {
    const zone = bhi.zone ?? 'building'
    const zoneLabel = zone === 'leading' ? 'strong' : zone === 'healthy' ? 'healthy' : zone === 'at_risk' ? 'at risk' : 'building'
    parts.push(`Brand health is ${zoneLabel} at ${bhi.score}/100`)
  }

  if (sentimentScore != null) {
    const sentiment = sentimentScore >= 70 ? 'positive' : sentimentScore >= 50 ? 'mixed' : 'negative'
    parts.push(`audience sentiment is ${sentiment} at ${sentimentScore}%`)
  }

  if (sovScore != null) {
    parts.push(`share of voice is ${sovScore.toFixed(1)}%`)
  }

  if (activeCampaigns > 0) {
    parts.push(`${activeCampaigns} campaign${activeCampaigns !== 1 ? 's' : ''} active`)
  }

  if (upcomingEvents > 0) {
    parts.push(`${upcomingEvents} event${upcomingEvents !== 1 ? 's' : ''} coming up`)
  }

  if (parts.length === 0) return `${brandName}'s dashboard is ready. Start by connecting data or running a campaign.`

  const month = new Date().toLocaleString('en-NG', { month: 'long' })
  return `${month}: ${parts.join(', ')}.`
}

// ── Rotating prompt component ─────────────────────────────────────────────────

function RotatingPrompt({ prompts }: { prompts: string[] }) {
  const [idx, setIdx] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const id = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setIdx(i => (i + 1) % prompts.length)
        setFading(false)
      }, 300)
    }, 4000)
    return () => clearInterval(id)
  }, [prompts.length])

  return (
    <span className={cn('transition-opacity duration-300', fading ? 'opacity-0' : 'opacity-100')}>
      {prompts[idx]}
    </span>
  )
}

// ── Widget add/remove panel ────────────────────────────────────────────────────

function WidgetPanel({ currentIds, onUpdate, onClose }: {
  currentIds: string[]
  onUpdate:   (ids: string[]) => void
  onClose:    () => void
}) {
  const [ids, setIds] = useState(currentIds)

  const toggle = (id: string) => {
    setIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const save = useCallback(async () => {
    await fetch('/api/dashboard/prefs', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widget_ids: ids }),
    })
    onUpdate(ids)
    onClose()
  }, [ids, onUpdate, onClose])

  const categories = [
    { label: 'Commercial',   ids: ['marketing-roi-score','attributed-revenue','ltv-cac','roas-channel','budget-vs-actual'] },
    { label: 'Brand Health', ids: ['bhi-score','sentiment-trend','share-of-voice','emv-counter','cultural-resonance'] },
    { label: 'Campaigns',    ids: ['campaign-leaderboard','digital-performance'] },
    { label: 'Events',       ids: ['event-calendar','ambassador-board','influencer-roi','visual-mentions'] },
    { label: 'Intelligence', ids: ['competitor-digest','recent-mentions'] },
    { label: 'Research',     ids: ['nps-score','outlet-alerts','field-coverage'] },
    { label: 'Measurement',  ids: ['geo-lift-map','ai-insights','board-pack-export'] },
  ]

  return (
    <div className="fixed inset-0 z-[9985] bg-foreground/20 backdrop-blur-[2px]" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-xs bg-card border-l shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold">Manage widgets</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {categories.map(cat => (
            <div key={cat.label}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">{cat.label}</p>
              <div className="space-y-1">
                {cat.ids.map(id => {
                  const w = WIDGET_BY_ID[id]
                  if (!w) return null
                  const active = ids.includes(id)
                  return (
                    <button key={id} type="button" onClick={() => toggle(id)}
                      className={cn('w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                        active ? 'bg-foreground text-background' : 'hover:bg-muted'
                      )}>
                      <span className="text-base leading-none">{w.icon}</span>
                      <span className="flex-1 font-medium text-[13px]">{w.label}</span>
                      {active && <X className="h-3 w-3 shrink-0 opacity-70" />}
                      {!active && <Plus className="h-3 w-3 shrink-0 opacity-40" />}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t">
          <Button className="w-full" size="sm" onClick={save}>Save layout</Button>
        </div>
      </div>
    </div>
  )
}

// ── Mini KPI tile ─────────────────────────────────────────────────────────────

function KpiTile({ label, value, sub, href }: { label: string; value: string | null; sub?: string; href?: string }) {
  const content = (
    <div className="border rounded-xl p-4 bg-card space-y-1 hover:border-foreground/30 transition-colors cursor-pointer">
      <p className={cn('text-xl font-bold tabular-nums', !value && 'text-muted-foreground/40')}>
        {value ?? 'N/A'}
      </p>
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground/60">{sub}</p>}
    </div>
  )
  if (href) return <a href={href}>{content}</a>
  return content
}

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardHero({
  brandName, industry, bhi, sovScore, sentimentScore,
  activeCampaigns, upcomingEvents, dataConnected,
  initialWidgetIds, isFirstVisit, industryTemplate, onPickerClose,
}: Props & {
  initialWidgetIds: string[]
  isFirstVisit:     boolean
  industryTemplate: string | null
  onPickerClose?:   () => void
}) {
  const router = useRouter()
  const [query, setQuery]           = useState('')
  const [widgetIds, setWidgetIds]   = useState(initialWidgetIds)
  const [showPicker, setShowPicker] = useState(isFirstVisit)
  const [showPanel, setShowPanel]   = useState(false)
  const [showMetrics, setShowMetrics] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const ind      = (industry ?? 'other') as IndustryId
  const prompts  = AI_PROMPTS_BY_INDUSTRY[ind] ?? AI_PROMPTS_BY_INDUSTRY['other']
  const summary  = buildSummary({ brandName, industry, bhi, sovScore, sentimentScore, activeCampaigns, upcomingEvents, dataConnected })

  function handleAskSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    router.push(`/dashboard/ask?q=${encodeURIComponent(query.trim())}`)
  }

  function handlePromptClick(prompt: string) {
    router.push(`/dashboard/ask?q=${encodeURIComponent(prompt)}`)
  }

  const bhiValue  = bhi?.score != null ? `${bhi.score}` : null
  const sovValue  = sovScore  != null  ? `${sovScore.toFixed(1)}%` : null
  const sentValue = sentimentScore != null ? `${sentimentScore}%` : null

  return (
    <>
      {showPicker && (
        <TemplatePicker
          defaultTemplateId={industryTemplate ?? undefined}
          onSelect={(tid, wids) => {
            setWidgetIds(wids)
            setShowPicker(false)
            onPickerClose?.()
          }}
        />
      )}

      {showPanel && (
        <WidgetPanel
          currentIds={widgetIds}
          onUpdate={setWidgetIds}
          onClose={() => setShowPanel(false)}
        />
      )}

      {showMetrics && (
        <MetricEntryDrawer
          industry={industry}
          onClose={() => setShowMetrics(false)}
          onSaved={() => router.refresh()}
        />
      )}

      <div className="space-y-4 mb-8">
        {/* Summary sentence */}
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          {summary}
        </p>

        {/* AI Ask hero */}
        <form onSubmit={handleAskSubmit} className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder=""
            className={cn(
              'w-full h-12 pl-10 pr-32 rounded-xl border bg-card text-sm outline-none',
              'placeholder:text-muted-foreground/50',
              'focus:ring-2 focus:ring-foreground/10 focus:border-foreground/30',
              'transition-all duration-150',
            )}
          />
          {!query && (
            <span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/50 pointer-events-none">
              <RotatingPrompt prompts={prompts} />
            </span>
          )}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
            <Button size="sm" type="submit" disabled={!query.trim()} className="h-8 px-3 text-xs">
              Ask <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </form>

        {/* Quick prompt chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {prompts.slice(0, 4).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => handlePromptClick(p)}
              className="shrink-0 text-xs border rounded-full px-3 py-1.5 bg-card hover:bg-muted hover:border-foreground/30 transition-colors text-muted-foreground hover:text-foreground truncate max-w-[200px]"
            >
              {p}
            </button>
          ))}
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiTile label="Brand Health" value={bhiValue} sub={bhi?.zone ?? undefined} href="/dashboard/brand-equity" />
          <KpiTile label="Sentiment"    value={sentValue} sub="latest score" href="/dashboard/sentiment" />
          <KpiTile label="Share of Voice" value={sovValue} sub="vs category" href="/dashboard/brand-equity" />
          <KpiTile label="Active Campaigns" value={activeCampaigns > 0 ? String(activeCampaigns) : null} sub={activeCampaigns > 0 ? 'running now' : 'none active'} href="/dashboard/campaigns" />
        </div>

        {/* Dashboard controls */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Your dashboard</span>
            <span className="text-xs text-muted-foreground">{widgetIds.length} widgets</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setShowMetrics(true)}>
              <Plus className="h-3.5 w-3.5" /> Enter data
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setShowPanel(true)}>
              <Settings2 className="h-3.5 w-3.5" /> Customise
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
