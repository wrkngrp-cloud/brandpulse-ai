'use client'

import { useState } from 'react'
import {
  TrendingUp, TrendingDown, Plus, DollarSign, Eye, Heart,
  MousePointerClick, ShoppingBag, ChevronDown, ChevronUp,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn }    from '@/lib/utils'
import { toast } from 'sonner'

export interface InfluencerCampaign {
  id:                     string
  name:                   string
  creator_handle?:        string
  platform?:              string
  reach:                  number
  impressions:            number
  engagements:            number
  emv:                    number
  fee:                    number
  currency:               string
  attributed_clicks:      number
  attributed_conversions: number
  created_at:             string
}

const PLATFORMS = ['instagram', 'tiktok', 'twitter', 'youtube', 'facebook'] as const

// CPM benchmarks (NGN) per platform — kept in sync with API route
const CPM_NGN: Record<string, number> = {
  instagram: 2000, tiktok: 900, twitter: 1200, youtube: 3000, facebook: 1800,
}
const CPE_NGN = 65

function calcEmv(platform: string, impressions: number, engagements: number) {
  const cpm = CPM_NGN[platform] ?? 1500
  return (impressions * cpm / 1000) + (engagements * CPE_NGN)
}

function fmtNGN(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `₦${(n / 1_000).toFixed(1)}K`
  return `₦${n.toFixed(0)}`
}

function roiColor(roi: number) {
  if (roi >= 100) return 'text-emerald-600'
  if (roi >= 0)   return 'text-teal-600'
  return               'text-red-600'
}

function RoiPill({ roi }: { roi: number }) {
  const positive = roi >= 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-bold', roiColor(roi))}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? '+' : ''}{roi.toFixed(0)}% ROI
    </span>
  )
}

function MetricChip({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="text-[13px] font-semibold">{value}</p>
    </div>
  )
}

interface Props {
  initialCampaigns: InfluencerCampaign[]
}

export function InfluencerRoiTracker({ initialCampaigns }: Props) {
  const [campaigns, setCampaigns]     = useState<InfluencerCampaign[]>(initialCampaigns)
  const [showForm, setShowForm]       = useState(false)
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [submitting, setSubmitting]   = useState(false)

  const [form, setForm] = useState({
    name: '', creator_handle: '', platform: 'instagram' as typeof PLATFORMS[number],
    fee: '', reach: '', impressions: '', engagements: '',
    attributed_clicks: '', attributed_conversions: '',
    promo_code: '', utm_campaign: '',
  })

  const n = (v: string) => parseFloat(v) || 0

  const previewEmv = calcEmv(form.platform, n(form.impressions), n(form.engagements))
  const previewRoi = n(form.fee) > 0 ? ((previewEmv - n(form.fee)) / n(form.fee)) * 100 : 0

  async function submit() {
    if (!form.name || !n(form.fee)) {
      toast.error('Name and fee are required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/influencer-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:                   form.name,
          creator_handle:         form.creator_handle,
          platform:               form.platform,
          fee:                    n(form.fee),
          reach:                  n(form.reach),
          impressions:            n(form.impressions),
          engagements:            n(form.engagements),
          attributed_clicks:      n(form.attributed_clicks),
          attributed_conversions: n(form.attributed_conversions),
          promo_code:             form.promo_code,
          utm_campaign:           form.utm_campaign,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setCampaigns(c => [data, ...c])
      setShowForm(false)
      setForm({ name: '', creator_handle: '', platform: 'instagram', fee: '', reach: '', impressions: '', engagements: '', attributed_clicks: '', attributed_conversions: '', promo_code: '', utm_campaign: '' })
      toast.success('Campaign logged')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  // Aggregate stats
  const totalEmv  = campaigns.reduce((s, c) => s + (c.emv ?? 0), 0)
  const totalFee  = campaigns.reduce((s, c) => s + (c.fee ?? 0), 0)
  const totalRoi  = totalFee > 0 ? ((totalEmv - totalFee) / totalFee) * 100 : 0
  const avgEr     = campaigns.length > 0
    ? campaigns.reduce((s, c) => s + (c.impressions > 0 ? c.engagements / c.impressions * 100 : 0), 0) / campaigns.length
    : 0

  return (
    <div className="space-y-5">

      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">Influencer ROI Tracker</h2>
          <p className="text-[12px] text-muted-foreground">Log paid partnerships and measure Earned Media Value vs fee.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(s => !s)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Log campaign
        </Button>
      </div>

      {/* Aggregate tiles */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total EMV',     value: fmtNGN(totalEmv),          icon: TrendingUp,       color: 'text-emerald-600' },
            { label: 'Total Fee Paid', value: fmtNGN(totalFee),         icon: DollarSign,       color: 'text-amber-600' },
            { label: 'Blended ROI',   value: `${totalRoi.toFixed(0)}%`, icon: totalRoi >= 0 ? TrendingUp : TrendingDown, color: totalRoi >= 0 ? 'text-emerald-600' : 'text-red-600' },
            { label: 'Avg Eng. Rate', value: `${avgEr.toFixed(1)}%`,    icon: Heart,            color: 'text-pink-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl border bg-card p-4">
              <Icon className={cn('h-4 w-4 mb-1.5', color)} />
              <p className="text-[10.5px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
              <p className={cn('text-[20px] font-bold leading-tight', color)}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Log form */}
      {showForm && (
        <div className="rounded-2xl border bg-card p-5 space-y-4">
          <p className="text-[13px] font-semibold">New influencer campaign</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11.5px]">Campaign name *</Label>
              <Input placeholder="e.g. Jara Ramadan with @creator" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11.5px]">Creator handle</Label>
              <Input placeholder="@handle" value={form.creator_handle} onChange={e => setForm(f => ({ ...f, creator_handle: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11.5px]">Platform</Label>
              <Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v as typeof PLATFORMS[number] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11.5px]">Fee paid (₦) *</Label>
              <Input type="number" placeholder="e.g. 250000" value={form.fee} onChange={e => setForm(f => ({ ...f, fee: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11.5px]">Reach</Label>
              <Input type="number" placeholder="0" value={form.reach} onChange={e => setForm(f => ({ ...f, reach: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11.5px]">Impressions</Label>
              <Input type="number" placeholder="0" value={form.impressions} onChange={e => setForm(f => ({ ...f, impressions: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11.5px]">Engagements</Label>
              <Input type="number" placeholder="0" value={form.engagements} onChange={e => setForm(f => ({ ...f, engagements: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11.5px]">Attributed clicks</Label>
              <Input type="number" placeholder="0" value={form.attributed_clicks} onChange={e => setForm(f => ({ ...f, attributed_clicks: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11.5px]">Conversions</Label>
              <Input type="number" placeholder="0" value={form.attributed_conversions} onChange={e => setForm(f => ({ ...f, attributed_conversions: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11.5px]">Promo code (optional)</Label>
              <Input placeholder="JARA15" value={form.promo_code} onChange={e => setForm(f => ({ ...f, promo_code: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11.5px]">UTM campaign (optional)</Label>
              <Input placeholder="ramadan_ig_creator" value={form.utm_campaign} onChange={e => setForm(f => ({ ...f, utm_campaign: e.target.value }))} />
            </div>
          </div>

          {/* Live ROI preview */}
          {n(form.fee) > 0 && (
            <div className="rounded-xl bg-muted/40 border px-4 py-3 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">EMV Preview</p>
              <div className="flex flex-wrap gap-4">
                <div>
                  <p className="text-[10.5px] text-muted-foreground">Estimated Media Value</p>
                  <p className="text-[16px] font-bold">{fmtNGN(previewEmv)}</p>
                </div>
                <div>
                  <p className="text-[10.5px] text-muted-foreground">Fee</p>
                  <p className="text-[16px] font-bold">{fmtNGN(n(form.fee))}</p>
                </div>
                <div>
                  <p className="text-[10.5px] text-muted-foreground">ROI</p>
                  <p className={cn('text-[16px] font-bold', roiColor(previewRoi))}>{previewRoi > 0 ? '+' : ''}{previewRoi.toFixed(0)}%</p>
                </div>
              </div>
              <p className="text-[10.5px] text-muted-foreground">
                EMV = (impressions × {fmtNGN(CPM_NGN[form.platform] ?? 1500)}/CPM) + (engagements × ₦{CPE_NGN}/CPE). Nigerian market benchmarks.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={submit} disabled={submitting}>
              {submitting ? 'Saving…' : 'Save campaign'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {campaigns.length === 0 && !showForm && (
        <div className="rounded-2xl border border-dashed bg-muted/20 py-12 text-center space-y-2">
          <TrendingUp className="h-8 w-8 text-muted-foreground/40 mx-auto" />
          <p className="text-[13px] font-medium text-muted-foreground">No influencer campaigns yet</p>
          <p className="text-[12px] text-muted-foreground/60">Log a paid partnership to see ROI vs Earned Media Value.</p>
        </div>
      )}

      {/* Campaign list */}
      {campaigns.length > 0 && (
        <div className="space-y-3">
          {campaigns.map(c => {
            const roi = c.fee > 0 ? ((c.emv - c.fee) / c.fee) * 100 : 0
            const er  = c.impressions > 0 ? (c.engagements / c.impressions) * 100 : 0
            const cpe = c.engagements > 0 ? c.fee / c.engagements : 0
            const isOpen = expanded === c.id

            return (
              <div key={c.id} className="rounded-2xl border bg-card overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-5 py-4 text-left"
                  onClick={() => setExpanded(isOpen ? null : c.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold truncate">{c.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {c.creator_handle && <span className="text-[11.5px] text-muted-foreground">{c.creator_handle}</span>}
                      {c.platform && <span className="text-[10px] font-bold uppercase text-muted-foreground/60 bg-muted rounded px-1.5 py-0.5">{c.platform}</span>}
                    </div>
                  </div>
                  <RoiPill roi={roi} />
                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                </button>

                {isOpen && (
                  <div className="border-t px-5 py-4 space-y-4 bg-muted/10">
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                      <MetricChip icon={Eye}             label="Reach"          value={(c.reach ?? 0).toLocaleString()} />
                      <MetricChip icon={Eye}             label="Impressions"    value={(c.impressions ?? 0).toLocaleString()} />
                      <MetricChip icon={Heart}           label="Engagements"    value={(c.engagements ?? 0).toLocaleString()} />
                      <MetricChip icon={MousePointerClick} label="Clicks"       value={(c.attributed_clicks ?? 0).toLocaleString()} />
                      <MetricChip icon={ShoppingBag}    label="Conversions"    value={(c.attributed_conversions ?? 0).toLocaleString()} />
                    </div>

                    <div className="rounded-xl bg-background border p-4 space-y-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">ROI Breakdown</p>
                      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <p className="text-[10.5px] text-muted-foreground">Earned Media Value</p>
                          <p className="text-[16px] font-bold text-emerald-600">{fmtNGN(c.emv)}</p>
                        </div>
                        <div>
                          <p className="text-[10.5px] text-muted-foreground">Fee Paid</p>
                          <p className="text-[16px] font-bold">{fmtNGN(c.fee)}</p>
                        </div>
                        <div>
                          <p className="text-[10.5px] text-muted-foreground">ROI</p>
                          <p className={cn('text-[16px] font-bold', roiColor(roi))}>{roi > 0 ? '+' : ''}{roi.toFixed(0)}%</p>
                        </div>
                        <div>
                          <p className="text-[10.5px] text-muted-foreground">Eng. rate</p>
                          <p className="text-[16px] font-bold">{er.toFixed(2)}%</p>
                        </div>
                      </div>
                      {c.engagements > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t">
                          <div>
                            <p className="text-[10.5px] text-muted-foreground">Cost per engagement</p>
                            <p className="text-[14px] font-semibold">₦{cpe.toFixed(0)}</p>
                          </div>
                          {c.attributed_clicks > 0 && (
                            <div>
                              <p className="text-[10.5px] text-muted-foreground">Cost per click</p>
                              <p className="text-[14px] font-semibold">₦{(c.fee / c.attributed_clicks).toFixed(0)}</p>
                            </div>
                          )}
                          {c.attributed_conversions > 0 && (
                            <div>
                              <p className="text-[10.5px] text-muted-foreground">Cost per conversion</p>
                              <p className="text-[14px] font-semibold">₦{(c.fee / c.attributed_conversions).toFixed(0)}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <Info className="h-3 w-3 shrink-0 mt-0.5" />
                      EMV calculated using {c.platform ?? 'platform'} CPM of {fmtNGN((CPM_NGN[c.platform ?? ''] ?? 1500))} per 1,000 impressions + ₦{CPE_NGN} per engagement (Nigeria market benchmarks). ROI = (EMV − Fee) / Fee × 100.
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
