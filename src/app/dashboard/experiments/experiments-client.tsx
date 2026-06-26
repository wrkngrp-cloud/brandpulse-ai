'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  FlaskConical, Plus, Play, Pause, CheckSquare,
  RefreshCw, Loader2, X, TrendingUp, Users,
  BarChart3, Trophy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Variant {
  id:          string
  name:        string
  is_control:  boolean
  impressions: number
  conversions: number
  revenue:     number
  sort_order:  number
  content:     Record<string, unknown>
}

interface Experiment {
  id:               string
  name:             string
  hypothesis:       string
  experiment_type:  string
  metric_primary:   string
  status:           string
  confidence_target: number
  min_sample_size:  number
  winner_variant_id: string | null
  started_at:       string | null
  concluded_at:     string | null
  created_at:       string
  variants:         Variant[]
}

const STATUS_COLOR: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-700 border-gray-200',
  running:   'bg-green-100 text-green-700 border-green-200',
  paused:    'bg-yellow-100 text-yellow-700 border-yellow-200',
  concluded: 'bg-blue-100 text-blue-700 border-blue-200',
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  message:      <span className="text-xs">✉️</span>,
  creative:     <span className="text-xs">🎨</span>,
  channel:      <span className="text-xs">📡</span>,
  offer:        <span className="text-xs">🏷️</span>,
  landing_page: <span className="text-xs">🖥️</span>,
  email:        <span className="text-xs">📧</span>,
  other:        <span className="text-xs">🧪</span>,
}

// Simple z-score based significance check (two-proportion z-test)
function calcSignificance(control: Variant, variant: Variant): { pValue: number; significant: boolean; winner: 'control' | 'variant' | null; liftPct: number } {
  const n1 = control.impressions, x1 = control.conversions
  const n2 = variant.impressions, x2 = variant.conversions
  if (!n1 || !n2 || (!x1 && !x2)) return { pValue: 1, significant: false, winner: null, liftPct: 0 }
  const p1 = x1 / n1, p2 = x2 / n2
  const p  = (x1 + x2) / (n1 + n2)
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2))
  if (se === 0) return { pValue: 1, significant: false, winner: null, liftPct: 0 }
  const z   = (p2 - p1) / se
  const pValue = 2 * (1 - normalCDF(Math.abs(z)))
  const liftPct = p1 > 0 ? ((p2 - p1) / p1) * 100 : 0
  return {
    pValue,
    significant: pValue < 0.05,
    winner: pValue < 0.05 ? (p2 > p1 ? 'variant' : 'control') : null,
    liftPct,
  }
}
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * z)
  const d = 0.3989423 * Math.exp(-z * z / 2)
  return 1 - d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
}

export function ExperimentsClient() {
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [expandedId, setExpandedId]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/experiments')
    if (res.ok) setExperiments((await res.json()).experiments ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const setStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/experiments/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    if (!res.ok) { toast.error('Failed to update status'); return }
    toast.success(`Experiment ${status}`)
    load()
  }

  const running  = experiments.filter(e => e.status === 'running').length
  const concluded = experiments.filter(e => e.status === 'concluded').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">A/B Testing</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Structured experiments with statistical significance tracking</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New experiment
          </Button>
        </div>
      </div>

      {experiments.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<FlaskConical className="h-4 w-4" />} label="Total"     value={String(experiments.length)} />
          <StatCard icon={<Play className="h-4 w-4" />}         label="Running"   value={String(running)} />
          <StatCard icon={<CheckSquare className="h-4 w-4" />}  label="Concluded" value={String(concluded)} />
          <StatCard icon={<Trophy className="h-4 w-4" />}       label="Winners"   value={String(experiments.filter(e => e.winner_variant_id).length)} />
        </div>
      )}

      {showForm && (
        <NewExperimentForm
          onSave={async (data) => {
            const res = await fetch('/api/experiments', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
            })
            if (!res.ok) { toast.error('Failed to create experiment'); return }
            toast.success('Experiment created')
            setShowForm(false)
            load()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading && experiments.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && experiments.length === 0 && (
        <div className="rounded-xl border border-dashed p-16 text-center">
          <FlaskConical className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No experiments yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Create your first A/B test to measure the impact of creative, messaging, or channel changes.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {experiments.map(exp => (
          <div key={exp.id} className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-start gap-3 px-4 py-3">
              <button onClick={() => setExpandedId(expandedId === exp.id ? null : exp.id)} className="mt-0.5 shrink-0">
                {TYPE_ICON[exp.experiment_type] ?? TYPE_ICON.other}
              </button>
              <div className="flex-1 min-w-0">
                <button onClick={() => setExpandedId(expandedId === exp.id ? null : exp.id)} className="text-left">
                  <p className="font-semibold text-sm">{exp.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{exp.hypothesis}</p>
                </button>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={cn('text-xs capitalize', STATUS_COLOR[exp.status])}>
                  {exp.status}
                </Badge>
                {exp.status === 'draft' && (
                  <Button size="sm" variant="outline" onClick={() => setStatus(exp.id, 'running')}>
                    <Play className="h-3 w-3 mr-1" />Start
                  </Button>
                )}
                {exp.status === 'running' && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setStatus(exp.id, 'paused')}>
                      <Pause className="h-3 w-3 mr-1" />Pause
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setStatus(exp.id, 'concluded')}>
                      <CheckSquare className="h-3 w-3 mr-1" />Conclude
                    </Button>
                  </>
                )}
                {exp.status === 'paused' && (
                  <Button size="sm" variant="outline" onClick={() => setStatus(exp.id, 'running')}>
                    <Play className="h-3 w-3 mr-1" />Resume
                  </Button>
                )}
              </div>
            </div>

            {expandedId === exp.id && (
              <div className="border-t px-4 py-4 bg-muted/10 space-y-4">
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="text-muted-foreground">Primary metric: <strong>{exp.metric_primary}</strong></span>
                  <span className="text-muted-foreground">Confidence: <strong>{exp.confidence_target}%</strong></span>
                  <span className="text-muted-foreground">Min sample: <strong>{exp.min_sample_size}</strong></span>
                </div>

                {/* Variants table */}
                {exp.variants?.length > 0 && (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted border-b">
                        <tr>
                          {['Variant', 'Impressions', 'Conversions', 'Conv. rate', 'Revenue', 'Lift vs. control', 'Sig.'].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {exp.variants
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map(v => {
                            const control   = exp.variants.find(x => x.is_control) ?? exp.variants[0]
                            const convRate  = v.impressions > 0 ? (v.conversions / v.impressions) * 100 : 0
                            const sig       = v.is_control ? null : calcSignificance(control, v)
                            const isWinner  = exp.winner_variant_id === v.id
                            return (
                              <tr key={v.id} className={cn('hover:bg-muted/20', isWinner && 'bg-green-50/50')}>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1.5">
                                    {isWinner && <Trophy className="h-3 w-3 text-yellow-500" />}
                                    <span className="font-medium">{v.name}</span>
                                    {v.is_control && <Badge variant="outline" className="text-[10px] py-0">Control</Badge>}
                                  </div>
                                </td>
                                <td className="px-3 py-2">{v.impressions.toLocaleString()}</td>
                                <td className="px-3 py-2">{v.conversions.toLocaleString()}</td>
                                <td className="px-3 py-2 font-medium">{convRate.toFixed(2)}%</td>
                                <td className="px-3 py-2">₦{v.revenue.toLocaleString()}</td>
                                <td className="px-3 py-2">
                                  {sig ? (
                                    <span className={cn('font-medium', sig.liftPct > 0 ? 'text-green-600' : 'text-red-600')}>
                                      {sig.liftPct > 0 ? '+' : ''}{sig.liftPct.toFixed(1)}%
                                    </span>
                                  ) : '—'}
                                </td>
                                <td className="px-3 py-2">
                                  {sig ? (
                                    <Badge variant="outline" className={cn('text-xs', sig.significant ? 'border-green-300 text-green-700' : 'border-gray-300 text-gray-500')}>
                                      {sig.significant ? '✓ Sig.' : `p=${sig.pValue.toFixed(2)}`}
                                    </Badge>
                                  ) : '—'}
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">{icon} {label}</div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}

function NewExperimentForm({ onSave, onCancel }: { onSave: (d: Record<string, unknown>) => void; onCancel: () => void }) {
  const [name, setName]       = useState('')
  const [hypo, setHypo]       = useState('')
  const [type, setType]       = useState('message')
  const [metric, setMetric]   = useState('conversion_rate')
  const [variantA, setVarA]   = useState('Control')
  const [variantB, setVarB]   = useState('Variant A')
  const [saving, setSaving]   = useState(false)

  const handle = async () => {
    if (!name || !hypo || !metric) { toast.error('Name, hypothesis, and metric are required'); return }
    setSaving(true)
    await onSave({
      name, hypothesis: hypo, experiment_type: type, metric_primary: metric,
      variants: [
        { name: variantA, is_control: true },
        { name: variantB, is_control: false },
      ],
    })
    setSaving(false)
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm">New experiment</p>
        <button onClick={onCancel}><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Experiment name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. CTA button color test" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Type</Label>
          <select value={type} onChange={e => setType(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background">
            {['message', 'creative', 'channel', 'offer', 'landing_page', 'email', 'other'].map(t => (
              <option key={t} value={t} className="capitalize">{t.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Hypothesis *</Label>
          <Input value={hypo} onChange={e => setHypo(e.target.value)} placeholder="We believe that... will result in..." className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Primary metric *</Label>
          <Input value={metric} onChange={e => setMetric(e.target.value)} placeholder="e.g. conversion_rate, click_rate" className="mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Control name</Label>
            <Input value={variantA} onChange={e => setVarA(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Variant name</Label>
            <Input value={variantB} onChange={e => setVarB(e.target.value)} className="mt-1" />
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handle} disabled={saving}>
          {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Create experiment
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}
