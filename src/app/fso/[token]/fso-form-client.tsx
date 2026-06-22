'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronRight, ChevronLeft, Plus, Check, MapPin, Package, AlertCircle } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface OutletEntry {
  outlet_name: string
  outlet_type: string
  product_available: boolean | null
  facings_count: number
  stock_level: string
  observed_price_ngn: string
  posm_present: boolean | null
  posm_condition: string
  competitor_activity: boolean | null
  competitor_name: string
  competitor_what: string
}

const BLANK_OUTLET: OutletEntry = {
  outlet_name: '',
  outlet_type: '',
  product_available: null,
  facings_count: 1,
  stock_level: '',
  observed_price_ngn: '',
  posm_present: null,
  posm_condition: '',
  competitor_activity: null,
  competitor_name: '',
  competitor_what: '',
}

const OUTLET_TYPES = [
  { value: 'supermarket',       label: 'Supermarket'       },
  { value: 'neighbourhood_shop', label: 'Neighbourhood Shop' },
  { value: 'pharmacy',          label: 'Pharmacy'          },
  { value: 'open_market',       label: 'Open Market'       },
  { value: 'petrol_station',    label: 'Petrol Station'    },
  { value: 'hospital',          label: 'Hospital'          },
  { value: 'other',             label: 'Other'             },
]

const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
  'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba',
  'Yobe','Zamfara',
]

// ── Sub-components ─────────────────────────────────────────────────────────────

function YesNoToggle({
  value, onChange, label,
}: {
  value: boolean | null
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}
      <div className="grid grid-cols-2 gap-2">
        {[true, false].map((opt) => (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              'h-12 rounded-xl text-sm font-semibold border-2 transition-all duration-150',
              value === opt
                ? opt
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'bg-red-500 border-red-500 text-white'
                : 'bg-background border-border text-muted-foreground hover:border-primary/50',
            )}
          >
            {opt ? 'YES' : 'NO'}
          </button>
        ))}
      </div>
    </div>
  )
}

function RadioGroup({
  label, options, value, onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all duration-150',
              value === opt.value
                ? 'bg-primary border-primary text-primary-foreground'
                : 'bg-background border-border text-muted-foreground hover:border-primary/50',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function StepDot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <span className={cn(
      'h-2 w-2 rounded-full transition-all duration-200',
      done ? 'bg-primary' : active ? 'bg-primary/70 scale-125' : 'bg-muted-foreground/30',
    )} />
  )
}

// ── Main form ──────────────────────────────────────────────────────────────────

export function FsoFormClient({
  token, teamName, brandName,
}: {
  token: string
  teamName: string
  brandName: string
}) {
  const [step, setStep] = useState(1)

  // Step 1 state
  const [fsoName, setFsoName]     = useState('')
  const [fsoCode, setFsoCode]     = useState('')
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [state, setState]         = useState('')
  const [lga, setLga]             = useState('')

  // Step 2 state
  const [outlets, setOutlets]     = useState<OutletEntry[]>([{ ...BLANK_OUTLET }])
  const [currentOutlet, setCurrentOutlet] = useState(0)

  // Step 3 state
  const [notes, setNotes]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [lastFsoName, setLastFsoName] = useState('')

  const outlet = outlets[currentOutlet]

  function updateOutlet(updates: Partial<OutletEntry>) {
    setOutlets(prev => prev.map((o, i) => i === currentOutlet ? { ...o, ...updates } : o))
  }

  function saveAndAddAnother() {
    setOutlets(prev => [...prev, { ...BLANK_OUTLET }])
    setCurrentOutlet(outlets.length)
  }

  function finishRoute() {
    setStep(3)
  }

  function computeStats() {
    const total     = outlets.length
    const available = outlets.filter(o => o.product_available === true).length
    const posm      = outlets.filter(o => o.posm_present === true && o.posm_condition === 'good').length
    const oos       = outlets.filter(o => o.stock_level === 'out_of_stock').length
    const availPct  = total > 0 ? Math.round((available / total) * 100) : 0
    const posmPct   = total > 0 ? Math.round((posm / total) * 100) : 0
    return { total, available, availPct, posm, posmPct, oos }
  }

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/fso/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          fso_name:    fsoName,
          fso_id_code: fsoCode || null,
          report_date: reportDate,
          state:       state || null,
          lga:         lga   || null,
          notes:       notes || null,
          outlets: outlets.map(o => ({
            outlet_name:         o.outlet_name   || null,
            outlet_type:         o.outlet_type   || null,
            product_available:   o.product_available,
            facings_count:       o.product_available ? o.facings_count : null,
            stock_level:         o.stock_level   || null,
            observed_price_ngn:  o.observed_price_ngn ? parseFloat(o.observed_price_ngn) : null,
            posm_present:        o.posm_present,
            posm_condition:      o.posm_condition || null,
            competitor_activity: o.competitor_activity ? o.competitor_what : null,
            competitor_name:     o.competitor_activity ? o.competitor_name : null,
          })),
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Submission failed')
      }
      setLastFsoName(fsoName)
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForNewRoute() {
    const savedName = lastFsoName
    const savedCode = fsoCode
    setStep(1)
    setFsoName(savedName)
    setFsoCode(savedCode)
    setReportDate(new Date().toISOString().split('T')[0])
    setState('')
    setLga('')
    setOutlets([{ ...BLANK_OUTLET }])
    setCurrentOutlet(0)
    setNotes('')
    setSubmitted(false)
    setSubmitError('')
  }

  // ── Success screen ──────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background gap-6">
        <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <Check className="h-8 w-8 text-emerald-600" />
        </div>
        <div className="text-center space-y-2 max-w-xs">
          <p className="text-lg font-bold">Report submitted!</p>
          <p className="text-sm text-muted-foreground">
            Thank you, {lastFsoName}. Your team&apos;s intelligence helps {brandName} grow.
          </p>
        </div>
        <button
          onClick={resetForNewRoute}
          className="mt-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
        >
          Submit another route
        </button>
      </div>
    )
  }

  const stats = step === 3 ? computeStats() : null

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 pt-safe-top pb-3">
        <div className="flex items-center justify-between pt-3">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{brandName}</p>
            <p className="text-sm font-semibold leading-tight">{teamName} Field Report</p>
          </div>
          <div className="flex gap-1 items-center">
            <StepDot active={step === 1} done={step > 1} />
            <StepDot active={step === 2} done={step > 2} />
            <StepDot active={step === 3} done={step > 3} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-32">

        {/* ── Step 1: FSO Identity ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="py-6 space-y-5">
            <div>
              <h1 className="text-xl font-bold">Who are you?</h1>
              <p className="text-sm text-muted-foreground mt-1">Fill in your details to start today&apos;s route report.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Your name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Emeka Okafor"
                  value={fsoName}
                  onChange={e => setFsoName(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Staff / ID code <span className="text-muted-foreground text-xs font-normal">(optional)</span></label>
                <input
                  type="text"
                  placeholder="e.g. FSO-042"
                  value={fsoCode}
                  onChange={e => setFsoCode(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Date</label>
                <input
                  type="date"
                  value={reportDate}
                  onChange={e => setReportDate(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">State</label>
                <select
                  value={state}
                  onChange={e => setState(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select state...</option>
                  {NIGERIAN_STATES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">LGA / Area <span className="text-muted-foreground text-xs font-normal">(optional)</span></label>
                <input
                  type="text"
                  placeholder="e.g. Surulere"
                  value={lga}
                  onChange={e => setLga(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Outlet entry ─────────────────────────────────────────── */}
        {step === 2 && (
          <div className="py-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">Outlet {currentOutlet + 1}</h1>
                <p className="text-sm text-muted-foreground">
                  {outlets.length > 1 ? `${outlets.length} outlets logged so far` : 'First outlet on your route'}
                </p>
              </div>
              {outlets.length > 1 && (
                <div className="flex gap-1">
                  {outlets.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrentOutlet(i)}
                      className={cn(
                        'h-6 w-6 rounded-full text-[10px] font-bold transition-all',
                        i === currentOutlet
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-5">
              {/* Outlet name */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Outlet name</label>
                <input
                  type="text"
                  placeholder="e.g. Mama Cynthia Stores"
                  value={outlet.outlet_name}
                  onChange={e => updateOutlet({ outlet_name: e.target.value })}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Outlet type */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Outlet type</label>
                <select
                  value={outlet.outlet_type}
                  onChange={e => updateOutlet({ outlet_type: e.target.value })}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select type...</option>
                  {OUTLET_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Product availability */}
              <YesNoToggle
                label="Product on shelf?"
                value={outlet.product_available}
                onChange={v => updateOutlet({ product_available: v })}
              />

              {outlet.product_available === true && (
                <>
                  {/* Facings */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Facings (how many units visible?)</p>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => updateOutlet({ facings_count: Math.max(1, outlet.facings_count - 1) })}
                        className="h-10 w-10 rounded-xl border border-border text-lg font-bold text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                      >
                        −
                      </button>
                      <span className="text-xl font-bold w-8 text-center">{outlet.facings_count}</span>
                      <button
                        type="button"
                        onClick={() => updateOutlet({ facings_count: Math.min(20, outlet.facings_count + 1) })}
                        className="h-10 w-10 rounded-xl border border-border text-lg font-bold text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Stock level */}
                  <RadioGroup
                    label="Stock level"
                    options={[
                      { value: 'full',          label: 'Full'          },
                      { value: 'partial',        label: 'Partial'       },
                      { value: 'out_of_stock',   label: 'Out of stock'  },
                    ]}
                    value={outlet.stock_level}
                    onChange={v => updateOutlet({ stock_level: v })}
                  />
                </>
              )}

              {/* Observed price */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Observed price <span className="text-muted-foreground text-xs font-normal">(optional)</span></label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₦</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="0.00"
                    value={outlet.observed_price_ngn}
                    onChange={e => updateOutlet({ observed_price_ngn: e.target.value })}
                    className="w-full h-12 pl-8 pr-4 rounded-xl border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              {/* POSM */}
              <YesNoToggle
                label="POSM / branding materials in place?"
                value={outlet.posm_present}
                onChange={v => updateOutlet({ posm_present: v, posm_condition: v ? outlet.posm_condition : '' })}
              />

              {outlet.posm_present === true && (
                <RadioGroup
                  label="Material condition"
                  options={[
                    { value: 'good',    label: 'Good'    },
                    { value: 'damaged', label: 'Damaged' },
                  ]}
                  value={outlet.posm_condition}
                  onChange={v => updateOutlet({ posm_condition: v })}
                />
              )}

              {/* Competitor */}
              <YesNoToggle
                label="Competitor activity spotted?"
                value={outlet.competitor_activity}
                onChange={v => updateOutlet({ competitor_activity: v, competitor_name: v ? outlet.competitor_name : '', competitor_what: v ? outlet.competitor_what : '' })}
              />

              {outlet.competitor_activity === true && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Which competitor?</label>
                    <input
                      type="text"
                      placeholder="e.g. Peak Milk"
                      value={outlet.competitor_name}
                      onChange={e => updateOutlet({ competitor_name: e.target.value })}
                      className="w-full h-12 px-4 rounded-xl border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">What did you see?</label>
                    <textarea
                      placeholder="e.g. New promo pack with 50g extra, prominent end-of-aisle display"
                      value={outlet.competitor_what}
                      onChange={e => updateOutlet({ competitor_what: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Summary ─────────────────────────────────────────────── */}
        {step === 3 && stats && (
          <div className="py-6 space-y-5">
            <div>
              <h1 className="text-xl font-bold">Route summary</h1>
              <p className="text-sm text-muted-foreground mt-1">Review before submitting.</p>
            </div>

            {/* Identity summary */}
            <div className="rounded-xl border border-border p-4 space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MapPin className="h-4 w-4 text-primary" />
                {fsoName}{fsoCode && ` (${fsoCode})`}
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                {reportDate}{state ? ` · ${state}` : ''}{lga ? ` · ${lga}` : ''}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/40 p-4 space-y-1">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Outlets visited</p>
              </div>
              <div className={cn(
                'rounded-xl p-4 space-y-1',
                stats.availPct >= 80 ? 'bg-emerald-50 dark:bg-emerald-900/20' :
                stats.availPct >= 60 ? 'bg-amber-50 dark:bg-amber-900/20' :
                                        'bg-red-50 dark:bg-red-900/20',
              )}>
                <p className={cn(
                  'text-2xl font-bold',
                  stats.availPct >= 80 ? 'text-emerald-600' :
                  stats.availPct >= 60 ? 'text-amber-600' : 'text-red-600',
                )}>{stats.availPct}%</p>
                <p className="text-xs text-muted-foreground">Availability</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-4 space-y-1">
                <p className="text-2xl font-bold">{stats.posmPct}%</p>
                <p className="text-xs text-muted-foreground">POSM compliance</p>
              </div>
              <div className={cn(
                'rounded-xl p-4 space-y-1',
                stats.oos > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-muted/40',
              )}>
                <p className={cn('text-2xl font-bold', stats.oos > 0 && 'text-red-600')}>{stats.oos}</p>
                <p className="text-xs text-muted-foreground">Out-of-stock alerts</p>
              </div>
            </div>

            {/* Outlet list */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outlets logged</p>
              {outlets.map((o, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <Package className={cn(
                    'h-4 w-4 shrink-0',
                    o.product_available === true ? 'text-emerald-500' :
                    o.product_available === false ? 'text-red-500' : 'text-muted-foreground',
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{o.outlet_name || `Outlet ${i + 1}`}</p>
                    <p className="text-xs text-muted-foreground">{OUTLET_TYPES.find(t => t.value === o.outlet_type)?.label ?? 'Not specified'}</p>
                  </div>
                  {o.product_available === true && (
                    <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded px-1.5 py-0.5">IN STOCK</span>
                  )}
                  {o.product_available === false && (
                    <span className="text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded px-1.5 py-0.5">NO STOCK</span>
                  )}
                </div>
              ))}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Any notes? <span className="text-muted-foreground text-xs font-normal">(optional)</span></label>
              <textarea
                placeholder="Anything unusual about today's route..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            {submitError && (
              <div className="flex gap-2 items-start rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 p-3">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom CTA bar ─────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-background/95 backdrop-blur border-t border-border px-4 py-4 pb-safe-bottom space-y-2">
        {step === 1 && (
          <button
            type="button"
            disabled={!fsoName.trim()}
            onClick={() => setStep(2)}
            className="w-full h-13 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            Start route report
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={saveAndAddAnother}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Save outlet + add another
            </button>
            <button
              type="button"
              onClick={finishRoute}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-xl border-2 border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              Done with route
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full h-9 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back to identity
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-13 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60 transition-opacity"
            >
              {submitting ? 'Submitting...' : 'Submit report'}
              {!submitting && <Check className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full h-9 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back to outlets
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
