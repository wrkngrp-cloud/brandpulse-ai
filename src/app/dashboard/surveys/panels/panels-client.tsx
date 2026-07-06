'use client'

import { useState } from 'react'
import { Plus, Calendar, Mail, Phone, Play, Trash2, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { TourTrigger } from '@/components/tours/tour-trigger'

interface Panel {
  id:               string
  name:             string
  template_key:     string
  cadence:          string
  next_run_at:      string | null
  last_run_at:      string | null
  recipient_emails: string[]
  recipient_phones: string[]
  active:           boolean
  created_at:       string
}

const TEMPLATE_OPTIONS = [
  { key: 'awareness_check',    label: 'Awareness Check'       },
  { key: 'quick_pulse',        label: 'Quick Pulse'           },
  { key: 'perception_audit',   label: 'Brand Perception Audit'},
  { key: 'b2_intercept',       label: 'Awareness Intercept'   },
  { key: 'post_purchase_nps',  label: 'Post-Purchase NPS'     },
]

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' })
}

interface Props {
  brandName:     string
  initialPanels: Panel[]
}

export function SurveyPanelsClient({ brandName, initialPanels }: Props) {
  const [panels, setPanels]     = useState<Panel[]>(initialPanels)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [dispatching, setDispatching] = useState<string | null>(null)

  const [name, setName]       = useState('')
  const [template, setTemplate] = useState('awareness_check')
  const [cadence, setCadence] = useState<'monthly' | 'quarterly'>('monthly')
  const [emailsRaw, setEmailsRaw] = useState('')
  const [phonesRaw, setPhonesRaw] = useState('')

  async function createPanel() {
    const recipient_emails = emailsRaw.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean)
    const recipient_phones = phonesRaw.split(/[\n,;]+/).map(p => p.trim()).filter(Boolean)
    if (!name.trim()) { toast.error('Panel name is required.'); return }

    setSaving(true)
    try {
      const res  = await fetch('/api/survey-panels', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), template_key: template, cadence, recipient_emails, recipient_phones }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPanels(prev => [data.panel, ...prev])
      setShowForm(false)
      setName(''); setEmailsRaw(''); setPhonesRaw('')
      toast.success('Panel created. First dispatch scheduled.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create panel')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(panel: Panel) {
    const res  = await fetch(`/api/survey-panels/${panel.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ active: !panel.active }),
    })
    if (res.ok) {
      setPanels(prev => prev.map(p => p.id === panel.id ? { ...p, active: !p.active } : p))
    }
  }

  async function deletePanel(id: string) {
    const res = await fetch(`/api/survey-panels/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setPanels(prev => prev.filter(p => p.id !== id))
      toast.success('Panel deleted.')
    }
  }

  async function dispatchNow(id: string) {
    setDispatching(id)
    try {
      const res  = await fetch(`/api/survey-panels/${id}/dispatch`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Dispatch queued — survey will be created and sent shortly.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Dispatch failed')
    } finally {
      setDispatching(null)
    }
  }

  return (
    <div className="space-y-6 max-w-[900px]">

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1.5">Surveys</p>
          <h1 className="h-display text-[28px] sm:text-[32px] leading-none">Brand Tracking Panels</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground/60">
            Auto-dispatch recurring surveys monthly or quarterly — with full distribution to emails and WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <TourTrigger module="survey_panels" autoStart />
          <Button size="sm" onClick={() => setShowForm(v => !v)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New panel
          </Button>
        </div>
      </div>

      <div data-tour="panels-main">
      {/* Create form */}
      {showForm && (
        <div className="rounded-2xl border bg-card p-5 space-y-4">
          <p className="text-sm font-semibold">New tracking panel</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs text-muted-foreground">Panel name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={`${brandName} Monthly Tracker`}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Survey template</label>
              <select
                value={template}
                onChange={e => setTemplate(e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none"
              >
                {TEMPLATE_OPTIONS.map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Cadence</label>
              <select
                value={cadence}
                onChange={e => setCadence(e.target.value as 'monthly' | 'quarterly')}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none"
              >
                <option value="monthly">Monthly (1st of each month)</option>
                <option value="quarterly">Quarterly (every 3 months)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Email recipients</label>
              <textarea
                value={emailsRaw}
                onChange={e => setEmailsRaw(e.target.value)}
                rows={3}
                placeholder="one@email.com, two@email.com"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">WhatsApp numbers (with country code)</label>
              <textarea
                value={phonesRaw}
                onChange={e => setPhonesRaw(e.target.value)}
                rows={3}
                placeholder="+2348012345678&#10;+2349098765432"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none resize-none font-mono"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={createPanel} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Create panel
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Panel list */}
      {panels.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 flex flex-col items-center gap-3 text-center">
          <Calendar className="h-8 w-8 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">No panels yet. Create your first recurring survey panel above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {panels.map(panel => (
            <div key={panel.id} className={cn(
              'rounded-2xl border bg-card p-5 transition-opacity',
              !panel.active && 'opacity-60'
            )}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[14px] font-semibold truncate">{panel.name}</p>
                    <span className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide',
                      panel.active
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      {panel.active ? 'active' : 'paused'}
                    </span>
                  </div>
                  <p className="text-[12px] text-muted-foreground capitalize">
                    {TEMPLATE_OPTIONS.find(t => t.key === panel.template_key)?.label ?? panel.template_key}
                    {' · '}{panel.cadence}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => toggleActive(panel)}
                    title={panel.active ? 'Pause panel' : 'Resume panel'}
                  >
                    {panel.active
                      ? <ToggleRight className="h-4 w-4 text-green-500" />
                      : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2.5 text-[12px]"
                    onClick={() => dispatchNow(panel.id)}
                    disabled={dispatching === panel.id}
                  >
                    {dispatching === panel.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <><Play className="h-3 w-3 mr-1" />Send now</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                    onClick={() => deletePanel(panel.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Next run</p>
                    <p className="text-[12px] font-medium">{fmtDate(panel.next_run_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Last run</p>
                    <p className="text-[12px] font-medium">{fmtDate(panel.last_run_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Emails</p>
                    <p className="text-[12px] font-medium">{panel.recipient_emails?.length ?? 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">WhatsApp</p>
                    <p className="text-[12px] font-medium">{panel.recipient_phones?.length ?? 0}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
