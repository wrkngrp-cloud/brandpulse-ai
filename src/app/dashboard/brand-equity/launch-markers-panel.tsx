'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Flag, Plus, Trash2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BhiDelta {
  before_avg: number | null
  after_avg:  number | null
  delta:      number | null
}

interface Marker {
  id:          string
  brand_id:    string
  label:       string
  marker_type: string
  marker_date: string
  notes:       string | null
  created_at:  string
  bhi_delta?:  BhiDelta
}

const MARKER_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'product_launch',  label: 'Product Launch' },
  { value: 'campaign_launch', label: 'Campaign Launch' },
  { value: 'partnership',     label: 'Partnership' },
  { value: 'crisis',          label: 'Crisis' },
  { value: 'rebrand',         label: 'Rebrand' },
  { value: 'event',           label: 'Event' },
  { value: 'other',           label: 'Other' },
]

const TYPE_BADGE: Record<string, string> = {
  product_launch:  'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900',
  campaign_launch: 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900',
  partnership:     'bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-900',
  crisis:          'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
  rebrand:         'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900',
  event:           'bg-green-50 text-green-600 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900',
  other:           'bg-muted text-muted-foreground border-border',
}

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  MARKER_TYPE_OPTIONS.map(o => [o.value, o.label]),
)

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function LaunchMarkersPanel() {
  const [markers, setMarkers] = useState<Marker[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [label, setLabel] = useState('')
  const [markerType, setMarkerType] = useState('product_launch')
  const [markerDate, setMarkerDate] = useState(() => new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/brand/markers')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load markers')
      setMarkers(json.markers ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load markers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setLabel('')
    setMarkerType('product_launch')
    setMarkerDate(new Date().toISOString().split('T')[0])
    setNotes('')
  }

  const handleSubmit = async () => {
    if (!label.trim()) {
      toast.error('Add a label for this marker')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/brand/markers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label.trim(),
          marker_type: markerType,
          marker_date: markerDate,
          notes: notes.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to add marker')
      toast.success('Marker added')
      resetForm()
      setShowForm(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add marker')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string, markerLabel: string) => {
    if (!confirm(`Delete the marker "${markerLabel}"?`)) return
    try {
      const res = await fetch(`/api/brand/markers?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to delete marker')
      toast.success('Marker deleted')
      setMarkers(prev => prev.filter(m => m.id !== id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete marker')
    }
  }

  return (
    <div className="border rounded-xl p-5 bg-card space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">Feature & Launch Markers</p>
            <p className="text-xs text-muted-foreground">
              Annotate the timeline with launches, campaigns, and events to see their BHI impact.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={showForm ? 'secondary' : 'default'}
          onClick={() => setShowForm(v => !v)}
        >
          {showForm ? (
            <>
              <ChevronDown className="h-4 w-4 rotate-180" />
              Close
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Add marker
            </>
          )}
        </Button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="marker-label">Label</Label>
              <Input
                id="marker-label"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. New flavour launch"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="marker-type">Type</Label>
              <Select value={markerType} onValueChange={v => setMarkerType(v ?? 'product_launch')}>
                <SelectTrigger id="marker-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MARKER_TYPE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="marker-date">Date</Label>
              <Input
                id="marker-date"
                type="date"
                value={markerDate}
                onChange={e => setMarkerDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="marker-notes">Notes (optional)</Label>
            <Textarea
              id="marker-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Anything worth remembering about this moment."
              rows={2}
            />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => { resetForm(); setShowForm(false) }} disabled={submitting}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save marker'}
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : markers.length === 0 ? (
        <div className="text-center py-6 border border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground">No markers yet</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            Add your first launch or campaign to track its brand impact.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {markers.map(m => {
            const delta = m.bhi_delta?.delta ?? null
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 group"
              >
                <span className="text-xs text-muted-foreground tabular-nums w-24 shrink-0">
                  {formatDate(m.marker_date)}
                </span>
                <span className={cn(
                  'text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 border shrink-0',
                  TYPE_BADGE[m.marker_type] ?? TYPE_BADGE.other,
                )}>
                  {TYPE_LABEL[m.marker_type] ?? m.marker_type}
                </span>
                <span className="text-sm font-medium flex-1 truncate" title={m.notes ?? undefined}>
                  {m.label}
                </span>
                <span className={cn(
                  'hidden sm:inline text-xs font-semibold tabular-nums shrink-0',
                  delta == null ? 'text-muted-foreground/50'
                    : delta > 0 ? 'text-green-600'
                    : delta < 0 ? 'text-red-500'
                    : 'text-muted-foreground',
                )}>
                  {delta == null
                    ? 'No BHI data'
                    : `BHI ${delta > 0 ? '+' : ''}${delta} in 7 days`}
                </span>
                <button
                  onClick={() => handleDelete(m.id, m.label)}
                  className="text-muted-foreground/40 hover:text-red-500 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                  aria-label="Delete marker"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
